import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp({
  ...firebaseConfig,
  databaseURL: `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com/`
});

// Export services
export const auth = getAuth(app);
export const db = getDatabase(app); // Realtime Database

export default app;
