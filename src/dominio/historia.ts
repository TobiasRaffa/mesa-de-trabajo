// Qué cosas le pueden pasar a una pieza, y cómo se cuenta cada una.
//
// **Está separado de `lib/piezas.ts` por la misma razón que `dias.ts` lo está
// de `plazos.ts`**: esto lo necesita una pantalla, y aquello lee y escribe
// archivos. Importarlo desde el navegador arrastraba `node:fs` al paquete del
// cliente y **rompía la compilación entera**, con un mensaje que no nombra al
// culpable ni al que lo importó.
//
// La regla que deja: lo que una pantalla necesita saber va en un módulo que no
// toque el servidor. De acá no se importa nada fuera de `dominio/`, que es el
// resto de lo que el navegador puede leer sin arrastrar `node:fs`.

import { enCastellano } from "@/dominio/texto";

/** Cada cosa que puede pasarle a una pieza y queda anotada. */
export type Hito =
  | "entregada"
  | "reabierta_por_agencia"
  | "extra_pedida"
  | "extra_habilitada"
  | "devuelta_a_su_carpeta"
  | "no_se_pudo_devolver"
  | "aprobada"
  | "cambios_pedidos"
  | "cambios_descartados"
  | "revision_enviada"
  | "reabierta"
  | "movida_a_finales"
  | "no_se_pudo_mover"
  | "archivo_reemplazado";

/**
 * Cómo se lee cada hito.
 *
 * En pasado y en tercera persona, porque se lee en una lista de cosas que ya
 * pasaron. Sin nombres acá: quién lo hizo va al lado, y sale de la sesión.
 */
export const EN_PALABRAS: Record<Hito, string> = {
  entregada: "Se entregó",
  aprobada: "Aprobó",
  cambios_pedidos: "Pidió cambios",
  cambios_descartados: "Descartó los cambios",
  revision_enviada: "Envió la revisión",
  reabierta: "Reabrió la pieza",
  reabierta_por_agencia: "Reabrió la pieza para que el cliente la vuelva a mirar",
  extra_pedida: "Pidió una revisión adicional",
  extra_habilitada: "Habilitó una revisión adicional",
  movida_a_finales: "Se movió a «Entregas finales»",
  no_se_pudo_mover: "No se pudo mover a «Entregas finales»",
  devuelta_a_su_carpeta: "Volvió a su carpeta de trabajo",
  no_se_pudo_devolver: "No se pudo sacar de «Entregas finales»",
  archivo_reemplazado:
    "El archivo que había ya no está: lo que hay ahora con ese nombre es otro, " +
    "así que la pieza vuelve a empezar",
};

/** Lo mínimo de un hito para poder leerlo. */
export type HitoLeido = { que: Hito; detalle?: string };

/**
 * Cómo se nombra lo que el cliente acaba de revisar.
 *
 * **Sin la versión, el aviso no dice nada accionable.** «Envió la revisión de
 * 2 piezas» obliga a entrar a mirar cuáles y de qué vuelta, que es justo lo
 * que el aviso venía a evitar. Con la versión adelante se sabe si es la
 * primera pasada o la tercera, que es lo que cambia qué se hace después.
 *
 * Con una pieza la nombra; con varias de la misma vuelta las cuenta; con
 * varias de vueltas distintas dice cuáles vueltas, porque ahí no hay un
 * número que las resuma.
 */
export function enPalabrasLoRevisado(
  piezas: Array<{ nombre: string; version: number }>
): string {
  if (piezas.length === 0) return "";
  if (piezas.length === 1) return `la v${piezas[0].version} de ${piezas[0].nombre}`;

  const versiones = [...new Set(piezas.map((p) => p.version))].sort((a, b) => a - b);
  const cuantas = `${piezas.length} piezas`;

  return versiones.length === 1
    ? `la v${versiones[0]} de ${cuantas}`
    : `${cuantas} (${enCastellano(versiones.map((v) => `v${v}`))})`;
}

export type CambiosDeUnaVuelta = {
  /** 1 es la primera, la que no lleva marca en el nombre del archivo. */
  version: number;
  /** Lo que el cliente escribió, ya separado en puntos. */
  puntos: string[];
  /** Todavía no los mandó: puede seguir escribiendo. */
  abierta: boolean;
};

