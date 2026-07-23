import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDV8crh8_jaUIUgf2WATzMU1VaE240FcE8",
  authDomain: "china-2026-bebroggi.firebaseapp.com",
  projectId: "china-2026-bebroggi",
  storageBucket: "china-2026-bebroggi.firebasestorage.app",
  messagingSenderId: "224958863863",
  appId: "1:224958863863:web:656ae70a69d71d731b76f2",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

try {
  initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // In sviluppo l'istanza può esistere già dopo un aggiornamento rapido.
}

export const db = getFirestore(app);
