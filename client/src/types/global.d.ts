// Global type declarations
interface Window {
  pwa?: {
    installPWA: () => void;
  };
  lastAutoSaveNotification: number;
}