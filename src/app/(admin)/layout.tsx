// Envoltorio de todo lo que ve la agencia.
//
// Vive aparte del portal a propósito: distinta barra, distinta sesión y, sobre
// todo, distinto acceso a datos. Lo único que comparten los dos mundos es la
// base de datos y las reglas del dominio.
//
// La barra es oscura y la del portal no: entrar acá tiene que sentirse como
// entrar a otro lado, para que nadie confunda la pantalla donde se configura
// con la pantalla que ve el cliente.

import Link from "next/link";

const SECCIONES = [
  { href: "/gestion", texto: "Clientes" },
  { href: "/gestion/chats", texto: "Conversaciones" },
  { href: "/diagnostico", texto: "Diagnóstico" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-tinta text-lienzo">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
          <span className="text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
            Mesa de trabajo
          </span>

          <nav className="flex flex-wrap items-center gap-x-1">
            {SECCIONES.map((seccion) => (
              <Link
                key={seccion.href}
                href={seccion.href}
                className="px-3 py-1.5 text-normal font-bold tracking-tight text-lienzo/70
                           transition-colors hover:bg-lienzo/10 hover:text-lienzo"
              >
                {seccion.texto}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
