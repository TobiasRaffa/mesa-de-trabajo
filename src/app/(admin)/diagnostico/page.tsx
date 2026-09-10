// Pantalla de diagnóstico: prueba que toda la cadena funcione.
// Netlify → variables de entorno → Google Drive → miniaturas.
// Se borra cuando empiece la aplicación de verdad.

import { variablesFaltantes } from "@/lib/entorno";
import { clientesHabilitados } from "@/lib/clientes";
// Acá sí corresponde preguntarle a Drive directamente: esta pantalla existe
// para mirar la conexión con Drive, no el estado del trabajo.
// eslint-disable-next-line no-restricted-imports
import { listarCarpeta, type ArchivoDrive } from "@/lib/google";

// Sin esto Next intentaría resolver la página al compilar, y queremos
// que pregunte a Drive cada vez que alguien entra.
export const dynamic = "force-dynamic";

export default async function Diagnostico() {
  const faltantes = variablesFaltantes();

  let archivos: ArchivoDrive[] | null = null;
  let error: string | null = null;

  if (faltantes.length === 0) {
    try {
      archivos = await listarCarpeta((await clientesHabilitados())[0]?.id ?? "");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const anduvo = faltantes.length === 0 && !error;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
        Mesa de trabajo · diagnóstico
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        ¿Llega la aplicación hasta Drive?
      </h1>

      {faltantes.length > 0 && (
        <div className="mt-8 border-l-2 border-amber-600 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Falta configurar el entorno.</p>
          <ul className="mt-3 space-y-1">
            {faltantes.map((v) => (
              <li key={v.nombre} className="text-sm text-amber-900">
                <code className="font-mono font-semibold">{v.nombre}</code>
                <span className="text-amber-800"> — {v.para}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-amber-800">
            En tu máquina se cargan desde <code className="font-mono">.env.local</code>. En
            Netlify, en Site settings → Environment variables.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-8 border-l-2 border-red-600 bg-red-50 p-5">
          <p className="font-semibold text-red-900">No llegó.</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-red-800">
            {error}
          </pre>
        </div>
      )}

      {anduvo && archivos && (
        <div className="mt-8 border-l-2 border-emerald-600 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">
            Llegó. {archivos.length} archivos leídos de la carpeta.
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            La cuenta de servicio, las variables de entorno y la conexión con Drive funcionan.
          </p>
        </div>
      )}

      {archivos && archivos.length > 0 && (
        <>
          <h2 className="mt-12 font-mono text-xs uppercase tracking-widest text-slate-500">
            Miniaturas servidas por nuestro servidor
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {archivos.map((a) => (
              <li key={a.id} className="overflow-hidden border border-slate-200 bg-white">
                {/* El nombre queda de fondo. Si la miniatura no carga se ve el
                    nombre en lugar de un ícono roto. Sin JavaScript. */}
                <div className="relative grid aspect-square place-items-center bg-slate-100 p-2">
                  <span className="text-center font-mono text-[10px] leading-tight text-slate-400">
                    {a.name}
                  </span>
                  {a.thumbnailLink && (
                    // Va a nuestro servidor, nunca directo a Google: la URL de
                    // Drive no llega al navegador y el pedido sale sin Referer.
                    // El parámetro v invalida la caché si el archivo cambia.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/miniatura/${a.id}?px=400&v=${encodeURIComponent(
                        a.modifiedTime ?? ""
                      )}`}
                      alt={a.name}
                      className="absolute inset-0 h-full w-full bg-slate-100 object-cover"
                    />
                  )}
                </div>
                <p className="truncate border-t border-slate-200 p-2 font-mono text-[11px] text-slate-600">
                  {a.name}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
