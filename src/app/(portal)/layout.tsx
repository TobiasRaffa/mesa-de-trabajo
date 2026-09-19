// Envoltorio de todo lo que ve el cliente.
//
// No comparte nada con administración salvo la base de datos. Ni la barra, ni
// la sesión, ni el acceso a datos: el código de acá no puede siquiera importar
// algo del otro lado, y el linter lo verifica.

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-papel">
      {/*
        El link de acceso no debe viajar a ningún sitio que se abra desde
        adentro del portal --Drive, por ejemplo--. Sin esto, la dirección
        completa se filtraría en la cabecera Referer.
      */}
      <meta name="referrer" content="no-referrer" />
      {children}
    </div>
  );
}
