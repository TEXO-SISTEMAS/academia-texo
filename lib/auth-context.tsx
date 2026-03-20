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
  signInWithCustomToken,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getOrCreateUser } from "@/lib/firestore";
import { setCookie, deleteCookie } from "@/lib/cookies";
import type { UserRole } from "@/types";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userRole: UserRole | null;
  loading: boolean;
  login: (email: string) => Promise<{ role: UserRole }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // Leer el role del custom token claim para que getOrCreateUser
          // cree el doc con el rol correcto en el primer login
          const tokenResult = await fbUser.getIdTokenResult();
          const claimedRole = tokenResult.claims.role as UserRole | undefined;

          const user = await getOrCreateUser(
            fbUser.uid,
            fbUser.email ?? "",
            claimedRole
          );
          // El claim del token es autoritativo — si existe, usarlo para la cookie
          const effectiveRole: UserRole = claimedRole ?? user.role;
          setFirebaseUser(fbUser);
          setUserRole(effectiveRole);
          setCookie("user-role", effectiveRole);
        } catch (error) {
          console.error("Error al obtener usuario:", error);
          // El usuario SÍ está autenticado en Firebase Auth — no borrarlo.
          // Solo limpiar el rol si no se pudo leer de Firestore.
          setFirebaseUser(fbUser);
          setUserRole(null);
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

  async function login(email: string): Promise<{ role: UserRole }> {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      if (data.error === "not_authorized") {
        throw new Error("Tu correo no está autorizado. Contactá al administrador.");
      }
      throw new Error("Error al verificar acceso. Intentá de nuevo.");
    }

    await signInWithCustomToken(auth, data.token);

    // Setear la cookie ANTES de retornar para que el middleware la lea
    // correctamente al hacer el redirect — no esperar a onAuthStateChanged
    const role = data.role as UserRole;
    setCookie("user-role", role);

    return { role };
  }

  async function logout(): Promise<void> {
    await signOut(auth);
    deleteCookie("user-role");
  }

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userRole, loading, login, logout }}
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
