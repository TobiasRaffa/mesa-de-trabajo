// La puerta de gestión.
//
// Es la única dirección bajo `/gestion` que `proxy.ts` deja mirar sin haber
// entrado. Todo lo demás pasa por la galleta.

import { Entrar } from "@/app/(admin)/gestion/entrar/Entrar";
import { hayContrasena } from "@/lib/contrasena";

// Depende de una variable de entorno: resolverla al compilar dejaría clavado
// lo que valía ese día.
export const dynamic = "force-dynamic";

export default async function PaginaDeEntrada({
  searchParams,
}: PageProps<"/gestion/entrar">) {
  const { volver } = await searchParams;
  return (
    <Entrar
      volver={typeof volver === "string" ? volver : "/gestion"}
      falta={!hayContrasena()}
    />
  );
}
