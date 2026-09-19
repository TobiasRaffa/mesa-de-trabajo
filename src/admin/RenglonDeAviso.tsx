// Un aviso, en un renglón.
//
// Lo comparten la bandeja de Notificaciones y la campana del tablero. Existe
// para que los dos dibujen lo mismo: dos listas escritas aparte se separan con
// el tiempo, y la que se toca menos termina mostrando una cosa distinta.
//
// Cada renglón dice también si el aviso salió por correo y a quién. Un aviso
// que quedó sin mandar no es un error escondido en un registro: se ve al lado
// del aviso.

import Link from "next/link";
import type { Aviso } from "@/lib/avisos";

const cuando = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const COMO_SALIO: Record<Aviso["correo"], { texto: string; estilo: string } | null> = {
  enviado: { texto: "por correo", estilo: "text-apagado" },
  sin_configurar: null,
  sin_destinatario: { texto: "sin asignar", estilo: "text-espera" },
  fallo: { texto: "no salió el correo", estilo: "text-alerta" },
};

/** A quién le tocaba, sea uno o varios. */
function aQuienes(aviso: Aviso): string[] {
  if (aviso.paraQuienes?.length) return aviso.paraQuienes;
  return aviso.paraQuien ? [aviso.paraQuien] : [];
}

/** A dónde lleva: un mensaje se lee en Conversaciones; lo demás, en su carpeta. */
export function aDondeLleva(aviso: Aviso): string {
  return aviso.clase === "escribio"
    ? "/gestion/chats"
    : `/gestion/cliente/${aviso.clienteId}/carpeta/${aviso.carpetaId}`;
}

export function RenglonDeAviso({
  aviso,
  nueva = false,
  /** Qué hacer al tocar el enlace, además de ir: la campana se cierra. */
  alIr,
}: {
  aviso: Aviso;
  nueva?: boolean;
  alIr?: () => void;
}) {
  const salida = COMO_SALIO[aviso.correo];
  const quienes = aQuienes(aviso);

  return (
    <li
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-linea px-4 py-3 ${
        nueva ? "bg-lima-tenue" : ""
      }`}
    >
      {nueva && (
        <span
          aria-label="Nueva"
          className="h-2 w-2 shrink-0 self-center rounded-full bg-acento"
        />
      )}
      <span className="cifras shrink-0 font-mono text-micro text-apagado">
        {cuando.format(new Date(aviso.cuando))}
      </span>
      <Link
        href={aDondeLleva(aviso)}
        onClick={alIr}
        className="min-w-0 flex-1 text-normal underline-offset-4 hover:underline"
      >
        {aviso.texto}
      </Link>
      {quienes.length > 0 && (
        <span className="shrink-0 text-micro text-apagado">para {quienes.join(", ")}</span>
      )}
      {salida && (
        <span className={`shrink-0 text-micro ${salida.estilo}`}>
          {salida.texto}
          {aviso.detalleDelCorreo && ` · ${aviso.detalleDelCorreo}`}
        </span>
      )}
    </li>
  );
}
