"use client";

// Cuando Drive no contesta, del lado de la agencia.
//
// Acá **sí** se muestra el detalle: esta pantalla la ve la agencia, que es
// justamente quien tiene que enterarse de qué está mal y puede arreglarlo. En
// el portal es al revés, porque ahí lo abre gente de afuera.
//
// **Es un cartel adentro de la pantalla, no otra pantalla.** Reemplazaba todo
// —encabezado incluido— así que quien miraba no sabía cuál de las cinco
// secciones había fallado, la barra quedaba sin nada marcado, y lo único que
// se podía hacer era recargar a mano. Ahora queda el marco de siempre, el
// título de la pantalla que se quiso abrir, y un botón para volver a
// intentarlo sin perder el lugar.

import { useRouter } from "next/navigation";
import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";

export function ErrorDeDrive({ error, titulo }: { error: unknown; titulo?: string }) {
  const router = useRouter();

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina titulo={titulo ?? "No pude leer Drive"} />
      <p className="mt-8 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 font-mono text-menudo text-alerta">
        {error instanceof Error ? error.message : "Error desconocido"}
      </p>
      <p className="mt-4 text-normal text-tinta-suave">
        Suele ser que la carpeta todavía no está compartida con el robot, o que cambió su
        dirección.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-6 inline-flex min-h-toque items-center rounded-full border-2 border-tinta px-6
                   text-normal font-bold tracking-tight text-tinta transition-colors hover:bg-hueco"
      >
        Reintentar
      </button>
    </main>
  );
}
