// Envoltorio de todo lo que ve la agencia.
//
// Vive aparte del portal a propósito: distinta barra, distinta sesión y, sobre
// todo, distinto acceso a datos. Lo único que comparten los dos mundos es la
// base de datos y las reglas del dominio.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3 px-6 py-3">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
            Mesa de trabajo
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-blue-700">
            Administración
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
