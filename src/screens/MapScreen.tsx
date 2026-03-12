import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Linking } from 'react-native';
import { shareFile, saveToDownloads } from '../native/AmbitUsbModule';
import { WebView } from 'react-native-webview';
import { uploadGpxToLivelox, isAuthenticated, getAuthorizationUrl } from '../services/ApiLivelox';
import { getRunalyzeApiKey, uploadFitToRunalyze } from '../services/ApiRunalyze';
import { generateFitFile } from '../services/FitExport';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { readGpxFile } from '../services/GpxService';
import { parseTrackPoints, computeElevationStats, TrackPoint } from '../services/GpxParser';
import ElevationChart from '../components/ElevationChart';

type Route = RouteProp<RootStackParamList, 'Map'>;
type Nav   = NativeStackNavigationProp<RootStackParamList, 'Map'>;

// ─── Carte Leaflet (IGN, sans clé API) ────────────────────────────────────────

function buildLeafletHtml(coords: { lat: number; lng: number }[]): string {
  const json = JSON.stringify(coords);
  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>* { margin:0; padding:0; } html,body,#map { width:100%; height:100%; }</style>
</head><body>
<div id="map"></div>
<script>
  var coords = ${json};
  var map = L.map('map');
  L.tileLayer(
    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png' +
    '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    { maxZoom: 18, attribution: '© IGN Géoplateforme' }
  ).addTo(map);

  if (coords.length > 0) {
    var lls = coords.map(function(c){ return [c.lat, c.lng]; });
    var line = L.polyline(lls, { color: '#ff2200', weight: 4, opacity: 0.9 }).addTo(map);

    var dot = function(color) {
      return L.divIcon({ className: '',
        html: '<div style="width:14px;height:14px;background:' + color +
              ';border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
        iconAnchor: [7, 7] });
    };
    L.marker(lls[0],              { icon: dot('#2ecc71') }).addTo(map).bindPopup('Départ');
    L.marker(lls[lls.length - 1], { icon: dot('#e74c3c') }).addTo(map).bindPopup('Arrivée');

    map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }
</script>
</body></html>`;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const route      = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { activity } = route.params;

  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    readGpxFile(activity.gpx_path)
      .then(xml => setPoints(parseTrackPoints(xml)))
      .catch(e => Alert.alert('Erreur', 'Impossible de lire le fichier GPX\n' + e?.message))
      .finally(() => setLoading(false));
  }, [activity.gpx_path]);

  const coords = useMemo(
    () => points.map(p => ({ lat: p.latitude, lng: p.longitude })),
    [points]
  );

  const stats = useMemo(() => computeElevationStats(points), [points]);

  const leafletHtml = useMemo(() => buildLeafletHtml(coords), [coords]);

  async function handleExportLivelox() {
    setShowExportMenu(false);
    const auth = await isAuthenticated();
    if (!auth) {
      const url = await getAuthorizationUrl();
      Alert.alert(
        'Connexion Livelox',
        'Vous allez être redirigé vers Livelox pour autoriser l\'accès. Revenez ensuite dans l\'app.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => Linking.openURL(url) },
        ]
      );
      return;
    }
    setExporting(true);
    try {
      const result = await uploadGpxToLivelox(activity.gpx_path);
      Alert.alert(
        'Livelox',
        `Activité importée !\n\n${result.viewerUrl}`,
        [
          { text: 'Fermer', style: 'cancel' },
          { text: 'Voir sur Livelox', onPress: () => Linking.openURL(result.viewerUrl) },
        ]
      );
    } catch (e: any) {
      Alert.alert('Erreur Livelox', e?.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleUploadRunalyze() {
    setShowExportMenu(false);
    const apiKey = await getRunalyzeApiKey();
    if (!apiKey) {
      Alert.alert(
        'Clé API manquante',
        'Configurez votre clé API Runalyze dans les Paramètres.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Paramètres', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }
    setExporting(true);
    try {
      const fitPath = await generateFitFile(activity.gpx_path, activity);
      const result  = await uploadFitToRunalyze(fitPath, apiKey);
      Alert.alert(
        'Runalyze ✓',
        `Activité importée ! (ID : ${result.activityId})\n\nPour l'envoyer vers Suunto : runalyze.com → activité → Partager → Suunto`,
      );
    } catch (e: any) {
      Alert.alert('Erreur Runalyze', e?.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleShareGpx() {
    setShowExportMenu(false);
    try {
      await shareFile(activity.gpx_path);
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de partager le fichier\n' + e?.message);
    }
  }

  async function handleSaveToDownloads() {
    setShowExportMenu(false);
    try {
      const fileName = activity.gpx_path.split('/').pop() ?? `${activity.id}.gpx`;
      await saveToDownloads(activity.gpx_path, fileName);
      Alert.alert('Enregistré', `Fichier copié dans Téléchargements :\n${fileName}`);
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer\n' + e?.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.loadingText}>Chargement du parcours…</Text>
      </View>
    );
  }

  if (coords.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Aucun point GPS dans ce fichier GPX</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Carte Leaflet ── */}
      <WebView
        style={styles.map}
        source={{ html: leafletHtml }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
      />

      {/* ── Infos overlay ── */}
      <View style={styles.overlay}>
        <StatChip label="Distance" value={formatDist(stats.totalDistance)} />
        <StatChip label="D+" value={`${stats.dPlus} m`} color="#4caf50" />
        <StatChip label="D-" value={`${stats.dMinus} m`} color="#f44336" />
        <StatChip label="Durée" value={formatDuration(activity.duration_s)} />
      </View>

      {/* ── Bouton export flottant ── */}
      <TouchableOpacity
        style={[styles.exportFab, exporting && styles.btnDisabled]}
        onPress={() => setShowExportMenu(v => !v)}
        disabled={exporting}
      >
        <Text style={styles.exportFabText}>{exporting ? '…' : '⬆'}</Text>
      </TouchableOpacity>

      {/* ── Menu d'export ── */}
      {showExportMenu && (
        <View style={styles.exportMenu}>
          <ExportMenuItem label="📤 Partager GPX"                    onPress={handleShareGpx} />
          <ExportMenuItem label="💾 Enregistrer (Téléchargements)"   onPress={handleSaveToDownloads} />
          <ExportMenuItem label="📊 Upload Runalyze"                 onPress={handleUploadRunalyze} />
          <ExportMenuItem label="🔴 Upload Livelox"                  onPress={handleExportLivelox} />
        </View>
      )}

      {/* ── Profil altimétrique ── */}
      <ElevationChart points={points} stats={stats} />
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`;
}

function formatDuration(s: number) {
  if (!s) return '--';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function ExportMenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.exportItem} onPress={onPress}>
      <Text style={styles.exportItemText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatChip({ label, value, color = '#fff' }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16213e' },
  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16213e' },
  loadingText: { color: '#aaa', marginTop: 12 },
  errorText: { color: '#f44336', fontSize: 15 },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(22,33,62,0.85)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  chip: { alignItems: 'center', flex: 1 },
  chipLabel: { fontSize: 10, color: '#8899aa', marginBottom: 2 },
  chipValue: { fontSize: 13, fontWeight: '700', color: '#fff' },
  exportFab: {
    position: 'absolute',
    bottom: 148,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  exportFabText: { fontSize: 20, color: '#fff' },
  exportMenu: {
    position: 'absolute',
    bottom: 204,
    right: 16,
    backgroundColor: '#0f3460',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 6,
    minWidth: 200,
  },
  exportItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4a7a',
  },
  exportItemText: { color: '#fff', fontSize: 14 },
});
