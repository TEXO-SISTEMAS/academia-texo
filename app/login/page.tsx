"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { loginWithGoogle, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("popup-closed") && !msg.includes("cancelled")) {
        setError("No se pudo iniciar sesión con Google. Intentá de nuevo.");
      }
      setLoadingGoogle(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoadingEmail(true);
    try {
      await sendMagicLink(email.trim());
      setEmailSent(true);
    } catch {
      setError("No se pudo enviar el link. Verificá el correo e intentá de nuevo.");
      setLoadingEmail(false);
    }
  }

  return (
    <div className="min-h-screen bg-texo-azul flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LA_ACADEMIA_NEWSLETTER.png"
            alt="La Academia TEXO"
            style={{ height: "160px", width: "auto", borderRadius: "12px", display: "block", margin: "0 auto 1.5rem" }}
          />
          <p className="text-white/60 text-sm">Plataforma de autoformación interna</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 flex flex-col gap-4">
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Ingresá a La Academia</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Elegí cómo querés ingresar</p>
          </div>

          {error && (
            <p className="text-sm text-texo-rojo bg-texo-rojo/10 px-3 py-2 rounded-lg text-center">
              {error}
            </p>
          )}

          {emailSent ? (
            <div className="text-center py-2">
              <div className="text-3xl mb-3">📬</div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">¡Link enviado!</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Revisá tu correo <span className="font-medium">{email}</span> y hacé click en el link para ingresar.
              </p>
              <button
                onClick={() => { setEmailSent(false); setEmail(""); }}
                className="mt-4 text-xs text-texo-verde underline"
              >
                Usar otro correo
              </button>
            </div>
          ) : (
            <>
              {/* Email magic link */}
              <form onSubmit={handleEmail} className="flex flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  required
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-verde"
                />
                <button
                  type="submit"
                  disabled={loadingEmail || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-texo-verde hover:bg-texo-verde/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingEmail ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  )}
                  {loadingEmail ? "Enviando..." : "Ingresar con correo"}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">o</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={loadingGoogle}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingGoogle ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-texo-verde rounded-full animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {loadingGoogle ? "Iniciando sesión..." : "Continuar con Google"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Desarrollado por Danilo Sosa | Texo Sistemas
        </p>
      </div>
    </div>
  );
}
