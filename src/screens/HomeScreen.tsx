import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { runSync, SyncState } from '../services/SyncService';
import { connect, disconnect } from '../native/AmbitUsbModule';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [sync, setSync] = useState<SyncState>({ phase: 'idle', current: 0, total: 0, newCount: 0 });

  async function handleSync() {
    if (sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error') return;
    try {
      await runSync(setSync);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Erreur inconnue');
      setSync(s => ({ ...s, phase: 'error' }));
    }
  }

  const isBusy = sync.phase !== 'idle' && sync.phase !== 'done' && sync.phase !== 'error';
  return (
    <View style={styles.container}>
      {/* Logo / titre */}
      <Text style={styles.logo}>⌚</Text>
      <Text style={styles.title}>AmbitSync</Text>
      <Text style={styles.subtitle}>Suunto Ambit 1</Text>

      {/* Statut */}
      <View style={styles.statusBox}>
        <StatusBadge phase={sync.phase} />
        {isBusy && sync.total > 0 && (
          <Text style={styles.progressText}>
            {sync.current} / {sync.total} logs
          </Text>
        )}
        {sync.phase === 'done' && (
          <Text style={styles.doneText}>
            {sync.newCount} nouveau{sync.newCount !== 1 ? 'x' : ''} log{sync.newCount !== 1 ? 's' : ''} importé{sync.newCount !== 1 ? 's' : ''}
          </Text>
        )}
        {sync.phase === 'error' && sync.error && (
          <Text style={styles.errorText}>{sync.error}</Text>
        )}
      </View>

      {/* Bouton sync */}
      <TouchableOpacity
        style={[styles.btn, isBusy && styles.btnDisabled]}
        onPress={handleSync}
        disabled={isBusy}
      >
        {isBusy
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Synchroniser la montre</Text>
        }
      </TouchableOpacity>

      {/* Bouton liste */}
      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() => navigation.navigate('LogList')}
      >
        <Text style={styles.btnText}>Voir les activités</Text>
      </TouchableOpacity>

    </View>
  );
}

function StatusBadge({ phase }: { phase: SyncState['phase'] }) {
  const labels: Record<SyncState['phase'], string> = {
    idle:       '● En attente',
    connecting: '⟳ Connexion…',
    fetching:   '⟳ Lecture des logs…',
    writing:    '⟳ Enregistrement…',
    done:       '✓ Synchronisé',
    error:      '✗ Erreur',
  };
  const colors: Record<SyncState['phase'], string> = {
    idle:       '#888',
    connecting: '#f0a500',
    fetching:   '#f0a500',
    writing:    '#f0a500',
    done:       '#4caf50',
    error:      '#f44336',
  };
  return (
    <Text style={[styles.statusLabel, { color: colors[phase] }]}>
      {labels[phase]}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#16213e',
  },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8899aa', marginBottom: 32 },
  statusBox: {
    alignItems: 'center',
    marginBottom: 32,
    minHeight: 60,
  },
  statusLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  progressText: { fontSize: 13, color: '#aaa' },
  doneText: { fontSize: 13, color: '#4caf50' },
  errorText: { fontSize: 12, color: '#f44336', textAlign: 'center', maxWidth: 280 },
  btn: {
    width: '100%',
    backgroundColor: '#0f3460',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnSecondary: { backgroundColor: '#1a4a7a' },
  btnTertiary: { backgroundColor: '#2a3a5a' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
