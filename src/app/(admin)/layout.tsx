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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-tinta text-lienzo">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <Link
            href="/gestion"
            className="text-micro font-extrabold uppercase tracking-widest text-lienzo/50 transition-colors hover:text-lienzo"
          >
            Mesa de trabajo
          </Link>
          <span className="bg-lienzo px-2 py-0.5 text-micro font-extrabold uppercase tracking-widest text-tinta">
            Administración
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
