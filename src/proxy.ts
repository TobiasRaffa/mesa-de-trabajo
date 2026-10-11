// Quién está mirando, del lado de la agencia, y qué le toca ver.
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
// **Y ahora además separa por sección.** Que la barra lateral no dibuje
// «Facturas» no es una protección: la dirección se escribe a mano. La
// protección es esta, y está acá por la misma razón que la puerta entera: es el
// único lugar por el que pasa todo, incluido lo que todavía no existe.
//
// **Las acciones de servidor pasan por acá también**, porque se mandan a la
// dirección de la pantalla que las dibujó: un POST a `/gestion/admin` con la
// acción de dar de alta gente se rebota igual que abrir esa pantalla. Aun así
// las acciones de Admin vuelven a preguntar por su cuenta —hay un guardián que
// lo verifica—: **que estén protegidas no puede depender de en qué pantalla se
// dibujó el formulario**, que es una decisión de quien arma la pantalla.
//
// En Next 16 esto se llama `proxy` y ya no `middleware`, y corre en Node por
// omisión, que es lo que permite firmar con `node:crypto` y leer quién es quién
// acá adentro.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GALLETA_DE_GESTION } from "@/lib/contrasena";
import { dondeEmpieza, seccionDeLaRuta } from "@/dominio/roles";
import { quienLleva } from "@/lib/sesion";
import { RESTABLECER } from "@/lib/restablecer";

/** Dónde se entra. Queda afuera de la puerta, o no se podría entrar. */
export const ENTRADA = "/gestion/entrar";

/**
 * El sitio del portal se despliega aparte, con `SOLO_PORTAL=1`. Ahí la agencia
 * no existe: lo que cuelga de `/gestion` y del diagnóstico responde 404 como si
 * no estuviera, sin ni siquiera ofrecer la puerta de entrada.
 */
function esSoloPortal() {
  return process.env.SOLO_PORTAL === "1";
}

/** Rutas de API que son solo de la agencia: en el sitio del portal no existen. */
const API_DE_LA_AGENCIA = ["/api/historial/", "/api/tareas"];

/**
 * Si el pedido lo mandó una página de otro sitio.
 *
 * **Las APIs atienden solo a esta aplicación.** El navegador avisa desde dónde
 * sale cada pedido (`Sec-Fetch-Site` y `Origin`): si sale de otro sitio, se
 * rechaza antes de llegar a la ruta. Un pedido sin esas cabeceras —abrir el
 * link a mano, o la tarea diaria de Netlify— no viene de otra página y pasa;
 * cada ruta sigue pidiendo su propia sesión o llave igual.
 *
 * No hay cabeceras CORS que abran nada: sin `Access-Control-Allow-Origin`, el
 * navegador ya no le deja a otro sitio leer las respuestas. Esto además corta
 * el pedido en sí.
 */
function deOtroSitio(request: NextRequest): boolean {
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio === "cross-site" || sitio === "same-site") return true;

  const origen = request.headers.get("origin");
  if (!origen) return false;
  try {
    return new URL(origen).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (ruta.startsWith("/api/")) {
    if (esSoloPortal() && API_DE_LA_AGENCIA.some((p) => ruta.startsWith(p))) {
      return new NextResponse(null, { status: 404 });
    }
    if (deOtroSitio(request)) return new NextResponse(null, { status: 403 });
    return NextResponse.next();
  }
  if (esSoloPortal() && (ruta.startsWith("/gestion") || ruta.startsWith("/diagnostico"))) {
    return new NextResponse(null, { status: 404 });
  }
  // La página de restablecer se abre sin sesión, igual que la entrada.
  if (ruta === ENTRADA || ruta === RESTABLECER) return NextResponse.next();

  const sesion = await quienLleva(request.cookies.get(GALLETA_DE_GESTION)?.value);
  if (!sesion) return aLaPuerta(request);

  // `null` es una dirección que nadie clasificó. Se trata como «acá no entra
  // nadie»: una pantalla nueva sin clasificar queda cerrada en vez de abierta,
  // y hay un guardián que avisa en las pruebas antes de que moleste a alguien.
  const seccion = seccionDeLaRuta(ruta);
  if (seccion && sesion.secciones.includes(seccion)) return NextResponse.next();

  // **Un pedido que no es de ir a una pantalla se contesta que no, y punto.**
  // Mandarlo a otro lado sería reenviarle el formulario a una pantalla que no
  // lo espera; y quien está mandando un POST a una sección que no es la suya
  // no se perdió: la está probando.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Esa parte no es tuya.", { status: 403 });
  }

  // Se perdió, o le cambiaron el acceso mientras tenía la pantalla abierta. Va
  // a la primera sección que sí puede ver, no a la puerta: hacerlo entrar de
  // nuevo no arreglaría nada, porque ya entró.
  const suya = dondeEmpieza(sesion.secciones);
  if (!suya) return aLaPuerta(request);

  const destino = request.nextUrl.clone();
  destino.pathname = suya;
  destino.search = "";
  return NextResponse.redirect(destino);
}

/**
 * A escribir la contraseña, y después a donde iba.
 *
 * Sin el «volver», quien abre un link a un trabajo puntual —de los que se pasan
 * por chat— entra y aparece en la pantalla de inicio, sin saber a dónde iba.
 */
function aLaPuerta(request: NextRequest) {
  const aEntrar = request.nextUrl.clone();
  aEntrar.pathname = ENTRADA;
  aEntrar.search = "";
  aEntrar.searchParams.set("volver", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(aEntrar);
}

export const config = {
  // `/gestion` suelto va aparte de `/gestion/:path*` para no depender de si el
  // patrón acepta cero segmentos.
  matcher: ["/gestion", "/gestion/:path*", "/diagnostico", "/api/:path*"],
};
