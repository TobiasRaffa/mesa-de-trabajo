// Lo que la aplicación leyó raro en los nombres de una pieza, dicho en la fila.
//
// Son los mismos avisos que «nombre repetido» y «vuelta atrasada», y por eso
// se dicen igual: qué se ve, y qué hacer. Aparecen en el árbol de clientes y en
// la ventana del trabajo, que es donde se entrega; el texto vive en un solo
// lugar para que las dos pantallas no digan cosas distintas.

import type { NodoArchivo } from "@/admin/datos/arbol";

export function RarezasDeNombres({
  archivo,
  clase,
}: {
  archivo: Pick<NodoArchivo, "entregadoPerdido" | "vueltaRepetida" | "saltoDeVuelta">;
  clase: string;
}) {
  const { entregadoPerdido, vueltaRepetida, saltoDeVuelta } = archivo;
  return (
    <>
      {entregadoPerdido && (
        <p className={clase}>
          El archivo entregado ya no está en este trabajo.
        </p>
      )}
      {vueltaRepetida && (
        <p className={clase}>
          {vueltaRepetida.nombres.map((n) => `«${n}»`).join(" y ")} dicen ser la misma vuelta,
          la V{vueltaRepetida.numero}.
        </p>
      )}
      {saltoDeVuelta && (
        <p className={clase}>
          {saltoDeVuelta.desde === null
            ? `«${saltoDeVuelta.nombre}» se leyó como la vuelta ${saltoDeVuelta.hasta}, y no hay anteriores.`
            : `Después de la V${saltoDeVuelta.desde} viene «${saltoDeVuelta.nombre}», que se leyó como la vuelta ${saltoDeVuelta.hasta}.`}
        </p>
      )}
    </>
  );
}
