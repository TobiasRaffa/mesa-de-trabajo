// La puerta del cliente: acá llega el link que le mandó la agencia.
//
// Todavía no hace nada: espera la base de datos para poder comprobar el token
// y pedir el tag. La ruta existe desde ahora para que la forma de la dirección
// quede fijada -- /t/<token al azar>, sin nombre de cliente adentro, porque el
// tag no puede estar escrito en la puerta.

export default async function Puerta({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
        Mesa de trabajo
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Un momento, todavía estamos construyendo esto
      </h1>
      <p className="mt-4 text-slate-600">
        Acá va a ir el pedido de la clave del cliente. El link llegó bien: son{" "}
        {token.length} caracteres.
      </p>
    </main>
  );
}
