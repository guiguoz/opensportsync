import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getRunalyzeApiKey, saveRunalyzeApiKey, removeRunalyzeApiKey,
} from '../services/ApiRunalyze';

export default function SettingsScreen() {
  const [runalyzeKey, setRunalyzeKey]     = useState('');
  const [savedKey, setSavedKey]           = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  useFocusEffect(useCallback(() => {
    getRunalyzeApiKey().then(k => {
      setSavedKey(k);
      setRunalyzeKey(k ?? '');
    });
  }, []));

  async function handleSaveRunalyze() {
    if (!runalyzeKey.trim()) {
      Alert.alert('Clé vide', 'Entrez votre clé API Runalyze.');
      return;
    }
    setSaving(true);
    try {
      await saveRunalyzeApiKey(runalyzeKey.trim());
      setSavedKey(runalyzeKey.trim());
      Alert.alert('Enregistré', 'Clé API Runalyze sauvegardée.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveRunalyze() {
    await removeRunalyzeApiKey();
    setSavedKey(null);
    setRunalyzeKey('');
    Alert.alert('Supprimé', 'Clé API Runalyze supprimée.');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>

      {/* ── Runalyze ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Runalyze</Text>
        <Text style={styles.sectionDesc}>
          Runalyze est une plateforme d'analyse d'entraînement open source et gratuite.
          Vos activités GPX seront importées dans votre compte Runalyze.
        </Text>
        <Text style={styles.sectionDesc}>
          Générez votre clé API sur{' '}
          <Text style={styles.link}>runalyze.com → Account → API access</Text>
        </Text>

        <Text style={styles.label}>Clé API</Text>
        <TextInput
          style={styles.input}
          value={runalyzeKey}
          onChangeText={setRunalyzeKey}
          placeholder="Collez votre clé API ici"
          placeholderTextColor="#4a5a7a"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
            onPress={handleSaveRunalyze}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.btnText}>Enregistrer</Text>
            }
          </TouchableOpacity>

          {savedKey && (
            <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleRemoveRunalyze}>
              <Text style={styles.btnText}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>

        {savedKey && (
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.statusText}>Clé enregistrée</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16213e' },
  content: { padding: 20 },
  section: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#00e5ff', marginBottom: 8 },
  sectionDesc: { fontSize: 13, color: '#8899aa', marginBottom: 6, lineHeight: 19 },
  link: { color: '#00e5ff' },
  label: { fontSize: 13, color: '#8899aa', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a4a7a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#00e5ff22', borderWidth: 1, borderColor: '#00e5ff' },
  btnDanger:  { backgroundColor: '#f4433622', borderWidth: 1, borderColor: '#f44336' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50', marginRight: 6 },
  statusText: { color: '#4caf50', fontSize: 12 },
});
