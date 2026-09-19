"use client";

// La bandeja de avisos.
//
// Todo lo que hizo el cliente queda anotado acá, haya salido por correo o no.
// Esa separación es a propósito: que el correo no esté configurado, o que el
// proveedor se caiga, **no puede hacer que el aviso se pierda**.
//
// Por eso cada línea dice también si salió y a quién. Un aviso que quedó sin
// mandar no es un error escondido en un registro: se ve al lado del aviso.
//
// **Abrir la pantalla las marca leídas.** Antes había que apretar «Marcar
// como visto» a mano, que es pedirle a alguien que declare algo que la
// aplicación ya sabe: si abriste la lista, las viste.
//
// Lo que estaba sin leer **al abrir la pantalla** queda arriba, separado y
// marcado, aunque ya se haya dado por leído. Si no, abrir la bandeja las
// volvería todas iguales en el mismo instante y no habría forma de ver cuáles
// eran las nuevas, que es justamente para lo que se abrió. La próxima vez que
// se entre ya bajan al montón, que es lo que corresponde: dejaron de ser
// nuevas cuando se las miró.
//
// El título lo pone la pantalla, con el encabezado de todas: esto es la lista.

import { useEffect, useState, useTransition } from "react";
import { marcarAvisosVistos } from "@/app/(admin)/gestion/acciones";
import { RenglonDeAviso } from "@/admin/RenglonDeAviso";
import type { Aviso } from "@/lib/avisos";

export function Bandeja({
  avisos,
  correoConfigurado,
}: {
  avisos: Aviso[];
  correoConfigurado: boolean;
}) {
  const sinVer = avisos.filter((a) => !a.visto).length;

  // Cuáles eran nuevas cuando se abrió la pantalla.
  //
  // Se calcula **una sola vez**, al montar, y por eso va en un `useState` con
  // función y no en un `useMemo`: no depende de nada que pueda cambiar, y es
  // justamente lo que permite que sigan marcadas después de darlas por leídas.
  const [eranNuevas] = useState(
    () => new Set(avisos.filter((a) => !a.visto).map((a) => a.id))
  );

  const nuevas = avisos.filter((a) => eranNuevas.has(a.id));
  const viejas = avisos.filter((a) => !eranNuevas.has(a.id));

  const [, marcar] = useTransition();
  useEffect(() => {
    if (sinVer > 0) marcar(() => marcarAvisosVistos());
  }, [sinVer]);

  return (
    <section>
      {!correoConfigurado && (
        <p className="mt-6 border-l-4 border-espera-borde bg-espera-tenue px-4 py-3 text-menudo font-semibold text-espera">
          Sin correo configurado: los avisos quedan solo acá.
        </p>
      )}

      {avisos.length === 0 ? (
        <p className="mt-8 text-normal text-apagado">Todavía no pasó nada.</p>
      ) : (
        <>
          {/* Las nuevas arriba y aparte. Mezcladas con el resto hay que leer
              renglón por renglón para encontrar cuáles eran, que es
              justamente lo que se vino a hacer al abrir. */}
          {nuevas.length > 0 && (
            <Grupo titulo={`Nuevas · ${nuevas.length}`} avisos={nuevas} nuevas />
          )}
          {viejas.length > 0 && (
            <Grupo
              titulo={nuevas.length > 0 ? "Ya leídas" : "Todo lo anotado"}
              avisos={viejas}
            />
          )}
        </>
      )}
    </section>
  );
}

/**
 * Un montón de avisos con su rótulo.
 *
 * Existe para que las nuevas y las viejas se dibujen con el mismo renglón. Dos
 * listas escritas aparte se separan con el tiempo, y la que se toca menos
 * termina mostrando una cosa distinta.
 */
function Grupo({
  titulo,
  avisos,
  nuevas = false,
}: {
  titulo: string;
  avisos: Aviso[];
  nuevas?: boolean;
}) {
  return (
    <div className="mt-8">
      <h3 className="font-mono text-micro font-bold uppercase tracking-widest text-apagado">
        {titulo}
      </h3>
      <ul className="mt-2 border-t border-linea">
        {avisos.map((aviso) => (
          <RenglonDeAviso key={aviso.id} aviso={aviso} nueva={nuevas} />
        ))}
      </ul>
    </div>
  );
}
