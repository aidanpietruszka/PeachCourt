import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-east1");

if (import.meta.env.VITE_USE_EMULATORS === "true") {
  const authPort = import.meta.env.VITE_EMU_AUTH_PORT ?? "9099";
  const firestorePort = Number(import.meta.env.VITE_EMU_FIRESTORE_PORT ?? "8080");
  const functionsPort = Number(import.meta.env.VITE_EMU_FUNCTIONS_PORT ?? "5001");
  connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, "127.0.0.1", firestorePort);
  connectFunctionsEmulator(functions, "127.0.0.1", functionsPort);
}
