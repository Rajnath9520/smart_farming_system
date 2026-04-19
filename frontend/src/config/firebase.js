import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "firebase/auth";
import { getDatabase, ref, onValue, off, get, set } from "firebase/database";

const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,            
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ,     
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,     
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,       
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,      
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementID:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,              
};



const app = initializeApp(cfg);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged, sendPasswordResetEmail,
  ref, onValue, off, get, set,
};
export default app;