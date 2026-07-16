"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getOrCreateUser, recordLoginBackground } from "@/lib/firestore";
import { setCookie, deleteCookie } from "@/lib/cookies";
import type { UserRole } from "@/types";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userRole: UserRole | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function getRoleForEmail(email: string): Promise<UserRole> {
  const snap = await getDoc(doc(db, "allowedUsers", email));
  if (snap.exists() && snap.data().role === "artesano") return "artesano";
  return "participante";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const role = await getRoleForEmail(fbUser.email ?? "");
          await getOrCreateUser(fbUser.uid, fbUser.email ?? "", role, fbUser.displayName ?? undefined);
          setFirebaseUser(fbUser);
          setUserRole(role);
          setCookie("user-role", role);
        } catch {
          setFirebaseUser(fbUser);
          setUserRole("participante");
          setCookie("user-role", "participante");
        }
      } else {
        setFirebaseUser(null);
        setUserRole(null);
        deleteCookie("user-role");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email ?? "";
    const role = await getRoleForEmail(email);
    const displayName = result.user.displayName ?? undefined;
    await getOrCreateUser(result.user.uid, email, role, displayName);
    setCookie("user-role", role);
    recordLoginBackground(result.user.uid, navigator.userAgent);
    window.location.replace(
      role === "artesano" ? "/artesano/dashboard" : "/participante/dashboard"
    );
  }

  async function logout(): Promise<void> {
    await signOut(auth);
    deleteCookie("user-role");
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userRole, loading, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
