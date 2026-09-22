"use client";

import { useEffect, useState } from "react";
import { ORIGINAL_CONTRACT, getPassStatus, type PassStatus } from "@/lib/stellar";

const LABELS: Record<PassStatus, string> = {
  none: "sin pase",
  bought: "comprado, sin usar",
  used: "usado",
};

/** Lee ahora mismo, desde la red, el pase del asistente en el contrato original. */
export function OriginalLiveStatus({ guest }: { guest: string }) {
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPassStatus(ORIGINAL_CONTRACT, guest)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [guest]);

  return (
    <p className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${status === "used" ? "bg-ok" : failed ? "bg-bad" : "bg-muted"}`}
      />
      <span className="font-semibold">Leído en vivo de la red:</span>
      <span className="text-muted" aria-live="polite">
        {failed
          ? "no se pudo leer ahora; prueba recargando."
          : status
            ? `el pase del asistente está ${LABELS[status]}.`
            : "consultando el contrato…"}
      </span>
    </p>
  );
}
