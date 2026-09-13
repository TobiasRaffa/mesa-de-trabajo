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
    key: "Referrer-Policy",
    value: "no-referrer",
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

  // Next anuncia su presencia en cada respuesta. No hace falta.
  poweredByHeader: false,

  /**
   * Direcciones que se mudaron.
   *
   * **Un link que alguien guardó no se puede morir en silencio.** Las dos de
   * acá existieron durante días, así que hay accesos directos, marcadores y
   * pestañas abiertas apuntando ahí: el día que se movieron, quien las tenía
   * guardadas se encontró con un «no existe» y no con el lugar nuevo.
   *
   * **Temporales y no permanentes**, a propósito. Un redirección permanente
   * la recuerda el navegador para siempre, y `/gestion/entrar` va a volver a
   * existir cuando se ponga la puerta antes de subir esto a internet: si el
   * navegador se la aprendió, no habría forma de llegar a la puerta nueva.
   */
  async redirects() {
    return [
      {
        // Era la pantalla de contraseña. Se sacó la puerta de gestión.
        source: "/gestion/entrar",
        destination: "/gestion",
        permanent: false,
      },
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
