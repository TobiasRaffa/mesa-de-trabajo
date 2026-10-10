// La puerta de la agencia.
//
// Es la única pantalla de `/gestion` que `proxy.ts` deja pasar sin sesión, por
// razones obvias: si también pidiera una, no habría forma de conseguirla.

import { seccionDeLaRuta } from "@/dominio/roles";
import { Entrar } from "@/admin/Entrar";

export default async function Puerta({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  // **Solo se acepta volver a una pantalla nuestra.** Sin esto, un link con
  // `?volver=https://otro-sitio` manda a alguien afuera justo después de
  // escribir su contraseña, que es el momento en que menos mira la barra.
  //
  // La pregunta de verdad es si esa dirección es una sección de la aplicación,
  // y eso lo contesta el dominio: comparando contra «/gestion» a mano, quien
  // venía rebotado del diagnóstico terminaba en Clientes después de entrar.
  const destino = volver && seccionDeLaRuta(volver) !== null ? volver : "/gestion";

  return <Entrar volver={destino} />;
}
