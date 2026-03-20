import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academia TEXO",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              success: { style: { background: "#31484E", color: "white", border: "1px solid #3A9688" } },
              error: { style: { background: "#31484E", color: "white", border: "1px solid #C0544A" } },
              loading: { style: { background: "#31484E", color: "white", border: "1px solid #E8B84B" } },
              duration: 3000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
