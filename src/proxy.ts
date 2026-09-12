// Quién está mirando, del lado de la agencia.
//
// **Esto ya no es una puerta.** Durante un tiempo pidió la contraseña del
// equipo antes de mostrar nada de `/gestion`, y se sacó a pedido: adentro de
// la agencia, escribirla en cada máquina todos los días era fastidio y nada
// más, porque quien llega a la computadora ya está adentro de la oficina.
//
// Lo que quedó es **una marca**: una galleta que dice «este navegador es el
// del equipo». No cierra nada —cualquiera que escriba la dirección la recibe—
// pero sirve para lo que sí importa hoy: las rutas que sirven archivos
// preguntan quién pide, y un cliente que entró por su portal tiene que ver lo
// suyo y nada más. Sin esta marca, gestión se quedaba sin miniaturas.
//
// Se firma con `CLAVE_DE_ADMIN` igual que antes, así que cambiar esa clave
// invalida las marcas viejas.
//
// **Antes de subir esto a internet hay que volver a poner la puerta.** Está
// anotado como bloqueante en DESPLIEGUE.md: con la dirección alcanza para
// entrar, y adentro está el árbol de clientes, los chats y los links de todos.
//
// En Next 16 esto se llama `proxy` y ya no `middleware`, y corre en Node por
// omisión, que es lo que permite firmar con `node:crypto` acá adentro.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GALLETA_DE_GESTION,
  galletaDeGestionValida,
  valorDeGalletaDeGestion,
} from "@/lib/contrasena";

export function proxy(request: NextRequest) {
  const respuesta = NextResponse.next();

  // Ya la tiene y es nuestra: no se toca. Reescribirla en cada pedido sería
  // mandar una cabecera de más en cada imagen de cada pantalla.
  if (galletaDeGestionValida(request.cookies.get(GALLETA_DE_GESTION)?.value)) {
    return respuesta;
  }

  const valor = valorDeGalletaDeGestion();
  // Sin `CLAVE_DE_ADMIN` no hay con qué firmar. No se rompe nada: gestión abre
  // igual, y lo único que se pierde son las miniaturas de sus pantallas.
  if (!valor) return respuesta;

  respuesta.cookies.set(GALLETA_DE_GESTION, valor, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return respuesta;
}

export const config = {
  // `/gestion` suelto va aparte de `/gestion/:path*` para no depender de si el
  // patrón acepta cero segmentos.
  matcher: ["/gestion", "/gestion/:path*", "/diagnostico"],
};
