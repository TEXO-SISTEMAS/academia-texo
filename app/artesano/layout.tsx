import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const ARTESANO_LINKS = [
  { label: "Materiales", href: "/artesano/dashboard" },
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
