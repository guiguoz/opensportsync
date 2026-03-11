# AmbitSync Modern - Architecture & Specs

## Objectif du projet
Application Android (React Native Bare Workflow) pour usage personnel. 
Permet de connecter une montre Suunto Ambit 1 via câble USB OTG, d'extraire les logs d'activité (C++/Kotlin), de les afficher sur une carte IGN, et de les exporter vers Livelox, Suunto API, ou Vikazimut.

## Stack Technique
- **Frontend** : React Native (CLI), React Navigation.
- **Cartographie** : `react-native-maps` (UrlTile pour tuiles IGN/OSM).
- **Base de données** : `react-native-sqlite-storage` (suivi des synchros).
- **Fichiers** : `react-native-fs` (lecture/écriture GPX, FIT, SGEE).
- **Couche Native (Android)** : Kotlin (UsbManager, FileDescriptor) + NDK/C++ (JNI + libambit + libusb).

## Structure des dossiers à créer
/src
  /components     # Boutons, cartes, listes
  /screens        # HomeScreen, MapScreen, LogListScreen
  /services       # ApiLivelox.ts, ApiSuunto.ts, VikazimutExport.ts
  /native         # Modules natifs (AmbitUsbModule.ts)
  /database       # db.ts (SQLite helper)
/android/app/src/main/cpp   # Code C++ (JNI, libambit, CMakeLists.txt)
/android/app/src/main/java/com/ambitsyncmodern/usb # Code Kotlin

## Fonctionnalités Principales (Sprints)
1. **Sprint 1 : Pont USB (Kotlin/C++)** 
   - Détection de l'Ambit (VID/PID).
   - Demande de permission USB et récupération du File Descriptor.
   - Appel JNI d'initialisation.
2. **Sprint 2 : Extraction & Base locale**
   - Récupération des logs (C++).
   - Stockage des ID dans SQLite (évite les doublons).
   - Écriture du fichier `.gpx` via RN FS.
3. **Sprint 3 : UI & Cartographie**
   - Parsing du GPX (`fast-xml-parser`).
   - Affichage sur `<MapView>` avec tuiles IGN (`https://wxs.ign.fr/...`).
4. **Sprint 4 : APIs & Exports**
   - Mise à jour SGEE (GPS Ephémérides).
   - Authentification Livelox (OAuth2).
   - Génération fichier XML Vikazimut.
