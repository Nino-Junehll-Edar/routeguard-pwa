export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface FirebaseNotification {
  title: string;
  body?: string;
  icon?: string;
  data?: Record<string, any>;
}

export function requestFCMPermission(): Promise<string | null>;
export function setupFCMListener(callback: (payload: { notification: FirebaseNotification; data?: Record<string, any> }) => void): () => void;
export function isFCMSupported(): boolean;
