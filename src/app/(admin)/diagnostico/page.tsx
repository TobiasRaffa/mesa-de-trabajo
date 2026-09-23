// Pantalla de diagnóstico: prueba que toda la cadena funcione.
// Netlify → variables de entorno → Google Drive → miniaturas.
//
// **Contesta si la conexión anda, no qué hay adentro.** Decía «se borra cuando
// empiece la aplicación de verdad», la aplicación empezó, y mientras tanto se
// había llenado de cosas que no hacen falta para diagnosticar nada: el nombre
// y el correo de quien comentó cada archivo, y el mensaje crudo del error de
// Google. Lo primero es dato de un cliente real; lo segundo puede traer
// identificadores de carpeta y la dirección del robot —es exactamente lo que
// la pantalla del portal se niega a mostrar, por escrito—.
//
// Ahora dice si llegó, cuántos archivos hay y si los comentarios se leen. Para
// saber **qué** dice un comentario está la ficha de la pieza, que es su lugar.

import { dondeSeGuarda } from "@/lib/almacen";
import { variablesFaltantes } from "@/lib/entorno";
import { misClientes } from "@/admin/datos/clientes";
import { urlDeMiniatura } from "@/lib/miniaturas";
// Acá sí corresponde preguntarle a Drive directamente: esta pantalla existe
// para mirar la conexión con Drive, no el estado del trabajo.
// eslint-disable-next-line no-restricted-imports
import { leerComentarios, listarCarpeta, type ArchivoDrive } from "@/lib/google";

// Sin esto Next intentaría resolver la página al compilar, y queremos
// que pregunte a Drive cada vez que alguien entra.
export const dynamic = "force-dynamic";

const ES_CARPETA = "application/vnd.google-apps.folder";

/** El primer archivo que no sea una carpeta, mirando un nivel hacia adentro. */
async function primerArchivo(
  archivos: ArchivoDrive[] | null
): Promise<ArchivoDrive | null> {
  if (!archivos) return null;

  const suelto = archivos.find((a) => a.mimeType !== ES_CARPETA);
  if (suelto) return suelto;

  for (const carpeta of archivos.filter((a) => a.mimeType === ES_CARPETA)) {
    try {
      const adentro = await listarCarpeta(carpeta.id);
      const hay = adentro.find((a) => a.mimeType !== ES_CARPETA);
      if (hay) return hay;
    } catch {
      // Una carpeta que no se deja leer no es motivo para no probar la próxima.
    }
  }
  return null;
}

