# FOCUS FLOW 2.0

A responsive, offline-first study timer built with HTML, CSS, JavaScript, Vite and Capacitor.

## Features
- Focus, short-break and long-break timer
- Full-screen focus view
- Optional animated black-hole visualizer
- Pre-start animation controls: enable/disable, intensity, speed, particle count and color
- Normal timer mode with no animation
- Subjects, tasks, session history, CSV export and JSON backup/restore
- Dark and light themes
- Local device storage

## Run locally
```bash
npm install
npm run start
```

## Build web app
```bash
npm run build
```

## Build Android locally
```bash
npm install
npm run build
npx cap add android
npx cap sync android
```
Open the generated `android` folder in Android Studio to build an APK.

## GitHub Actions
Push the project to the `main` branch. Open **Actions**, select **FOCUS FLOW Android APK**, run the workflow, then download the `FOCUS-FLOW-APK` artifact after a successful build.

## Note
The browser Fullscreen API is used for the focus screen. Android system-bar immersive behavior can vary by Android version and device; the APK should be tested on the target phone. Timer accuracy is based on wall-clock time, so it catches up after brief backgrounding.
