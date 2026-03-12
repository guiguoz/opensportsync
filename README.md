# OpenSportsSync

Android app to sync GPS activity logs from Suunto Ambit watches via USB OTG, display them on a map, and export them to training platforms.

## Features

- Sync activity logs directly from the watch via USB OTG (no Bluetooth required)
- Display GPS tracks on an interactive map (IGN tiles via WebView + Leaflet)
- Elevation profile with D+ / D- stats
- Activity type display (Orientation, Trail running, MTB, Cycling…)
- Activity filters by type in the log list
- Local SQLite database — automatic rebuild from GPX files on device
- Permanent deletion (deleted activities are never re-imported on next sync)
- Export to **Livelox** (OAuth2 — orienteering route analysis)
- Export to **Runalyze** (FIT format — training analytics + push to Suunto app)
- Share GPX / Save to Downloads

## Getting activities into the Suunto app

Since the Ambit 1 has no BLE and Movescount is closed, the path to the official Suunto app is:

**OpenSportsSync → Runalyze (FIT) → Suunto app**

1. In OpenSportsSync: open an activity → export → Upload Runalyze
2. On [runalyze.com](https://runalyze.com): Settings → Connections → link your Suunto account
3. On the activity page: Share → Suunto

## Architecture

The app is built around a **hardware-agnostic `DeviceConnector` interface** (`src/native/DeviceConnector.ts`). Each watch brand provides its own connector implementation; the data layer (GPX/FIT, SQLite, exports) is completely independent of the hardware.

**Adding support for a new device** only requires implementing `DeviceConnector`.

## Current hardware support

| Device | Protocol | Status |
|--------|----------|--------|
| Suunto Ambit 1 / 2 / 2S / 2R / 3 | USB OTG (libambit NDK) | ✅ Working |

## Tech stack

- **React Native 0.84** — Bare Workflow, Android only
- **Kotlin** — USB OTG, Android UsbManager, FileDescriptor
- **C++ / NDK** — JNI bridge + [libambit](https://github.com/openambitproject/openambit)
- **react-native-sqlite-storage** — local activity database
- **react-native-fs** — GPX/FIT file read/write
- **fast-xml-parser** — GPX parsing
- **FIT encoder** — pure TypeScript, no dependencies (`src/services/FitExport.ts`)

## Build

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

## Requirements

- Android 9+ (API 28+) — required for iconv (libambit)
- USB OTG cable
- NDK r26+ (set in `android/app/build.gradle`)

## Configuration

Create `src/config/secrets.ts` (not committed):

```typescript
export const LIVELOX_CLIENT_ID = 'your_client_id';
```

- **Runalyze API key**: enter your personal key in the app Settings screen (⚙ on the home screen). Generate it at [runalyze.com/settings/config/account](https://runalyze.com/settings/config/account).
- **Livelox**: OAuth2 flow handled in-app. Requires a registered `client_id` from [livelox.com](https://livelox.com).

## Credits

- [libambit](https://github.com/openambitproject/openambit) — open-source Ambit communication library
- [AmbitSync](https://github.com/starryalley/AmbitSync) — Android USB OTG patch reference

## License

MIT
