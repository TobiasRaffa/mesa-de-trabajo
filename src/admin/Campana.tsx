"use client";

// La campana del tablero: las notificaciones, sin irse del tablero.
//
// Llevaba a la pantalla de Notificaciones. Para ver si pasó algo había que
// salir del tablero, mirar, y volver: tres pasos para una pregunta de un
// vistazo. Ahora se despliega acá, encima de lo que se estaba mirando, y la
// pantalla entera sigue existiendo para leer con calma o buscar algo viejo.
//
// **Se ve como una ventana de la aplicación, chica.** La misma banda violeta
// con el título y la cruz, las mismas esquinas, los mismos renglones que la
// bandeja: no es un menú de otro sistema pegado encima del tablero.
//
// **Abrirla las marca leídas**, como en la bandeja: si abriste la lista, las
// viste. Y lo que estaba sin leer al abrir queda marcado mientras esté
// abierta, aunque ya se haya dado por leído: si no, abrirla las volvería
// todas iguales en el mismo instante y no se sabría cuáles eran las nuevas.

import { useEffect, useRef, useState, useTransition } from "react";
import { marcarAvisosVistos } from "@/app/(admin)/gestion/acciones";
import { RenglonDeAviso } from "@/admin/RenglonDeAviso";
import { BotonEnlace } from "@/ui/Boton";
import { EncabezadoDeVentana } from "@/ui/EncabezadoDeVentana";
import { IconoCampana } from "@/ui/Icono";
import { useTrampaDeFoco } from "@/ui/useTrampaDeFoco";
import type { AvisoMio } from "@/lib/avisos";

/** Cuántas se muestran desplegadas. Para el resto está la pantalla entera. */
const CUANTAS = 12;

export function Campana({ avisos, yo }: { avisos: AvisoMio[]; yo?: string }) {
  const [abierta, setAbierta] = useState(false);
  // Cuáles estaban sin leer la primera vez que se abrió. `null` hasta entonces.
  const [eranNuevas, setEranNuevas] = useState<Set<string> | null>(null);
  const [, marcar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);

  const sinVer = avisos.filter((a) => !a.loVi);
  // Una vez abierta, el número de la campana baja a cero aunque el servidor
  // todavía no haya vuelto con los avisos ya marcados.
  //
  // **Baja por lo que se vio, no por haber abierto la campana una vez.** Decía
  // `eranNuevas ? 0 : sinVer.length`, y como esa marca pasa de `null` a un
  // conjunto y nunca vuelve, el número quedaba en cero para siempre: abrir la
  // campana a las nueve dejaba el resto del día sin globo, aunque entregaras,
  // reabrieras y el cliente escribiera. Descontando las que ya se miraron, lo
  // que llega después vuelve a contar.
  const cuantasSinVer = sinVer.filter((a) => !eranNuevas?.has(a.id)).length;
  const ultimas = [...avisos]
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime())
    .slice(0, CUANTAS);

  // **Las que se están señalando como nuevas, no cuántas se señalaron alguna
  // vez.** Era el tamaño del conjunto entero, que solo crece: abriendo la
  // campana tres veces en la mañana el rótulo decía «12 nuevas» sobre una lista
  // donde ninguna estaba marcada. Contando las que de verdad llevan la marca
  // **en esta lista**, el número dice lo mismo que se ve.
  const nuevas = ultimas.filter((a) => eranNuevas?.has(a.id)).length;

  // Con un solo cliente a la vista, su nombre en cada renglón es lo mismo
  // repetido doce veces.
  const variosClientes = new Set(ultimas.map((a) => a.clienteId)).size > 1;

  function abrir() {
    setAbierta(true);
    // **Solo las que se están mostrando.** Marcaba todo lo que hubiera traído
    // el servidor —hasta quinientos— aunque en pantalla entren doce: volver de
    // un fin de semana con treinta avisos daba por leídos dieciocho que nadie
    // vio nunca. Para el resto está la pantalla entera, que sí los dibuja.
    const aMarcar = ultimas.filter((a) => !a.loVi && !eranNuevas?.has(a.id));
    if (aMarcar.length === 0) return;

    setEranNuevas(new Set([...(eranNuevas ?? []), ...aMarcar.map((a) => a.id)]));
    marcar(() => marcarAvisosVistos(aMarcar.map((a) => a.id)));
  }

  // Se cierra tocando afuera, como cualquier desplegable. El Escape lo maneja
  // la trampa de foco del panel, que es la que sabe si hay otra ventana encima.
  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
  }, [abierta]);

  const rotulo =
    cuantasSinVer > 0
      ? `${cuantasSinVer} ${cuantasSinVer === 1 ? "notificación sin leer" : "notificaciones sin leer"}`
      : "Notificaciones";

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => (abierta ? setAbierta(false) : abrir())}
        aria-label={rotulo}
        title={rotulo}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        className={`inline-flex min-h-toque items-center gap-1.5 rounded-full border-2 px-3 text-menudo font-extrabold transition-colors ${
          cuantasSinVer > 0
            ? "border-lima bg-lima text-tinta hover:bg-lima-hover"
            : abierta
              ? "border-tinta bg-tinta text-lienzo"
              : "border-linea text-apagado hover:bg-hueco"
        }`}
      >
        <IconoCampana />
        {cuantasSinVer > 0 && <span className="cifras leading-none">{cuantasSinVer}</span>}
      </button>

      {abierta && (
        <Panel
          ultimas={ultimas}
          nuevas={nuevas}
          cuantas={avisos.length}
          sinLeerQueQuedan={cuantasSinVer}
          eranNuevas={eranNuevas}
          conCliente={variosClientes}
          yo={yo}
          onCerrar={() => setAbierta(false)}
        />
      )}
    </div>
  );
}

