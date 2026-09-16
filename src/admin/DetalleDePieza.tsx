// Lo que se anotó de una pieza: lo que pidió el cliente y lo que se escribió
// encima del archivo en Drive.
//
// **Estaba repartido en dos pantallas.** La ventana del tablero decía el
// nombre y el estado; para saber qué había pedido el cliente, o qué
// escribieron encima del archivo en Drive, había que irse a la pantalla de la
// carpeta. Cuatro pantallas para contestar «¿por qué está frenado esto?».
//
// **Acá no hay ni un botón.** Los tenía —configurar, otorgar la revisión
// extra— y ahora viven todos juntos en la barra de abajo de la ventana, que es
// donde se los busca. Esto es solo para leer, y por eso tampoco necesita ser
// un componente de cliente.

import { cambiosPorVuelta } from "@/dominio/historia";
import type { PiezaConHistoria } from "@/admin/HistoriaDePiezas";
import { enPalabrasLaFecha } from "@/admin/cuando";

export function DetalleDePieza({
  pieza,
  vueltas,
}: {
  pieza: PiezaConHistoria;
  /** En qué vuelta va la pieza, según los archivos que hay en Drive. */
  vueltas: number;
}) {
  const porVuelta = cambiosPorVuelta(
    pieza.historia,
    pieza.cambios.map((c) => c.texto),
    vueltas,
    pieza.enviada
  );

  if (porVuelta.length === 0 && pieza.comentarios.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/*
        **Lo que pidió el cliente, vuelta por vuelta.** Estaba todo junto en
        una lista sin decir de cuál versión era cada cosa: con tres vueltas
        encima, eso es un párrafo del que no se puede sacar por qué salió así
        la V2.
      */}
      {porVuelta.map((v) => (
        <div
          key={v.version}
          className="border-l-4 border-acento bg-acento-tenue/40 py-1.5 pl-3"
        >
          <p className="text-micro font-extrabold uppercase tracking-widest text-acento">
            Cambios v{v.version}
            {v.abierta && (
              <span className="ml-2 font-bold text-apagado">los está escribiendo</span>
            )}
          </p>
          <ol className="mt-1 flex flex-col gap-1">
            {v.puntos.map((texto, i) => (
              <li key={i} className="flex gap-2 text-menudo text-tinta-suave">
                <span className="shrink-0 font-extrabold text-apagado">{i + 1}.</span>
                <span className="min-w-0 whitespace-pre-wrap">{texto}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {pieza.comentarios.length > 0 && (
        <div className="border-l-4 border-espera-borde bg-espera-tenue py-1.5 pl-3">
          <p className="text-micro font-extrabold uppercase tracking-widest text-espera">
            {pieza.comentarios.length === 1
              ? "1 comentario en Drive"
              : `${pieza.comentarios.length} comentarios en Drive`}
          </p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {pieza.comentarios.map((c) => (
              <li key={c.id} className="text-menudo text-tinta-suave">
                <span className="font-bold">{c.quien}</span>
                {/* **La hoja, adelante.** Un comentario en la hoja 7 de un PDF
                    de veinte, sin decir la hoja, manda a buscarlo a mano por
                    todo el archivo. Solo aparece si Drive la dice: no se
                    inventa. */}
                {c.hoja !== undefined && (
                  <span className="ml-1.5 bg-espera-borde/30 px-1.5 py-0.5 text-micro font-extrabold uppercase tracking-wider text-espera">
                    hoja {c.hoja}
                  </span>
                )}
                <span className="text-apagado"> · {enPalabrasLaFecha(c.cuando)}</span>
                <span className="block whitespace-pre-wrap">{c.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
