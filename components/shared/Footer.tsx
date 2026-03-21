export default function Footer() {
  return (
    <footer className="border-t-2 border-texo-amarillo bg-texo-azul h-12 flex items-center px-6 shrink-0">
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <span className="text-white/80 text-sm">Danilo Sosa | Texo Sistemas 2026</span>
        <span className="text-white/60 text-sm">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
