// Cuando Drive no contesta, del lado de la agencia.
//
// Acá **sí** se muestra el detalle: esta pantalla la ve la agencia, que es
// justamente quien tiene que enterarse de qué está mal y puede arreglarlo. En
// el portal es al revés, porque ahí lo abre gente de afuera.

export function ErrorDeDrive({ error }: { error: unknown }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-grande font-extrabold tracking-tight">No pude leer Drive</h1>
      <p className="mt-4 border-l-4 border-alerta bg-alerta-tenue px-4 py-3 font-mono text-menudo text-alerta">
        {error instanceof Error ? error.message : "Error desconocido"}
      </p>
      <p className="mt-4 text-normal text-tinta-suave">
        Suele ser que la carpeta todavía no está compartida con el robot, o que cambió su
        dirección.
      </p>
    </main>
  );
}
