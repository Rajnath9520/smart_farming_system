import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "firebase/auth";
import { getDatabase, ref, onValue, off, get, set } from "firebase/database";

// const cfg = {
//   apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "demo-key",
//   authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "demo.firebaseapp.com",
//   projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "demo-project",
//   databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL        || "https://demo-default-rtdb.firebaseio.com",
//   storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "demo.appspot.com",
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456",
//   appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "1:123456:web:abc",
// };

const cfg = {
  apiKey: "AIzaSyAEPFzvi7HHwWgNYPR2ltLIDSlYayPPX1w",
  authDomain: "smart-irrigation-c643b.firebaseapp.com",
  databaseURL: "https://smart-irrigation-c643b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-irrigation-c643b",
  storageBucket: "smart-irrigation-c643b.firebasestorage.app",
  messagingSenderId: "945558472230",
  appId: "1:945558472230:web:0702498cab7d233ad488e7",
  measurementId: "G-T928C16S17"
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