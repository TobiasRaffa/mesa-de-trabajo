// Un aviso, en un renglón.
//
// Lo comparten la bandeja de Notificaciones y la campana del tablero. Existe
// para que los dos dibujen lo mismo: dos listas escritas aparte se separan con
// el tiempo, y la que se toca menos termina mostrando una cosa distinta.
//
// Cada renglón dice también si el aviso salió por correo y a quién. Un aviso
// que quedó sin mandar no es un error escondido en un registro: se ve al lado
// del aviso.
//
// **Lo que se repite en todos los renglones no se dibuja.** El nombre del
// cliente iba cosido adentro del texto y el «para Nari» al final: con
// cincuenta avisos eran cincuenta renglones que empezaban y terminaban igual,
// y el ojo tiene que saltear las dos puntas para llegar a lo que pasó. El
// cliente se dibuja aparte y solo cuando la lista mezcla varios; el «para» solo
// cuando el aviso **no** es para vos, que es la única vez que dice algo.

import Link from "next/link";
import type { AvisoMio } from "@/lib/avisos";

import { enPalabrasLaFecha, enPalabrasSoloLaHora } from "@/dominio/tiempo";
import { enCastellano } from "@/dominio/texto";

const COMO_SALIO: Record<AvisoMio["correo"], { texto: string; estilo: string } | null> = {
  enviado: { texto: "por correo", estilo: "text-apagado" },
  sin_configurar: null,
  // **Dice el motivo, no lo que parece.** Decía «sin asignar», que en el resto
  // de la aplicación quiere decir «nadie lleva esta carpeta», y encima venía
  // seguido del detalle con la misma frase otra vez.
  sin_destinatario: { texto: "no salió: nadie con correo", estilo: "text-espera" },
  fallo: { texto: "no salió el correo", estilo: "text-alerta" },
};

/**
 * Qué avisos piden algo tuyo, y cuáles son para enterarse.
 *
 * Un pedido de cambios hay que hacerlo; que el cliente aprobó, no. Se leían
 * todos con la misma letra y en el mismo gris, así que la lista era un muro
 * parejo donde lo que hay que atender no salta.
 */
const PIDE_ALGO: ReadonlySet<AvisoMio["clase"]> = new Set([
  "pidio_extra",
  "pidio_cambios",
  "escribio",
  "vencio",
]);

/**
 * El texto del aviso, sin el nombre del cliente pegado adelante.
 *
 * Lo guardado antes del cambio lo lleva cosido —«Cafe Otoño: Aprobó…»— y el
 * renglón ahora dibuja el cliente aparte: sin esto, un aviso viejo en una
 * lista de varios clientes diría el nombre dos veces seguidas.
 */
function sinElCliente(aviso: AvisoMio): string {
  const prefijo = `${aviso.cliente}: `;
  return aviso.texto.startsWith(prefijo) ? aviso.texto.slice(prefijo.length) : aviso.texto;
}

/** A quién le tocaba, sea uno o varios. */
function aQuienes(aviso: AvisoMio): string[] {
  if (aviso.paraQuienes?.length) return aviso.paraQuienes;
  return aviso.paraQuien ? [aviso.paraQuien] : [];
}

/**
 * A dónde lleva.
 *
 * Un mensaje se lee **en la conversación de ese cliente**: dejaba en la lista
 * de Conversaciones, o sea a un toque más de lo único que el aviso nombra, y
 * el link directo ya existía —lo usa el globo de mensajes sin leer—.
 */
export function aDondeLleva(aviso: AvisoMio): string {
  return aviso.clase === "escribio"
    ? `/gestion/chats?abrir=${encodeURIComponent(aviso.clienteId)}`
    : `/gestion/cliente/${aviso.clienteId}/carpeta/${aviso.carpetaId}?desde=notificaciones`;
}

export function RenglonDeAviso({
  aviso,
  nueva = false,
  /** Qué hacer al tocar el enlace, además de ir: la campana se cierra. */
  alIr,
  /** Cómo te llamás, para no decirte «para vos» cincuenta veces. */
  yo,
  /** La lista mezcla varios clientes: hace falta decir de cuál es cada uno. */
  conCliente = true,
  /** Ya hay un separador de día arriba: alcanza con la hora. */
  soloLaHora = false,
}: {
  aviso: AvisoMio;
  nueva?: boolean;
  alIr?: () => void;
  yo?: string;
  conCliente?: boolean;
  soloLaHora?: boolean;
}) {
  const salida = COMO_SALIO[aviso.correo];
  const quienes = aQuienes(aviso);
  // Nada si sos el único; «para Tomás» si es de otro; «para Tomás y vos» si
  // son varios. Lo que importa es enterarse de cuándo **no** es tuyo.
  const otros = yo ? quienes.filter((q) => q !== yo) : quienes;
  const paraDecir =
    otros.length === 0
      ? null
      : enCastellano(quienes.length > otros.length ? [...otros, "vos"] : otros);

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
        {soloLaHora ? enPalabrasSoloLaHora(aviso.cuando) : enPalabrasLaFecha(aviso.cuando)}
      </span>
      <Link
        href={aDondeLleva(aviso)}
        onClick={alIr}
        className={`min-w-0 flex-1 text-normal underline-offset-4 hover:underline ${
          PIDE_ALGO.has(aviso.clase) ? "font-semibold text-acento" : ""
        }`}
      >
        {conCliente && (
          <span className="mr-1.5 font-bold tracking-tight text-tinta">{aviso.cliente}</span>
        )}
        {sinElCliente(aviso)}
      </Link>
      {paraDecir && (
        <span className="shrink-0 text-micro text-apagado">para {paraDecir}</span>
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
