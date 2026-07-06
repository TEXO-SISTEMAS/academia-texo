"use client";

import { useState, useEffect } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getPendingPasswordChangeToken,
  clearPendingPasswordChangeToken,
} from "@/lib/auth-context";
import { recordLoginBackground } from "@/lib/firestore";
import { setCookie } from "@/lib/cookies";
import Button from "@/components/shared/Button";

function decodeEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export default function CambiarContrasenaPage() {
  const [ready, setReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = getPendingPasswordChangeToken();
    if (!token) {
      window.location.replace("/login");
      return;
    }
    clearPendingPasswordChangeToken();
    const decodedEmail = decodeEmailFromIdToken(token);
    setIdToken(token);
    setEmail(decodedEmail);
    setReady(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (!idToken) {
      setError("Sesión expirada. Volvé a iniciar sesión.");
      return;
    }

    setProcessing(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

      // 1. Cambiar contraseña con el idToken de Firebase
      const updateRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
        }
      );

      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        console.error("[cambiar-contrasena] accounts:update error:", errData);
        throw new Error("Error al cambiar la contraseña. Intentá de nuevo.");
      }

      const updateData = await updateRes.json() as { idToken?: string };
      const newIdToken = updateData.idToken ?? "";

      // 2. Verificar nuevo idToken en el servidor, limpiar forcePasswordChange, obtener custom token
      const completeRes = await fetch("/api/auth/complete-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: newIdToken }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        console.error("[cambiar-contrasena] complete-password-change error:", errData);
        throw new Error("Error al finalizar el cambio. Intentá de nuevo.");
      }

      const { token: customToken } = await completeRes.json() as { token: string };

      // 3. Establecer sesión Firebase con el custom token
      await signInWithCustomToken(auth, customToken);

      setCookie("user-role", "artesano");
      const uid = auth.currentUser?.uid;
      if (uid) recordLoginBackground(uid, navigator.userAgent);

      setSuccess(true);
      setTimeout(() => {
        window.location.replace("/artesano/cursos");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setProcessing(false);
    }
  }

  if (!ready || success) {
    return (
      <div className="min-h-screen bg-texo-azul flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm">{success ? "Contraseña actualizada ✓" : "Cargando..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-texo-azul flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LA_ACADEMIA_NEWSLETTER.png"
            alt="La Academia TEXO"
            style={{ height: "160px", width: "auto", borderRadius: "12px", display: "block", margin: "0 auto 1.5rem" }}
          />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Cambiá tu contraseña
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Por seguridad, establecé una contraseña personal.
          </p>

          {email && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {email}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoFocus
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo focus:border-transparent transition"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí la contraseña"
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-texo-rojo bg-texo-rojo/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={processing}
            >
              {processing ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Grupo TEXO
        </p>
      </div>
    </div>
  );
}
