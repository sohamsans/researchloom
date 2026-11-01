import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sohamsans.researchloom',
  appName: 'ResearchLoom (Samhita)',
  webDir: 'dist',
  backgroundColor: '#07080a',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#07080a'
  }
};

export default config;
