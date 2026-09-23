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
          El archivo que se le entregó al cliente ya no está en este trabajo: se renombró,
          se movió o se borró en Drive. El cliente está viendo la vuelta anterior que quede.
          Si lo renombraste, volvé a entregar.
        </p>
      )}
      {vueltaRepetida && (
        <p className={clase}>
          {vueltaRepetida.nombres.map((n) => `«${n}»`).join(" y ")} dicen ser la misma vuelta,
          la V{vueltaRepetida.numero}. La aplicación toma «{vueltaRepetida.tomada}». Si no es
          esa, renombrá o sacá la otra.
        </p>
      )}
      {saltoDeVuelta && (
        <p className={clase}>
          {saltoDeVuelta.desde === null
            ? `«${saltoDeVuelta.nombre}» se leyó como la vuelta ${saltoDeVuelta.hasta}, y no hay anteriores.`
            : `Después de la V${saltoDeVuelta.desde} viene «${saltoDeVuelta.nombre}», que se leyó como la vuelta ${saltoDeVuelta.hasta}.`}{" "}
          Si ese número es parte del nombre y no una vuelta, separá la V del número (por
          ejemplo «V-{saltoDeVuelta.hasta}»). Si borraron las vueltas del medio, ignoralo.
        </p>
      )}
    </>
  );
}
