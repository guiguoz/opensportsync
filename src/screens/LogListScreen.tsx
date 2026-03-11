import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert,
} from 'react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { ActivityRecord, getAllActivities, markActivitySynced, deleteActivity, updateActivityType } from '../database/db';
import { readGpxFile, listGpxFiles } from '../services/GpxService';
import { extractGpxMetadata } from '../services/GpxParser';
import RNFS from 'react-native-fs';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LogList'>;

export default function LogListScreen() {
  const navigation = useNavigation<Nav>();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // 1. Reconstruire la DB depuis les fichiers GPX orphelins (DB vidée sans supprimer les GPX)
      const [gpxPaths, existing] = await Promise.all([listGpxFiles(), getAllActivities()]);
      const dbIds = new Set(existing.map(a => a.id));
      for (const path of gpxPaths) {
        const id = path.split('/').pop()?.replace('.gpx', '') ?? '';
        if (!id || dbIds.has(id)) continue;
        try {
          const xml  = await readGpxFile(path);
          const meta = extractGpxMetadata(xml);
          await markActivitySynced({
            id,
            synced_at: Date.now(),
            gpx_path: path,
            date:       meta.date,
            duration_s: meta.durationS,
            distance_m: meta.distanceM,
            d_plus:     meta.dPlus,
            activity_type: meta.activityType,
          });
        } catch (_) {}
      }
      // 2. Charger + réparer les activity_type manquants
      const data = await getAllActivities();
      for (const a of data) {
        if (a.activity_type) continue;
        try {
          const xml  = await readGpxFile(a.gpx_path);
          const meta = extractGpxMetadata(xml);
          if (meta.activityType) {
            await updateActivityType(a.id, meta.activityType);
            a.activity_type = meta.activityType;
          }
        } catch (_) {}
      }
      setActivities([...data]);
    } catch (e) {
      Alert.alert('Erreur chargement', String(e));
    }
  }, []);

  // Recharger à chaque fois qu'on revient sur cet écran
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDelete(item: ActivityRecord) {
    Alert.alert(
      'Supprimer',
      `Supprimer l'activité du ${formatDate(item.date)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteActivity(item.id);
            // Supprimer le fichier GPX si présent
            if (item.gpx_path) {
              await RNFS.unlink(item.gpx_path).catch(() => {});
            }
            await load();
          },
        },
      ]
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyText}>Aucune activité synchronisée</Text>
        <Text style={styles.emptyHint}>Connectez la montre et lancez une synchronisation</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={activities}
      keyExtractor={item => item.id}
      ListFooterComponent={
        <Text style={styles.deleteHint}>Appui long sur une activité pour la supprimer</Text>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Map', { activity: item })}
          onLongPress={() => confirmDelete(item)}
          activeOpacity={0.75}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            {!!item.activity_type && (
              <Text style={styles.cardType}>{item.activity_type}</Text>
            )}
            <Text style={styles.cardSub}>{formatDuration(item.duration_s)} · {formatDist(item.distance_m)}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardDPlus}>▲ {item.d_plus} m</Text>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, string> = {
  // Français (SPORT_TYPE_MAP)
  'orientation':        '🧭',
  'course à pied':      '🏃',
  'cyclisme':           '🚴',
  'vtt':                '🚵',
  'randonnée':          '🥾',
  'marche':             '🚶',
  'natation':           '🏊',
  'trail':              '🏔',
  'ski alpin':          '⛷',
  'ski de fond':        '⛷',
  'ski de randonnée':   '⛷',
  'snowboard':          '🏂',
  'patinage':           '⛸',
  'patinage sur glace': '⛸',
  'alpinisme':          '🧗',
  // Anglais (activity_name brute si jamais peuplée)
  'orienteering':       '🧭',
  'running':            '🏃',
  'cycling':            '🚴',
  'mountain biking':    '🚵',
  'trekking':           '🥾',
  'hiking':             '🥾',
  'swimming':           '🏊',
  'trail running':      '🏔',
  'skiing':             '⛷',
  'cross country skiing':'⛷',
};

function activityIcon(type: string): string {
  return ACTIVITY_ICONS[type.toLowerCase()] ?? '🏅';
}

function formatDate(iso: string): string {
  if (!iso) return 'Date inconnue';
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}m${String(s).padStart(2, '0')}`;
}

function formatDist(meters: number): string {
  if (!meters) return '--';
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${meters} m`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#16213e', padding: 12 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16213e', padding: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#fff', fontWeight: '600', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: '#8899aa', textAlign: 'center' },
  deleteHint: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardLeft: { flex: 1 },
  cardDate: { fontSize: 15, color: '#fff', fontWeight: '600', marginBottom: 2 },
  cardType: { fontSize: 12, color: '#7ec8e3', marginBottom: 3 },
  cardSub: { fontSize: 13, color: '#8899aa' },
  cardRight: { alignItems: 'flex-end' },
  cardDPlus: { fontSize: 13, color: '#4caf50', marginBottom: 4 },
  cardArrow: { fontSize: 22, color: '#8899aa' },
});
