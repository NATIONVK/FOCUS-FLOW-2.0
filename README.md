# FOCUS FLOW 2.0

Premium, offline-first study timer built with Vite, JavaScript and Capacitor.

## Features
- Pomodoro, Deep Focus, Short Break, Long Break, Custom timer and Stopwatch
- Deadline-based timer recovery after app suspension
- Black-hole style animated timer background with colour themes
- IndexedDB storage for sessions, tasks and notes
- Daily focus statistics and CSV export
- JSON backup and restore
- Dark/light theme
- Optional Capacitor haptics and local notifications
- Android debug APK build through GitHub Actions

## Run locally
Requires Node.js 22+.

```bash
npm install
npm run dev
```

## Build Android
```bash
npm install
npm run build
npx cap add android
npx cap sync android
```
Open the generated `android` folder in Android Studio to build, or use the included GitHub Actions workflow to create a debug APK.

The GitHub Actions artifact is a **debug APK**, not a Play Store-signed release. Background notification delivery depends on Android permissions and OS battery settings.
