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
import type { Aviso } from "@/lib/avisos";

/** Cuántas se muestran desplegadas. Para el resto está la pantalla entera. */
const CUANTAS = 12;

export function Campana({ avisos }: { avisos: Aviso[] }) {
  const [abierta, setAbierta] = useState(false);
  // Cuáles estaban sin leer la primera vez que se abrió. `null` hasta entonces.
  const [eranNuevas, setEranNuevas] = useState<Set<string> | null>(null);
  const [, marcar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);

  const sinVer = avisos.filter((a) => !a.visto);
  // Una vez abierta, el número de la campana baja a cero aunque el servidor
  // todavía no haya vuelto con los avisos ya marcados.
  const cuantasSinVer = eranNuevas ? 0 : sinVer.length;
  const nuevas = eranNuevas?.size ?? 0;

  const ultimas = [...avisos]
    .sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime())
    .slice(0, CUANTAS);

  function abrir() {
    setAbierta(true);
    if (eranNuevas) return;
    setEranNuevas(new Set(sinVer.map((a) => a.id)));
    if (sinVer.length > 0) marcar(() => marcarAvisosVistos());
  }

  // Se cierra tocando afuera o con Escape, como cualquier desplegable.
  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(false);
    };
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", tecla);
    };
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
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full z-30 mt-3 flex w-[min(32rem,calc(100vw-3rem))] flex-col
                     overflow-hidden rounded-tarjeta bg-lienzo
                     shadow-[0_24px_48px_-16px_rgba(18,18,18,0.45)]"
        >
          <EncabezadoDeVentana
            titulo="Notificaciones"
            rotulo={
              nuevas > 0
                ? `${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"}`
                : avisos.length > 0
                  ? `Las últimas ${Math.min(avisos.length, CUANTAS)}`
                  : undefined
            }
            onCerrar={() => setAbierta(false)}
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
                  alIr={() => setAbierta(false)}
                />
              ))}
            </ul>
          )}

          <div className="border-t-2 border-tinta px-4 py-3">
            <BotonEnlace
              href="/gestion/notificaciones"
              tamano="chico"
              ancho
              onClick={() => setAbierta(false)}
            >
              Ver todas las notificaciones
            </BotonEnlace>
          </div>
        </div>
      )}
    </div>
  );
}
