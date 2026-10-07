// Una dirección que no existe.
//
// Sin esto salía la pantalla que trae Next de fábrica: «404 — This page could
// not be found», en inglés, sin la marca, sin el fondo papel y sin una sola
// palabra de lo que es esto. Quien llegó ahí —un cliente que borró el final de
// su link, alguien que escribió mal la dirección— no tenía cómo seguir.
//
// **Sin links, que es la decisión.** La raíz no lleva a ningún lado a
// propósito: cada mundo tiene su puerta y hay que saberla. Lo que faltaba no
// era un camino, era que el callejón estuviera escrito en el idioma de la
// herramienta.

import { Marca } from "@/ui/Marca";

export default function NoExiste() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Marca />
      <h1 className="mt-8 text-grande font-extrabold leading-none tracking-tighter">
        Esta dirección no existe
      </h1>
    </main>
  );
}
