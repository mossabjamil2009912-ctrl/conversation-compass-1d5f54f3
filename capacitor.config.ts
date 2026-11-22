import type { CapacitorConfig } from "@capacitor/cli";

// The app runs from its installed local bundle; updates are only applied when the user taps "تحديث التطبيق".
const config: CapacitorConfig = {
  appId: "com.actes.crm",
  appName: "ACTES",
  webDir: "dist/client",
  plugins: { CapacitorUpdater: { autoUpdate: false } },
};
export default config;
