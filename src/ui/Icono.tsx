// Los iconos de la aplicación.
//
// Dibujados a mano y no traídos de una librería: son ocho, pesan nada, y una
// librería entera para ocho formas es carga que el cliente paga en el teléfono.
//
// Todos comparten la misma caja de 24 y el mismo grosor de trazo, que es lo que
// hace que se vean de la misma familia. `currentColor` los deja tomar el color
// del texto que los rodea, así nunca desentonan con el botón que los contiene.

type Props = { className?: string };

const base = "h-[1.15em] w-[1.15em] shrink-0";

function Trazo({ children, className }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export const IconoCerrar = (p: Props) => (
  <Trazo {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Trazo>
);

export const IconoAmpliar = (p: Props) => (
  <Trazo {...p}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </Trazo>
);

export const IconoComparar = (p: Props) => (
  <Trazo {...p}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="16" rx="1.5" />
  </Trazo>
);

export const IconoDescargar = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </Trazo>
);

export const IconoEnviar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Trazo>
);

export const IconoAprobar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 12.5l5.5 5.5L20 7" />
  </Trazo>
);

export const IconoEditar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </Trazo>
);

export const IconoDeshacer = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 8h11a5 5 0 0 1 0 10H9M4 8l4-4M4 8l4 4" />
  </Trazo>
);

export const IconoFlecha = (p: Props) => (
  <Trazo {...p}>
    <path d="M9 6l6 6-6 6" />
  </Trazo>
);

export const IconoMas = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 5v14M5 12h14" />
  </Trazo>
);

export const IconoBorrar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Trazo>
);

// Un globo de diálogo: «hay mensajes». Va al lado de un número y nada más,
// donde poner la palabra «mensajes» ocuparía lo que la lista no tiene.
export const IconoMensaje = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4v-4A1.5 1.5 0 0 1 4 14.5v-9z" />
  </Trazo>
);

// Una campana: «hay notificaciones». Al lado de un número, en el encabezado
// del tablero, donde la palabra ocupaba lo que el número necesita.
export const IconoCampana = (p: Props) => (
  <Trazo {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Trazo>
);

// El triángulo de Drive, simplificado a sus tres planos.
export const IconoDrive = (p: Props) => (
  <Trazo {...p}>
    <path d="M8.5 3h7l5.5 9.5-3.5 6h-11l-3.5-6L8.5 3z" />
    <path d="M8.5 3l5.5 9.5M15.5 3l-5.5 9.5M3 12.5h11" />
  </Trazo>
);

// El engranaje de siempre: la ruedita dentada que todo el mundo reconoce como
// «configuración». Ocho dientes y el agujero del medio; menos que eso se lee
// como un sol, y más se empasta a este tamaño.
export const IconoConfig = (p: Props) => (
  <Trazo {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-1.9-3.3-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14.2 2h-3.8l-.3 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-1.9 3.3 1.9 1.5a7.6 7.6 0 0 0 0 3l-1.9 1.5 1.9 3.3 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.3 2.4h3.8l.3-2.4a7.6 7.6 0 0 0 2.6-1.5l2.3.9 1.9-3.3-1.9-1.5z" />
  </Trazo>
);
