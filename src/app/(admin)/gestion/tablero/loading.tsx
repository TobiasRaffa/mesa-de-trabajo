// El tablero mientras se arma.
//
// Es la pantalla más pesada del día —pide las carpetas de todos los clientes,
// y de cada una sus archivos— así que es justo donde la espera se nota. Se
// dibujan las cuatro columnas con su título, que es lo que va a haber, para
// que al llegar los datos no salte nada de lugar.

import { PANTALLA } from "@/admin/EncabezadoDePagina";

const COLUMNAS = ["A cargo nuestro", "Sin entregar", "Con el cliente", "Listo"];

export default function Cargando() {
  return (
    <main className={PANTALLA} aria-busy="true">
      <header className="border-b-2 border-tinta pb-6">
        <h1 className="text-grande font-extrabold tracking-tight">Tablero</h1>
      </header>

      <p role="status" className="mt-6 text-normal text-apagado">
        Armando el tablero…
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((titulo) => (
          <section key={titulo}>
            <h2 className="font-mono text-micro font-bold uppercase tracking-widest text-apagado">
              {titulo}
            </h2>
            <span className="mt-1 block h-8 w-10 animate-pulse bg-hueco" />
            <ul className="mt-3 flex flex-col gap-2">
              {[0, 1].map((i) => (
                <li key={i} className="h-16 animate-pulse rounded-tarjeta bg-hueco" />
              ))}
            </ul>
          </section>
        ))}
      </div>


    </main>
  );
}
