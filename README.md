# OpenSportsSync

> 🇫🇷 [Lire en français](#français) · 🇬🇧 English below

---

## English

Android app to sync GPS activity logs from Suunto Ambit watches via USB OTG, display them on a map, and export them to training platforms.

### Features

- Sync activity logs directly from the watch via USB OTG (no Bluetooth required)
- Display GPS tracks on an interactive map (IGN tiles via WebView + Leaflet)
- Elevation profile with D+ / D- stats
- Activity type display (Orienteering, Trail running, MTB, Cycling…)
- Activity filters by type in the log list
- Local SQLite database — automatic rebuild from GPX files on device
- Permanent deletion (deleted activities are never re-imported on next sync)
- Export to **Livelox** (OAuth2 — orienteering route analysis)
- Export to **Runalyze** (FIT format — training analytics + push to Suunto app)
- Share GPX / Save to Downloads

### Getting activities into the Suunto app

Since the Ambit 1 has no BLE and Movescount is closed, the path to the official Suunto app is:

**OpenSportsSync → Runalyze (FIT) → Suunto app**

1. In OpenSportsSync: open an activity → export → Upload to Runalyze
2. On [runalyze.com](https://runalyze.com): Settings → Connections → link your Suunto account
3. On the activity page in Runalyze: Share → Suunto

### Hardware support

| Device | Protocol | Status |
|--------|----------|--------|
| Suunto Ambit 1 / 2 / 2S / 2R / 3 | USB OTG (libambit NDK) | ✅ Working |
| Suunto Traverse / Traverse Alpha | USB OTG (libambit NDK) | ✅ Supported |

### Tech stack

- **React Native 0.84** — Bare Workflow, Android only
- **Kotlin** — USB OTG, Android UsbManager, FileDescriptor
- **C++ / NDK** — JNI bridge + [libambit](https://github.com/openambitproject/openambit)
- **react-native-sqlite-storage** — local activity database
- **react-native-fs** — GPX/FIT file read/write
- **fast-xml-parser** — GPX parsing
- **FIT encoder** — pure TypeScript, no dependencies (`src/services/FitExport.ts`)

### Build

```bash
# 1. Bundle JS (required before every native build)
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 2. Build APK
cd android && ./gradlew assembleDebug

# 3. Install
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Important:** `assembleDebug` does NOT automatically re-bundle the JS. Always run step 1 after any TypeScript/TSX change.

### Requirements

- Android 9+ (API 28+) — required for iconv (libambit)
- USB OTG cable
- NDK r26+ (set in `android/app/build.gradle`)

### Configuration

Create `src/config/secrets.ts` (not committed — never share this file):

```typescript
export const LIVELOX_CLIENT_ID = 'your_client_id';
```

- **Runalyze API key**: enter your personal key in the app Settings screen. Generate it at [runalyze.com/settings/config/account](https://runalyze.com/settings/config/account).
- **Livelox**: OAuth2 flow handled in-app. Requires a registered `client_id` from [livelox.com](https://livelox.com).

### Credits

- [libambit](https://github.com/openambitproject/openambit) — open-source Ambit communication library
- [AmbitSync](https://github.com/starryalley/AmbitSync) — Android USB OTG patch reference

### License

MIT

---

## Français

Application Android pour synchroniser les activités GPS d'une montre Suunto Ambit via USB OTG, les afficher sur une carte et les exporter vers des plateformes d'entraînement.

### Fonctionnalités

- Synchronisation des activités directement depuis la montre via USB OTG (sans Bluetooth)
- Affichage des tracés GPS sur une carte interactive (tuiles IGN via WebView + Leaflet)
- Profil altimétrique avec statistiques D+ / D-
- Affichage du type d'activité (Orientation, Trail, VTT, Cyclisme…)
- Filtres par type d'activité dans la liste
- Base de données SQLite locale — reconstruction automatique depuis les fichiers GPX présents sur l'appareil
- Suppression permanente (les activités supprimées ne sont jamais réimportées lors des synchronisations suivantes)
- Export vers **Livelox** (OAuth2 — analyse de parcours d'orientation)
- Export vers **Runalyze** (format FIT — analyse d'entraînement + envoi vers l'app Suunto)
- Partage GPX / Enregistrement dans les Téléchargements

### Faire apparaître ses activités dans l'app Suunto

Comme l'Ambit 1 n'a pas de BLE et que Movescount est fermé, le chemin vers l'app Suunto officielle est :

**OpenSportsSync → Runalyze (FIT) → App Suunto**

1. Dans OpenSportsSync : ouvrir une activité → exporter → Upload Runalyze
2. Sur [runalyze.com](https://runalyze.com) : Paramètres → Connexions → lier votre compte Suunto
3. Sur la page de l'activité dans Runalyze : Partager → Suunto

### Montres supportées

| Montre | Protocole | Statut |
|--------|-----------|--------|
| Suunto Ambit 1 / 2 / 2S / 2R / 3 | USB OTG (libambit NDK) | ✅ Fonctionnel |
| Suunto Traverse / Traverse Alpha | USB OTG (libambit NDK) | ✅ Supporté |

### Stack technique

- **React Native 0.84** — Bare Workflow, Android uniquement
- **Kotlin** — USB OTG, Android UsbManager, FileDescriptor
- **C++ / NDK** — Pont JNI + [libambit](https://github.com/openambitproject/openambit)
- **react-native-sqlite-storage** — base de données locale
- **react-native-fs** — lecture/écriture GPX et FIT
- **fast-xml-parser** — parsing GPX
- **Encodeur FIT** — TypeScript pur, sans dépendances (`src/services/FitExport.ts`)

### Build

```bash
# 1. Bundler le JS (obligatoire avant chaque build natif)
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 2. Build APK
cd android && ./gradlew assembleDebug

# 3. Installer
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Important :** `assembleDebug` n'embarque PAS le bundle JS automatiquement. Toujours exécuter l'étape 1 après tout changement TypeScript/TSX.

### Prérequis

- Android 9+ (API 28+) — requis pour iconv (libambit)
- Câble USB OTG
- NDK r26+ (configuré dans `android/app/build.gradle`)

### Configuration

Créer `src/config/secrets.ts` (non versionné — ne jamais partager ce fichier) :

```typescript
export const LIVELOX_CLIENT_ID = 'votre_client_id';
```

- **Clé API Runalyze** : à saisir dans l'écran Paramètres de l'app. À générer sur [runalyze.com/settings/config/account](https://runalyze.com/settings/config/account).
- **Livelox** : flux OAuth2 géré dans l'app. Nécessite un `client_id` enregistré auprès de [livelox.com](https://livelox.com).

### Crédits

- [libambit](https://github.com/openambitproject/openambit) — bibliothèque de communication Ambit open source
- [AmbitSync](https://github.com/starryalley/AmbitSync) — référence pour le patch USB OTG Android

### Licence

MIT
