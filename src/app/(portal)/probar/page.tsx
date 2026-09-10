// Una puerta de prueba al portal, solo mientras se trabaja en la máquina.
//
// El acceso directo del escritorio no puede saber el link de un cliente: los
// links son al azar y distintos para cada uno. Antes abría una dirección fija
// —`/t/ejemplo`— y cuando los links pasaron a ser de verdad esa dirección
// quedó muerta.
//
// Esto lleva al portal del primer cliente habilitado. **En producción no
// existe**: ahí devuelve 404, porque una dirección fija que lleva al portal de
// un cliente es justamente lo que el link al azar viene a evitar.
//
// Igual no saltea nada: del otro lado sigue pidiendo la clave.

import { notFound, redirect } from "next/navigation";
import { clientesHabilitados } from "@/lib/clientes";

export const dynamic = "force-dynamic";

export default async function Probar() {
  if (process.env.NODE_ENV === "production") notFound();

  const clientes = await clientesHabilitados();
  const primero = clientes[0];

  if (!primero) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md">
          <h1 className="text-titulo font-extrabold tracking-tight">
            No hay ningún cliente todavía
          </h1>
          <p className="mt-3 text-normal text-tinta-suave">
            Compartile una carpeta al robot desde Drive y va a aparecer solo.
          </p>
        </div>
      </div>
    );
  }

  redirect(`/t/${primero.token}`);
}
