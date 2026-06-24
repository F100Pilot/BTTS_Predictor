import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for packaging the PWA as a native APK/IPA.
 * See docs/APK.md for the full conversion guide.
 */
const config: CapacitorConfig = {
  appId: 'com.bttsanalytics.pro',
  appName: 'BTTS Analytics Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
