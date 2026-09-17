// La puerta de la agencia.
//
// Es la única pantalla de `/gestion` que `proxy.ts` deja pasar sin sesión, por
// razones obvias: si también pidiera una, no habría forma de conseguirla.

import { Entrar } from "@/admin/Entrar";
import { hayAlguienConClave } from "@/lib/claves";

// Depende de si alguien ya tiene contraseña, que cambia en cuanto se carga la
// primera: precalcularla mostraría «primera vez» para siempre.
export const dynamic = "force-dynamic";

export default async function Puerta({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  // **Solo se acepta volver adentro de gestión.** Sin esto, un link con
  // `?volver=https://otro-sitio` manda a alguien afuera justo después de
  // escribir su contraseña, que es el momento en que menos mira la barra.
  const destino = volver?.startsWith("/gestion") ? volver : "/gestion";

  return <Entrar volver={destino} arrancando={!(await hayAlguienConClave())} />;
}
