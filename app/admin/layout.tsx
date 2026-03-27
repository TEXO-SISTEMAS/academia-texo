import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const ADMIN_LINKS = [
  { label: "Dashboard", href: "/artesano/dashboard" },
  { label: "Mis Propedéuticos", href: "/artesano/cursos" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-texo-dark flex flex-col">
      <Navbar links={ADMIN_LINKS} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