/**
 * Lo desplegado.
 *
 * **Es un componente aparte porque dice ser un diálogo.** Lo era de nombre
 * —`role="dialog"`— y de nada más: el foco seguía en la página de atrás, el
 * Tab se iba a los botones del tablero que el panel estaba tapando, y su
 * Escape escuchaba por afuera de la pila de ventanas, así que con una ventana
 * abierta encima las cerraba a las dos. La trampa de foco necesita que el
 * elemento exista al montarse, y para eso tiene que ser su propio componente.
 */
function Panel({
  ultimas,
  nuevas,
  cuantas,
  sinLeerQueQuedan,
  eranNuevas,
  conCliente,
  yo,
  onCerrar,
}: {
  ultimas: AvisoMio[];
  nuevas: number;
  cuantas: number;
  sinLeerQueQuedan: number;
  eranNuevas: Set<string> | null;
  conCliente: boolean;
  yo?: string;
  onCerrar: () => void;
}) {
  const marco = useTrampaDeFoco<HTMLDivElement>(onCerrar);

  return (
    <div
      ref={marco}
      role="dialog"
      aria-label="Notificaciones"
      tabIndex={-1}
      className="absolute right-0 top-full z-30 mt-3 flex w-[min(32rem,calc(100vw-3rem))] flex-col
                 overflow-hidden rounded-tarjeta bg-lienzo
                 shadow-[0_24px_48px_-16px_rgba(18,18,18,0.45)]"
    >
      <EncabezadoDeVentana
        titulo="Notificaciones"
        rotulo={
          nuevas > 0
            ? `${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"}`
            : cuantas > 0
              ? `Las últimas ${Math.min(cuantas, CUANTAS)}`
              : undefined
        }
        onCerrar={onCerrar}
      />

      {ultimas.length === 0 ? (
        <p className="px-6 py-8 text-center text-normal text-apagado">Todavía no pasó nada.</p>
      ) : (
        <ul className="max-h-[55vh] overflow-y-auto">
          {ultimas.map((aviso) => (
            <RenglonDeAviso
              key={aviso.id}
              aviso={aviso}
              nueva={eranNuevas?.has(aviso.id) ?? false}
              conCliente={conCliente}
              yo={yo}
              alIr={onCerrar}
            />
          ))}
        </ul>
      )}

      <div className="border-t-2 border-tinta px-4 py-3">
        {/* **El botón dice cómo bajar el número.** Con más de doce sin leer, la
            campana marca doce y el globo queda clavado en el resto: abrir de
            nuevo no marca nada, porque los que faltan no entran en la lista.
            Eso es a propósito —doce es lo que entra— pero no estaba escrito en
            ningún lado, y un número que no se puede bajar es una alarma rota.
            Ahora el pie nombra justo los que quedan. */}
        <BotonEnlace href="/gestion/notificaciones" tamano="chico" ancho onClick={onCerrar}>
          {sinLeerQueQuedan > 0
            ? `Ver las otras ${sinLeerQueQuedan} sin leer`
            : "Ver todas las notificaciones"}
        </BotonEnlace>
      </div>
    </div>
  );
}
