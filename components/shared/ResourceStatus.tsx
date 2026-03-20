type Status = "completed" | "active" | "locked";

interface ResourceStatusProps {
  status: Status;
  className?: string;
}

export default function ResourceStatus({ status, className = "" }: ResourceStatusProps) {
  if (status === "completed") {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-texo-verde/15 text-texo-verde text-sm font-bold ${className}`}
        aria-label="Completado"
      >
        ✓
      </span>
    );
  }

  if (status === "active") {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 ${className}`}
        aria-label="Activo"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-texo-amarillo animate-pulse" />
      </span>
    );
  }

  // locked
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 text-gray-400 text-sm ${className}`}
      aria-label="Bloqueado"
    >
      🔒
    </span>
  );
}
