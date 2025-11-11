import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rougee.app',
  appName: 'ROUGEE',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

