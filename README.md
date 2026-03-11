# OpenSportsSync

Android app to sync GPS activity logs from sports watches, display them on a map, and export them to platforms like Livelox or Vikazimut.

## Architecture

The app is built around a **hardware-agnostic `DeviceConnector` interface** (`src/native/DeviceConnector.ts`). Each watch brand provides its own connector implementation; the data layer (GPX, SQLite, exports) is completely independent of the hardware.

```
src/native/DeviceConnector.ts   ← generic interface
src/native/AmbitUsbModule.ts    ← Suunto Ambit implementation (USB OTG + libambit NDK)
```

**Adding support for a new device** only requires implementing `DeviceConnector` — no changes needed in the data or UI layers.

## Current hardware support

| Device | Protocol | Status |
|--------|----------|--------|
| Suunto Ambit 1 / 2 / 2S / 2R / 3 | USB OTG (libambit NDK) | Working |

## Features

- Sync activity logs directly from the watch via USB OTG
- Display GPS tracks on an interactive map (OSM/IGN tiles via WebView+Leaflet)
- Activity type display (Orientation, Trail running, MTB, Cycling…)
- Local SQLite database with automatic rebuild from GPX files
- Export to **Livelox** (OAuth2)
- Export to **Vikazimut** (.csv)
- Update GPS ephemerides (SGEE) on the watch

## Tech stack

- **React Native 0.84** — Bare Workflow, Android only
- **Kotlin** — USB OTG, Android UsbManager, FileDescriptor
- **C++ / NDK** — JNI bridge + [libambit](https://github.com/openambitproject/openambit)
- **react-native-sqlite-storage** — local activity database
- **react-native-fs** — GPX file read/write
- **fast-xml-parser** — GPX parsing

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

- **Livelox API**: set `LIVELOX_CLIENT_ID` and `LIVELOX_CLIENT_SECRET` in `src/services/ApiLivelox.ts`
- **IGN tiles**: set your IGN API key in `src/screens/MapScreen.tsx` (optional, falls back to OSM)

## Credits

- [libambit](https://github.com/openambitproject/openambit) — open-source Ambit communication library
- [AmbitSync](https://github.com/starryalley/AmbitSync) — Android USB OTG patch reference

## License

MIT