/**
 * Lo que el cliente pidió en cada vuelta, reconstruido de la historia.
 *
 * **Lo pedido no vive en la pieza: vive en su historia.** La lista de cambios
 * se vacía al entregar la vuelta siguiente —es lo correcto, la revisión nueva
 * empieza limpia— así que lo único que queda de la V1 es lo que se anotó
 * cuando el cliente la cerró. Sin esto, «¿por qué la v2 salió así?» no tiene
 * respuesta a los dos meses.
 *
 * Lee dos formas, porque hay piezas guardadas de antes: la de ahora, donde el
 * envío lleva escrito «V1: 1) …», y la vieja, donde eso quedó del lado de la
 * entrega que lo contestó, como «Responde a: 1) …».
 */
export function cambiosPorVuelta(
  historia: HitoLeido[],
  /** Lo que está pedido ahora y todavía no se contestó. */
  ahora: string[] = [],
  /** En qué vuelta está la pieza hoy. */
  vueltaActual = 1,
  /** Si lo de ahora ya se mandó. */
  enviada = false
): CambiosDeUnaVuelta[] {
  const salida: CambiosDeUnaVuelta[] = [];
  const envios = historia
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.que === "revision_enviada");

  envios.forEach(({ h, i }, orden) => {
    // La forma de ahora dice la versión adelante; la vieja la deja en la
    // entrega que vino después.
    const propio = leerPedido(h.detalle);
    const enLaEntrega = leerPedido(
      historia.slice(i + 1).find((x) => x.que === "entregada")?.detalle
    );

    // **Y si no está en ninguna de las dos, es lo que todavía está sin
    // contestar.** Pasa con lo mandado antes de que el envío lo anotara y
    // todavía sin entregar: la única copia está en la pieza.
    const ultimo = orden === envios.length - 1;
    const puntos =
      propio.puntos.length > 0
        ? propio.puntos
        : enLaEntrega.puntos.length > 0
          ? enLaEntrega.puntos
          : ultimo && enviada
            ? ahora
            : [];

    if (puntos.length > 0) {
      salida.push({ version: propio.version ?? orden + 1, puntos, abierta: false });
    }
  });

  // **Lo de la pieza solo se suma si todavía no se mandó.** Mandado, la
  // historia ya lo tiene: la lista de la pieza no se vacía hasta que se
  // entrega la vuelta siguiente, así que sumarlo igual mostraba el mismo
  // pedido dos veces, uno debajo del otro.
  if (ahora.length > 0 && !enviada) {
    salida.push({ version: vueltaActual, puntos: ahora, abierta: true });
  }

  return salida;
}

/** Saca la versión y los puntos de un detalle escrito a mano. */
function leerPedido(detalle?: string): { version?: number; puntos: string[] } {
  if (!detalle) return { puntos: [] };

  // `[\s\S]` en vez de la bandera `s`: la configuración de TypeScript de este
  // proyecto apunta a una versión anterior a donde esa bandera existe, y el
  // error que da no nombra el archivo.
  const conVersion = detalle.match(/^V(\d+):\s*([\s\S]*)$/);
  const cuerpo = conVersion ? conVersion[2] : detalle.replace(/^Responde a:\s*/, "");
  if (cuerpo === detalle && !conVersion && !detalle.startsWith("Responde a:")) {
    return { puntos: [] };
  }

  // Los puntos se escribieron como «1) … 2) …»: se parten por esa marca.
  const puntos = cuerpo
    .split(/\s*\d+\)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

  return { version: conVersion ? Number(conVersion[1]) : undefined, puntos };
}

/**
 * Cómo queda firmado lo que hace el cliente cuando dice quién es.
 *
 * El portal no tiene sesión de persona: del otro lado hay «Cliente». Pero una
 * aprobación es una decisión con nombre, y quien la toma puede escribirlo. Se
 * guarda al lado de la base —«Cliente · Juana Pérez»— y nunca en lugar de
 * ella: que lo escribió el cliente sigue siendo lo primero que se lee.
 * Vacío, o «cliente» a secas, es la base sola.
 */
export function comoFirmaElCliente(base: string, nombre: unknown): string {
  const limpio = String(nombre ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (!limpio || limpio.toLowerCase() === base.toLowerCase()) return base;
  return `${base} · ${limpio}`;
}
