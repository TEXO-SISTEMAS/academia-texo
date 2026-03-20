"use client";

import toast from "react-hot-toast";
import type { Toast } from "react-hot-toast";

interface Props {
  t: Toast;
  message: string;
  onConfirm: () => void;
}

export default function ConfirmToast({ t, message, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-3 min-w-[240px]">
      <p className="text-sm text-texo-amarillo font-medium leading-snug">{message}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            onConfirm();
          }}
          className="text-xs px-3 py-1.5 rounded-lg bg-texo-rojo text-white font-semibold hover:bg-texo-rojo/90 transition-colors"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

/** Helper para mostrar un ConfirmToast de forma consistente en toda la app. */
export function confirmToast(message: string, onConfirm: () => void) {
  toast(
    (t) => <ConfirmToast t={t} message={message} onConfirm={onConfirm} />,
    { duration: Infinity, style: { background: "#31484E", color: "white" } }
  );
}