export default async function Diagnostico() {
  const faltantes = variablesFaltantes();

  let archivos: ArchivoDrive[] | null = null;
  let error: string | null = null;

  if (faltantes.length === 0) {
    try {
      archivos = await listarCarpeta((await misClientes())[0]?.id ?? "");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      // La pantalla dice que el motivo quedó en los registros: que quede.
      console.error("[diagnostico] Drive", e);
    }
  }

  // **¿El robot puede leer los comentarios de Drive?**
  //
  // Se pregunta acá porque en el resto de la aplicación no se distingue: una
  // pieza sin comentarios y una pieza cuyos comentarios Google no nos deja
  // leer se ven exactamente igual —vacías—, y ese silencio es el que hace que
  // un permiso mal puesto pase meses sin que nadie lo note.
  let comentarios: {
    archivo: string;
    ok: boolean;
    detalle: string;
    /**
     * Lo que Drive contestó en `anchor`, tal cual, y qué hoja se leyó de ahí.
     *
     * **`anchor` es una cadena opaca por contrato**: Google dice que representa
     * una región del archivo y no promete ninguna forma. La hoja de un
     * comentario en un PDF sale de ahí, así que el día que Google le cambie la
     * forma, la hoja va a dejar de aparecer **en silencio**. Esta lista es el
     * único lugar donde eso se ve.
     */
    anclas: Array<{ hoja?: number }>;
  } | null = null;
  // El primer archivo de verdad que se encuentre. La carpeta de un cliente
  // suele tener solo carpetas adentro, así que hay que bajar un escalón.
  const primero = await primerArchivo(archivos);
  if (primero) {
    const r = await leerComentarios(primero.id);
    // Mismo trato: la pantalla manda a buscar el motivo a los registros.
    if (!r.ok) console.error("[diagnostico] comentarios", r.motivo);
    comentarios = {
      archivo: primero.name,
      ok: r.ok,
      detalle: r.ok
        ? `${r.comentarios.length} ${r.comentarios.length === 1 ? "comentario" : "comentarios"}`
        : "Google no dejó leerlos. El motivo está en los registros del servidor.",
      // **Solo la hoja.** El nombre y el correo de quien comentó no hacen
      // falta para saber si Drive contesta, y son datos de gente real: ni
      // siquiera se juntan.
      anclas: r.ok ? r.comentarios.map((c) => ({ hoja: c.hoja })) : [],
    };
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

      {/*
        Dónde se guarda lo que la agencia carga. Es lo primero que hay que
        mirar después de subir la aplicación: en internet tiene que decir
        Supabase. Si dijera archivos, todo lo que se cargue se pierde en el
        próximo despliegue, y se perdería en silencio.
      */}
      <div
        className={`mt-8 border-l-2 p-5 ${
          dondeSeGuarda === "Supabase"
            ? "border-slate-300 bg-slate-50"
            : "border-amber-600 bg-amber-50"
        }`}
      >
        <p className="font-semibold">
          Lo que se carga se guarda en: <span className="font-mono">{dondeSeGuarda}</span>
        </p>
        {dondeSeGuarda === "archivos" && (
          <p className="mt-2 text-sm text-amber-900">
            Sirve acá, en esta computadora. En internet no: el disco es de solo
            lectura y se borra en cada despliegue. Antes de subir hay que cargar{" "}
            <code className="font-mono">SUPABASE_URL</code> y{" "}
            <code className="font-mono">SUPABASE_SERVICE_KEY</code>.
          </p>
        )}
      </div>

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
          {/* **El detalle va a los registros del servidor, no a la pantalla.**
              El mensaje de Google trae identificadores de carpeta y a veces la
              dirección de la cuenta de servicio. Es la misma regla que ya
              seguían las rutas de API y la pantalla del portal. */}
          <p className="mt-2 text-sm text-red-800">
            El motivo quedó en los registros del servidor. Lo más común es que
            falte compartirle la carpeta al robot, o que la llave esté vencida.
          </p>
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

      {comentarios && (
        <div
          className={`mt-4 border-l-2 p-5 ${
            comentarios.ok
              ? "border-emerald-600 bg-emerald-50"
              : "border-red-600 bg-red-50"
          }`}
        >
          <p
            className={`font-semibold ${
              comentarios.ok ? "text-emerald-900" : "text-red-900"
            }`}
          >
            {comentarios.ok
              ? `Comentarios de Drive: se pueden leer (${comentarios.detalle} en «${comentarios.archivo}»).`
              : `Comentarios de Drive: no se pudieron leer. ${comentarios.detalle}`}
          </p>
          <p
            className={`mt-1 text-sm ${
              comentarios.ok ? "text-emerald-800" : "text-red-800"
            }`}
          >
            Es lo que hace que lo escrito encima de un PDF en Drive aparezca en
            la pantalla de la carpeta, junto a lo que el cliente marcó en el portal.
          </p>

          {/* **Cuántos se leyeron y si traen hoja, sin nombrar a nadie.**
              Se listaba uno por uno con el nombre y el correo de quien lo
              escribió —gente real, clientes de la agencia— para diagnosticar
              algo que se contesta con dos números. */}
          {comentarios.anclas.length > 0 && (
            <p className="mt-3 font-mono text-xs text-emerald-900">
              {comentarios.anclas.length}{" "}
              {comentarios.anclas.length === 1 ? "comentario leído" : "comentarios leídos"}
              {"; "}
              {comentarios.anclas.filter((a) => a.hoja !== undefined).length} con la hoja
              reconocida.
            </p>
          )}
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
                      src={urlDeMiniatura(a.id, 400, a.modifiedTime)}
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
