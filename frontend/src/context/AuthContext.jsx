import { createContext, useState, useEffect, useCallback, useRef } from "react";
import {
  auth, googleProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "../config/firebase";
import { authAPI } from "../services/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [fbUser,  setFbUser]  = useState(null);
  const [dbUser,  setDbUser]  = useState(null);
  const [loading, setLoading] = useState(true);
  const syncAbort = useRef(null);

  const syncDb = useCallback(async () => {
    syncAbort.current?.abort();
    const controller = new AbortController();
    syncAbort.current = controller;
    try {
      const r = await authAPI.me();
      if (!controller.signal.aborted)
        setDbUser(r.data.data?.user || r.data.data || null);
    } catch {
      if (!controller.signal.aborted) setDbUser(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) {
        await u.getIdToken(true); 
        await syncDb();          
      } else {
        syncAbort.current?.abort();
        setDbUser(null);
      }
      setLoading(false); 
    });
    return () => { unsub(); syncAbort.current?.abort(); };
  }, [syncDb]);

  const login = async (email, password) => {
    const c = await signInWithEmailAndPassword(auth, email, password);

    await c.user.getIdToken(true);

    try {
      await authAPI.login();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        await signOut(auth);
        throw new Error('No account found. Please register first.');
      }
      if (status === 401 || status === 403) {
        await signOut(auth);
        throw err;
      }
    }

    await syncDb();
    return c.user;
  };

  const loginWithGoogle = async (extra) => {
    const c = await signInWithPopup(auth, googleProvider);
    await c.user.getIdToken(true);

    try {
      await authAPI.login();
    } catch (err) {
      const status = err?.response?.status;

      if (status === 404) {
        try {
          await authAPI.register({
            name:        c.user.displayName || 'Farmer',
            email:       c.user.email,
            firebaseUid: c.user.uid,
            ...extra,
          });
        } catch (regErr) {
          await signOut(auth);
          throw regErr;
        }
      } else if (status === 401 || status === 403) {
        await signOut(auth);
        throw err;
      }
    }

    await syncDb();
    return c.user;
  };

  const register = async ({ email, password, name, phone, farm }) => {
    const c = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await authAPI.register({ name, email, phone, firebaseUid: c.user.uid, farm });
    } catch (err) {
      await c.user.delete();
      throw err;
    }
    await syncDb();
    return c.user;
  };

  const logout = async () => {
    syncAbort.current?.abort();
    await signOut(auth);
    setFbUser(null);
    setDbUser(null);
  };

  const value = {
    fbUser,
    dbUser,
    loading,
    isAdmin:    dbUser?.role === 'admin',
    activeFarm: dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0],
    farmId:     dbUser?.farms?.[dbUser?.activeFarmIndex ?? 0]?._id?.toString() || '0',
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword: (e) => sendPasswordResetEmail(auth, e),
    syncDb,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { Ctx as AuthContext };