import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Mirfa Transport',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
  }
};

export default config;