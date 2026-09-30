// Import and configure dotenv to load .env file
import 'dotenv/config';

import { initializeApp } from 'firebase/app';
// We don't initialize messaging in Node.js because it requires window object
// import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Check that all required values are present
const missing = [];
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    missing.push(key);
  }
}
if (missing.length > 0) {
  console.error('❌ Missing Firebase configuration values:', missing.join(', '));
  process.exit(1);
}

try {
  const app = initializeApp(firebaseConfig);
  console.log('✅ Firebase App initialized successfully!');
  console.log('   App name:', app.name);
  console.log('   Project ID:', firebaseConfig.projectId);
  console.log('   Auth Domain:', firebaseConfig.authDomain);
  // In a browser, you would also initialize messaging:
  // const messaging = getMessaging(app);
  // console.log('   Messaging initialized:', !!messaging);
} catch (error) {
  console.error('❌ Firebase App initialization failed:', error);
  process.exit(1);
}