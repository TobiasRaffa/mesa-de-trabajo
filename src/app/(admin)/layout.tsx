// Envoltorio de todo lo que ve la agencia.
//
// Vive aparte del portal a propósito: distinta barra, distinta sesión y, sobre
// todo, distinto acceso a datos. Lo único que comparten los dos mundos es la
// base de datos y las reglas del dominio; que no se toquen entre ellos lo
// vigila ESLint, y además `cimientos.test.ts` leyendo los archivos.
//
// La barra va al costado, como la del portal, pero lo que muestra es lo
// contrario: la del cliente lista sus carpetas, esta lista las secciones de la
// agencia. Que se parezcan no confunde, porque el cliente nunca ve esta.

import { BarraLateral } from "@/admin/BarraLateral";
import { misAvisos } from "@/admin/datos/clientes";
import { miSesion } from "@/lib/sesion";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Quién entró y qué le toca, para que la barra lo diga y dibuje solo lo suyo.
  // Se pregunta acá y no adentro de la barra porque la barra corre en el
  // navegador, y quién sos lo sabe la galleta del servidor.
  const sesion = await miSesion();

  // Cuántas notificaciones sin leer, para que el número viva en la barra y se
  // vea desde cualquier pantalla y no solo desde el tablero. Si Drive no
  // contesta, la barra se dibuja igual sin número: no es lo que se vino a ver.
  const sinLeer = sesion?.persona
    ? await misAvisos()
        .then((a) => a.filter((x) => !x.loVi).length)
        .catch(() => 0)
    : 0;

  return (
    // `min-h-screen` en el contenedor y no en la barra: así el fondo claro
    // llega abajo aunque la pantalla tenga poco contenido.
    <div className="flex min-h-screen flex-col bg-papel lg:flex-row">
      <BarraLateral
        quien={sesion?.persona?.nombre ?? null}
        secciones={sesion?.secciones ?? []}
        sinLeer={sinLeer}
      />
      {/* `min-w-0` para que una tabla o un nombre largo no empujen la columna
          y saquen la página de ancho. Ya pasó en el portal. */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
