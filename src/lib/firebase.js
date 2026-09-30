// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration - replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Initialize Firebase only if we have a config
let app = null;
let messaging = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase initialization failed:', error);
}

// Request permission and get FCM token
export async function requestFCMPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return null;
  }

  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
      });
      return token;
    } else {
      console.warn('Notification permission not granted');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Listen for incoming FCM messages
export function setupFCMListener(onMessageCallback) {
  if (!messaging) {
    console.warn('Firebase Messaging not initialized');
    return;
  }

  return onMessage(messaging, onMessageCallback);
}

// Check if FCM is supported
export function isFCMSupported() {
  return !!messaging && 'serviceWorker' in navigator;
}