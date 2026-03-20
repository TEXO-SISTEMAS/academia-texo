"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Button from "@/components/shared/Button";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  // Pre-compilar /bienvenida para que cargue instantáneo al redirigir
  useEffect(() => {
    router.prefetch("/bienvenida");
    router.prefetch("/artesano/dashboard");
  }, [router]);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const { role } = await login(email.trim().toLowerCase());
      router.replace(
        role === "artesano" ? "/artesano/dashboard" : "/bienvenida"
      );
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
         {/*  <img src="/logo.png" alt="Academia TEXO" style={{ height: "64px", width: "auto", margin: "0 auto 12px" }} /> */}
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Academia TEXO
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Plataforma de autoformación interna
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          {/* <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Ingresá a tu cuenta
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Solo correos autorizados pueden acceder.
          </p> */}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              Ingresar
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
