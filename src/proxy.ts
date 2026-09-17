// Quién está mirando, del lado de la agencia.
//
// **Esto vuelve a ser una puerta, y ahora cada una tiene su llave.**
//
// Durante un tiempo pidió una contraseña compartida y se sacó a pedido: adentro
// de la agencia, escribirla en cada máquina todos los días era fastidio y nada
// más. Lo que quedó en su lugar fue peor de lo que parecía: una marca que se le
// entregaba a **cualquiera** que escribiera la dirección, con treinta días de
// vida, y que las rutas de archivos aceptaban como «soy del equipo». Con eso se
// bajaba cualquier archivo de cualquier cliente, incluidos los escondidos a
// propósito. No era «se ven las pantallas»: era repartir una credencial.
//
// Ahora la galleta la firma **entrar**, y lleva adentro de quién es. Sin ella
// no se llega a nada que cuelgue de `/gestion` ni al diagnóstico, así que una
// pantalla nueva nace protegida sin que nadie tenga que acordarse.
//
// La pantalla de entrada queda afuera, por razones obvias: si también pidiera
// sesión, no habría forma de conseguir una.
//
// En Next 16 esto se llama `proxy` y ya no `middleware`, y corre en Node por
// omisión, que es lo que permite firmar con `node:crypto` acá adentro.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GALLETA_DE_GESTION, galletaDeGestionValida } from "@/lib/contrasena";

/** Dónde se entra. Queda afuera de la puerta, o no se podría entrar. */
export const ENTRADA = "/gestion/entrar";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === ENTRADA) return NextResponse.next();

  if (galletaDeGestionValida(request.cookies.get(GALLETA_DE_GESTION)?.value)) {
    return NextResponse.next();
  }

  // **A dónde volver después de entrar.** Sin esto, quien abre un link a un
  // trabajo puntual —de los que se pasan por chat— entra y aparece en la
  // pantalla de inicio, sin saber a dónde iba.
  const aEntrar = request.nextUrl.clone();
  aEntrar.pathname = ENTRADA;
  aEntrar.search = "";
  aEntrar.searchParams.set("volver", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(aEntrar);
}

export const config = {
  // `/gestion` suelto va aparte de `/gestion/:path*` para no depender de si el
  // patrón acepta cero segmentos.
  matcher: ["/gestion", "/gestion/:path*", "/diagnostico"],
};
