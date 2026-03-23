"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface NavbarProps {
  /** Links shown in the nav. Defaults to empty. */
  links?: { label: string; href: string }[];
}

export default function Navbar({ links = [] }: NavbarProps) {
  const { firebaseUser, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("");

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const fallback = uid.includes("@") ? uid.split("@")[0] : (firebaseUser.email?.split("@")[0] ?? uid);
    getDoc(doc(db, "allowedUsers", uid))
      .then((snap) => {
        setUserName(snap.exists() && snap.data().name ? snap.data().name as string : fallback);
      })
      .catch(() => setUserName(fallback));
  }, [firebaseUser]);

  const displayName = userName || firebaseUser?.email?.split("@")[0] || "";
  const isAdmin =
    firebaseUser?.uid === "danilo.sosa@texo.com.py" ||
    firebaseUser?.email === "danilo.sosa@texo.com.py";

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <nav className="bg-texo-azul text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Academia TEXO" style={{ height: "40px", width: "auto" }} />
        </Link>

        {/* Desktop links */}
        {(links.length > 0 || isAdmin) && (
          <div className="hidden md:flex items-center gap-1 ml-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 rounded text-sm hover:bg-white/10 transition-colors relative after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-texo-amarillo after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200"
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded text-sm bg-texo-amarillo/20 text-texo-amarillo hover:bg-texo-amarillo/30 transition-colors font-medium"
              >
                Admin
              </Link>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Alternar modo oscuro"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-base"
          >
            {mounted ? (resolvedTheme === "dark" ? "☀️" : "🌙") : <span className="w-4 h-4" />}
          </button>

          {/* User display name — desktop */}
          {displayName && (
            <span className="hidden md:block text-sm text-white/80 max-w-[160px] truncate">
              Hola, {displayName}
            </span>
          )}

          {/* Logout — desktop */}
          {firebaseUser && (
            <button
              onClick={handleLogout}
              className="hidden md:block text-sm px-3 py-1.5 rounded border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              Salir
            </button>
          )}

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
            className="md:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-lg"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden bg-texo-azul border-t border-white/10 px-4 py-3 flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="px-3 py-2 rounded text-sm text-texo-amarillo font-medium hover:bg-white/10 transition-colors"
            >
              Admin
            </Link>
          )}
          {displayName && (
            <p className="px-3 py-1 text-sm text-white/70">Hola, {displayName}</p>
          )}
          {firebaseUser && (
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="text-left px-3 py-2 rounded text-sm hover:bg-white/10 transition-colors"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
