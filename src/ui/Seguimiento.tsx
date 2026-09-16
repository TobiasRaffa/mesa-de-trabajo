// El camino que hizo una pieza: V1, las vueltas que hubo, y Final.
//
// **Se habla de versiones y no de rondas.** Decía «Boceto · Ronda 1 · Ronda 2»
// y en el estudio se habla de otra cosa: el archivo se llama «V2», el cliente
// pregunta por la V2, y la pantalla le contestaba «ronda 1». Dos nombres para
// la misma cosa, y uno solo estaba escrito en el archivo. Ahora la vuelta 0 es
// **V1** —el archivo sin marca— y cada ronda cerrada es la versión siguiente.
//
// No enumera las versiones que todavía no pasaron. Mostrar «V1 · V2 · V3 ·
// Final» desde el principio da a entender que va a haber cambios, y muchas
// veces al cliente le gusta la primera y se termina ahí. El camino se dibuja a
// medida que se recorre.

type Props = {
  ronda: number;
  rondasIncluidas: number;
  rondasExtra: number;
  aprobada: boolean;
  /** En listas y calendarios alcanza con el paso actual. */
  compacto?: boolean;
};

function nombreDelPaso(n: number, rondasIncluidas: number) {
  // La vuelta 0 es la V1: el archivo tal como se subió, sin marca en el
  // nombre. De ahí en más, cada vuelta cerrada es la versión siguiente, que es
  // exactamente lo que dice el nombre del archivo en Drive.
  const version = `V${n + 1}`;
  // Las versiones que salieron de una revisión adicional se nombran igual
  // —son la V4, no otra cosa— pero se aclara de dónde salieron, para que el
  // cliente vea que fue algo aparte sin que diga la palabra factura.
  return n <= rondasIncluidas ? version : `${version} · adicional`;
}

export function pasoActual(ronda: number, rondasIncluidas: number, aprobada: boolean) {
  return aprobada ? "Aprobada" : nombreDelPaso(ronda, rondasIncluidas);
}

export function Seguimiento({
  ronda,
  rondasIncluidas,
  rondasExtra,
  aprobada,
  compacto = false,
}: Props) {
  const quedan = rondasIncluidas + rondasExtra - ronda;
  const actual = pasoActual(ronda, rondasIncluidas, aprobada);

  if (compacto) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-micro font-extrabold uppercase tracking-wider ${
          aprobada ? "bg-acento text-white" : "bg-hueco text-tinta-suave"
        }`}
      >
        {actual}
      </span>
    );
  }

  const anteriores = Array.from({ length: ronda }, (_, i) =>
    nombreDelPaso(i, rondasIncluidas)
  );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {anteriores.map((paso) => (
        <span key={paso} className="flex items-center gap-2">
          <span className="text-menudo font-semibold text-apagado">{paso}</span>
          <span aria-hidden="true" className="text-linea">
            ›
          </span>
        </span>
      ))}

      <span
        className={`px-2.5 py-1 text-menudo font-extrabold uppercase tracking-wider ${
          aprobada ? "bg-acento text-white" : "bg-tinta text-lienzo"
        }`}
        aria-current="step"
      >
        {actual}
      </span>

      {!aprobada && (
        <>
          <span aria-hidden="true" className="text-linea">
            ›
          </span>
          <span className="text-menudo font-semibold text-linea">Final</span>
        </>
      )}

      {/* Cuando ya no quedan rondas incluidas sí hay algo que decir, porque
          cambia lo que se puede hacer. Que sea la última no hace falta
          aclararlo: se lee del camino. */}
      {!aprobada && quedan <= 0 && (
        <span className="border-l-4 border-espera-borde bg-espera-tenue px-2 py-0.5 text-micro font-bold text-espera">
          sin rondas incluidas
        </span>
      )}
    </div>
  );
}
