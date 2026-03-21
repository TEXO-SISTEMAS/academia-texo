"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Button from "@/components/shared/Button";

export default function LoginPage() {
  const { login, loginWithPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const result = await login(email.trim().toLowerCase());
      console.log("[login] result:", result);

      if ("requiresPassword" in result && result.requiresPassword) {
        // Artesano — mostrar campo de contraseña
        setRequiresPassword(true);
        setProcessing(false);
        return;
      }

      const role = (result as { role: string }).role;
      window.location.replace(role === "artesano" ? "/artesano/dashboard" : "/bienvenida");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar. Intentá de nuevo.");
      setProcessing(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const { role } = await loginWithPassword(email.trim().toLowerCase(), password);
      window.location.replace(role === "artesano" ? "/artesano/dashboard" : "/bienvenida");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar. Intentá de nuevo.");
      setProcessing(false);
    }
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-texo-azul flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-texo-azul flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "1.5rem" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#E8B84B" strokeWidth="2"/>
              <line x1="24" y1="2" x2="24" y2="46" stroke="#E8B84B" strokeWidth="2"/>
              <line x1="2" y1="24" x2="46" y2="24" stroke="#E8B84B" strokeWidth="2"/>
              <line x1="8" y1="8" x2="40" y2="40" stroke="#E8B84B" strokeWidth="1.5"/>
              <line x1="40" y1="8" x2="8" y2="40" stroke="#E8B84B" strokeWidth="1.5"/>
            </svg>
            <div>
              <div style={{ color: "white", fontSize: "22px", fontWeight: "800", letterSpacing: "0.06em", lineHeight: 1 }}>ACADEMIA</div>
              <div style={{ color: "#E8B84B", fontSize: "14px", fontWeight: "600", letterSpacing: "0.15em" }}>TEXO</div>
            </div>
          </div>
          <p className="text-white/60 text-sm mt-1">
            Plataforma de autoformación interna
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          {!requiresPassword ? (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@grupotexo.com"
                  required
                  autoComplete="email"
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
                Continuar
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Ingresando como{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {email}
                  </span>
                </p>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  autoComplete="current-password"
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
                Ingresar
              </Button>

              <button
                type="button"
                onClick={() => {
                  setRequiresPassword(false);
                  setError(null);
                  setPassword("");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-center transition"
              >
                ← Cambiar correo
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} Grupo TEXO
        </p>
      </div>
    </div>
  );
}
