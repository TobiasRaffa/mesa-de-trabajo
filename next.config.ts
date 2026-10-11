import type { NextConfig } from "next";

const enProduccion = process.env.NODE_ENV === "production";

/**
 * Cabeceras de seguridad.
 *
 * Next no pone ninguna por su cuenta, así que sin esto la aplicación sale a
 * internet sin defensas que no cuestan nada.
 *
 * La que más importa acá es `frame-ancestors`. Sin ella, cualquiera puede
 * meter el portal dentro de un marco invisible en otra página y hacer que un
 * cliente apruebe un trabajo creyendo que hace otra cosa. Es el ataque más
 * plausible contra una pantalla cuyo botón principal aprueba trabajo.
 */
const CABECERAS = [
  {
    // El navegador no adivina el tipo de un archivo: si decimos que es una
    // imagen, la trata como imagen y nunca como código.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // El link del cliente lleva su token. Sin esto, viaja en la cabecera
    // Referer a cualquier sitio que se abra desde adentro del portal.
    //
    // **`same-origin` y no `no-referrer`, y la diferencia tiraba abajo la
    // aplicación entera.** Con `no-referrer`, el navegador manda además la
    // cabecera `Origin` en `null` —lo dice la especificación: sin referente,
    // el origen se serializa como nulo—. Next compara ese `Origin` con el host
    // para protegerse de CSRF en las Server Actions y aborta la acción cuando
    // no coinciden; la única razón por la que esto no se vio nunca es que
    // **saltea la comprobación en `localhost`**, que es donde se programa.
    //
    // Entrando por cualquier otra dirección —la red de casa, el dominio real—
    // no andaba una sola acción: ni entrar, ni la clave del portal, ni
    // aprobar, ni entregar. La pantalla quedaba en blanco y el servidor
    // contestaba 500.
    //
    // `same-origin` hace lo que el párrafo de arriba quería: a cualquier sitio
    // ajeno no le llega nada, así que el token del cliente sigue sin viajar.
    // Adentro de nuestro propio origen sí, que es lo que el navegador necesita
    // para poder decir de dónde viene el formulario.
    key: "Referrer-Policy",
    value: "same-origin",
  },
  {
    // Para navegadores viejos que no entienden frame-ancestors.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Nada de esto lo necesita una pantalla de revisión de bocetos.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Una política parcial, a propósito.
    //
    // Falta `script-src`, que es la parte más valiosa, pero exige firmar cada
    // script que Next genera y romperlo es fácil. Lo que está acá no puede
    // romper nada y ya cierra las puertas más grandes: que nos metan en un
    // marco, que reescriban la base de las direcciones, que manden un
    // formulario a otro sitio, o que carguen un complemento.
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      // Las miniaturas pasan por nuestro servidor, así que no hace falta
      // permitir ningún origen de imágenes ajeno.
      "img-src 'self' data:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // El indicador de desarrollo de Next vive abajo a la izquierda, que es
  // justo donde está «Admin» en la barra de gestión: lo tapaba. Se corre a la
  // derecha. Solo aparece mientras se programa, pero la agencia usa la
  // aplicación así todos los días hasta que se suba.
  devIndicators: { position: "bottom-right" },

  // **Sin caché de Turbopack al compilar.** Esa caché anota las variables de
  // entorno que leyó (para saber cuándo recompilar), así que guarda los valores
  // de las claves. El escáner de secretos de Netlify la revisa y frena el
  // despliegue. Compilar sin ella tarda unos segundos más, nada más.
  experimental: { turbopackFileSystemCacheForBuild: false },

  // Next anuncia su presencia en cada respuesta. No hace falta.
  poweredByHeader: false,

  /**
   * Desde qué direcciones se puede abrir mientras se programa.
   *
   * Next bloquea sus recursos de desarrollo —el websocket que recarga la
   * pantalla, el detalle de un error— cuando la petición no viene de
   * `localhost`. Probar desde el teléfono, que es la única forma de ver de
   * verdad cómo queda en un teléfono, entra por la dirección de la red de
   * casa: la aplicación anda igual, pero la consola se llena de errores y el
   * cartel de error de Next no se puede abrir.
   *
   * Es **solo de desarrollo**: `next start` no mira esto.
   */
  allowedDevOrigins: ["192.168.0.*"],

  /**
   * Direcciones que se mudaron.
   *
   * **Un link que alguien guardó no se puede morir en silencio.** Las dos de
   * acá existieron durante días, así que hay accesos directos, marcadores y
   * pestañas abiertas apuntando ahí: el día que se movieron, quien las tenía
   * guardadas se encontró con un «no existe» y no con el lugar nuevo.
   *
   * **Temporales y no permanentes**, a propósito. Una redirección permanente la
   * recuerda el navegador para siempre, y una dirección que hoy se mudó puede
   * volver a existir mañana: si el navegador se la aprendió, no habría forma de
   * llegar a la nueva.
   *
   * Eso pasó, y por eso el párrafo de arriba no es teórico. Había acá una que
   * mandaba `/gestion/entrar` a `/gestion`, de cuando la puerta se sacó. Al
   * volver a poner la puerta, esa regla la tapó: entrar redirigía a gestión,
   * gestión redirigía a entrar, y la aplicación quedó dando vueltas sobre sí
   * misma. Se salvó de ser permanente por poco.
   */
  async redirects() {
    return [
      {
        // El equipo se mudó a Admin, junto con las claves de los clientes.
        source: "/gestion/equipo",
        destination: "/gestion/admin",
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:ruta*",
        headers: enProduccion
          ? [
              ...CABECERAS,
              {
                // Solo tiene sentido sobre HTTPS, y en la máquina de desarrollo
                // molestaría: el navegador recordaría que este dominio va por
                // HTTPS y localhost dejaría de abrir.
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains",
              },
            ]
          : CABECERAS,
      },
    ];
  },
};

export default nextConfig;
