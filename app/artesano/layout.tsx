import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const ARTESANO_LINKS = [
  { label: "Progreso", href: "/artesano/dashboard" },
  { label: "Mis Propedéuticos", href: "/artesano/cursos" },
];

export default function ArtesanoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-texo-dark flex flex-col">
      <Navbar links={ARTESANO_LINKS} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
