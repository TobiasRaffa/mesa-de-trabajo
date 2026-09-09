// La entrega, como la ve el cliente.
//
// Esta parte corre en el servidor: busca los datos y arma el encabezado. La
// parte que responde a los clics vive en RevisionDeEntrega, del lado del
// navegador. Es la división de siempre: el servidor trae, el navegador
// interactúa.
//
// Todavía muestra datos de ejemplo: falta la base de datos para saber a qué
// entrega apunta el token y para pedir el tag. La ruta, la forma y el
// comportamiento son los definitivos.

import { entregaDeEjemplo } from "@/portal/datos/ejemplo";
import { RevisionDeEntrega } from "@/portal/RevisionDeEntrega";

export const dynamic = "force-dynamic";

export default async function Entrega() {
  const entrega = await entregaDeEjemplo();

  return (
    <div className="mx-auto max-w-6xl px-5 pb-32 sm:px-8 lg:pb-16">
      {/* El plazo no aparece acá: va al pie, en chico. */}
      <header className="border-b border-linea-tenue py-6 lg:py-10">
        <p className="text-micro uppercase tracking-widest text-apagado">{entrega.cliente}</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-titulo font-semibold tracking-tight lg:text-grande">
            {entrega.proyecto}
          </h1>
          <p className="text-menudo text-tinta-suave">{entrega.piezas.length} piezas</p>
        </div>
      </header>

      <RevisionDeEntrega entrega={entrega} />

      {entrega.comentarios.length > 0 && (
        <section className="border-t border-linea-tenue py-8">
          <h2 className="text-micro uppercase tracking-widest text-apagado">
            Lo que anotaron hasta ahora
          </h2>
          <ul className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
            {entrega.comentarios.map((c, i) => (
              <li key={i}>
                <p className="text-menudo font-semibold">
                  {c.quien} <span className="font-normal text-apagado">· {c.cuando}</span>
                </p>
                <p className="mt-0.5 text-normal text-tinta-suave">{c.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
