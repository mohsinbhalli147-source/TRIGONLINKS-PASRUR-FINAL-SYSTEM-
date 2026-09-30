import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android packaging for the Trigon Links subscriber app.
 *
 * The app is a self-contained static bundle: no server-side rendering, no
 * runtime code loading, no secrets in the binary. Everything sensitive lives in
 * the backend, which is what lets a single build ship to the Play Store.
 */
const config: CapacitorConfig = {
  appId: 'pk.trigonlinks.subscriber',
  appName: 'Trigon Links',
  webDir: 'dist',
  android: {
    // The app is a fixed set of screens; no state should survive an OS kill.
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#020617',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1200,
      backgroundColor: '#020617',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
