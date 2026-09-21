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
// aplicación ya sabe: si abriste la lista, las viste. Y las marca **para
// vos**: cada uno tiene su propia campana.
//
// Lo que estaba sin leer **al abrir la pantalla** queda arriba, separado y
// marcado, aunque ya se haya dado por leído. Si no, abrir la bandeja las
// volvería todas iguales en el mismo instante y no habría forma de ver cuáles
// eran las nuevas, que es justamente para lo que se abrió. La próxima vez que
// se entre ya bajan al montón, que es lo que corresponde: dejaron de ser
// nuevas cuando se las miró.
//
// El título lo pone la pantalla, con el encabezado de todas: esto es la lista.

import { Fragment, useEffect, useState, useTransition } from "react";
import { marcarAvisosVistos } from "@/app/(admin)/gestion/acciones";
import { RenglonDeAviso } from "@/admin/RenglonDeAviso";
import { diaEnBuenosAires, enPalabrasElDiaLargo } from "@/dominio/tiempo";
import type { AvisoMio } from "@/lib/avisos";

export function Bandeja({
  avisos,
  correoConfigurado,
  yo,
}: {
  avisos: AvisoMio[];
  correoConfigurado: boolean;
  /** Cómo te llamás: sirve para no decir «para vos» en cada renglón. */
  yo?: string;
}) {
  const sinVer = avisos.filter((a) => !a.loVi).length;

  // Cuáles eran nuevas cuando se abrió la pantalla.
  //
  // Se calcula **una sola vez**, al montar, y por eso va en un `useState` con
  // función y no en un `useMemo`: no depende de nada que pueda cambiar, y es
  // justamente lo que permite que sigan marcadas después de darlas por leídas.
  const [eranNuevas] = useState(
    () => new Set(avisos.filter((a) => !a.loVi).map((a) => a.id))
  );

  const nuevas = avisos.filter((a) => eranNuevas.has(a.id));
  const viejas = avisos.filter((a) => !eranNuevas.has(a.id));

  // Con un solo cliente a la vista, su nombre en cada renglón es una columna
  // entera diciendo lo mismo cincuenta veces.
  const variosClientes = new Set(avisos.map((a) => a.clienteId)).size > 1;

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
            <Grupo
              titulo={`Nuevas · ${nuevas.length}`}
              avisos={nuevas}
              nuevas
              yo={yo}
              conCliente={variosClientes}
            />
          )}
          {viejas.length > 0 && (
            <Grupo
              titulo="Ya leídas"
              avisos={viejas}
              yo={yo}
              conCliente={variosClientes}
              // **Cortadas por día.** Cincuenta renglones seguidos, cada uno
              // repitiendo «17 sept», y el salto de un día a otro no se veía:
              // había que comparar dos fechas menudas para darse cuenta. El
              // grupo de nuevas no se corta: suele ser de hoy y de un rato.
              porDia
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
  yo,
  conCliente,
  porDia = false,
}: {
  titulo: string;
  avisos: AvisoMio[];
  nuevas?: boolean;
  yo?: string;
  conCliente?: boolean;
  porDia?: boolean;
}) {
  return (
    <div className="mt-8">
      <h3 className="font-mono text-micro font-bold uppercase tracking-widest text-apagado">
        {titulo}
      </h3>
      <ul className="mt-2 border-t border-linea">
        {avisos.map((aviso, i) => {
          const dia = diaEnBuenosAires(new Date(aviso.cuando));
          const anterior = i > 0 ? diaEnBuenosAires(new Date(avisos[i - 1].cuando)) : null;
          const cambiaElDia = porDia && dia !== anterior;

          return (
            <Fragment key={aviso.id}>
              {cambiaElDia && (
                <li className="border-b border-linea bg-hueco/60 px-4 py-1.5 font-mono text-micro font-bold uppercase tracking-widest text-apagado">
                  {enPalabrasElDiaLargo(aviso.cuando)}
                </li>
              )}
              <RenglonDeAviso
                aviso={aviso}
                nueva={nuevas}
                yo={yo}
                conCliente={conCliente}
                soloLaHora={porDia}
              />
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
