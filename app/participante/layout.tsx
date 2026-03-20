import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";

const PARTICIPANTE_LINKS = [
  { label: "Propedéuticos", href: "/participante/dashboard" },
];

export default function ParticipanteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-texo-dark flex flex-col">
      <Navbar links={PARTICIPANTE_LINKS} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
