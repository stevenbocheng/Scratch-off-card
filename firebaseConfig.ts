import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

let db;
try {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
    // Already initialized (e.g. Vite HMR), reuse existing instance
    db = getFirestore(app);
}

export { db };
