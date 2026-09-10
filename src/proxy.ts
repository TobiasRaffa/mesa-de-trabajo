// La puerta de gestión. Todo lo de la agencia pasa por acá antes que por nada.
//
// **Por qué acá y no en cada pantalla.** Antes la contraseña se comprobaba
// dentro de dos acciones sueltas —ver la clave de un cliente y cambiarla— y
// todo lo demás abría con solo escribir la dirección: el árbol de clientes,
// los chats, el tablero, el equipo, habilitar o deshabilitar un cliente,
// renovar un link. Chequear de a una es la forma segura de olvidarse: la
// pantalla número once nace desprotegida y nadie lo nota, porque se ve igual.
//
// Puesta acá, la regla es al revés: **una pantalla nueva bajo `/gestion` nace
// protegida** sin que su autor tenga que acordarse de nada. Y las acciones de
// servidor de la agencia también, porque el navegador las manda como POST a la
// misma dirección de la página.
//
// `/diagnostico` entra en la lista aunque no cuelgue de `/gestion`: cuenta qué
// variables de entorno faltan, si se está guardando en Supabase o en archivos,
// y el error crudo que devolvió Google. Nada de eso es para cualquiera.
//
// El portal del cliente **no** pasa por acá: tiene su propia puerta, que son
// dos factores distintos —el link y la clave del cliente—. Son dos mundos
// separados a propósito y no comparten sesión: acertar en uno no abre el otro.
//
// En Next 16 esto se llama `proxy` y ya no `middleware`, y corre en Node por
// omisión, que es lo que permite firmar con `node:crypto` acá adentro.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GALLETA_DE_GESTION, galletaDeGestionValida } from "@/lib/contrasena";

/** La única dirección de la lista que se puede mirar sin haber entrado. */
const ENTRADA = "/gestion/entrar";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ENTRADA) return NextResponse.next();

  if (galletaDeGestionValida(request.cookies.get(GALLETA_DE_GESTION)?.value)) {
    return NextResponse.next();
  }

  const destino = new URL(ENTRADA, request.url);
  // A dónde quería ir, para llevarlo ahí después de entrar. Es una dirección
  // de esta aplicación y nada más: se valida al usarla, no acá.
  destino.searchParams.set("volver", pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // `/gestion` suelto va aparte de `/gestion/:path*` para no depender de si el
  // patrón acepta cero segmentos: la portada es justamente el árbol de
  // clientes, que es lo que más importa cerrar.
  matcher: ["/gestion", "/gestion/:path*", "/diagnostico"],
};
