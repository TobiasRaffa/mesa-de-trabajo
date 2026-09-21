// La carpeta de un cliente: cuándo sale cada pieza, y qué pasó con cada una.
//
// Es la pantalla que le faltaba al calendario del portal. Drive no sabe cuándo
// sale publicado un archivo —tiene fecha de subida, no de publicación— y no se
// puede deducir del nombre sin inventar. Lo pone la agencia acá, y el cliente
// ve exactamente eso.
//
// **Las fechas se ponen igual aunque la carpeta se vea como lista.** El cartel
// decía «podés ponerle fechas igual» y después no dibujaba nada con qué
// ponerlas: era una promesa sin lugar donde cumplirla. `guardarCalendario` no
// mira la vista, así que lo único que cambia con «lista» es que el cliente no
// las ve todavía, y eso es lo que dice el cartel.

import { EncabezadoDePagina, PANTALLA } from "@/admin/EncabezadoDePagina";
import { carpetaParaFechar } from "@/admin/datos/carpetas";
import { ArmarCalendario } from "@/admin/ArmarCalendario";
import { HistoriaDePiezas } from "@/admin/HistoriaDePiezas";
import { ErrorDeDrive } from "@/admin/ErrorDeDrive";

export const dynamic = "force-dynamic";

/**
 * De dónde se vino, para poder volver ahí.
 *
 * El «volver» apuntaba siempre a la ficha del cliente, viniera de donde
 * viniera: desde el tablero o desde una notificación, volver dejaba en una
 * pantalla por la que no se había pasado, y el camino de vuelta era el botón
 * del navegador. Quien manda el link dice de dónde viene.
 */
const DESDE: Record<string, { href: string; texto: string }> = {
  tablero: { href: "/gestion/tablero", texto: "Tablero" },
  notificaciones: { href: "/gestion/notificaciones", texto: "Notificaciones" },
  clientes: { href: "/gestion", texto: "Clientes" },
};

export default async function Carpeta({
  params,
  searchParams,
}: PageProps<"/gestion/cliente/[clienteId]/carpeta/[carpetaId]">) {
  const { clienteId, carpetaId } = await params;
  const { desde } = await searchParams;

  let datos;
  try {
    datos = await carpetaParaFechar(clienteId, carpetaId);
  } catch (error) {
    return <ErrorDeDrive error={error} titulo="La carpeta" />;
  }

  const enCalendario = datos.carpeta.vista === "calendario";
  const volver =
    (typeof desde === "string" ? DESDE[desde] : undefined) ?? {
      href: `/gestion/cliente/${clienteId}`,
      texto: datos.cliente.nombre,
    };

  return (
    <main className={PANTALLA}>
      <EncabezadoDePagina volver={volver} titulo={datos.carpeta.nombre} />

      {!enCalendario && (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          Esta carpeta está marcada como <strong>lista</strong>, así que el cliente no ve
          un calendario. Las fechas que pongas acá quedan guardadas igual; para que las
          vea, pasala a calendario desde la configuración de esta carpeta, en Clientes.
        </p>
      )}

      {datos.piezas.length === 0 ? (
        <p className="mt-8 border-l-4 border-espera-borde bg-espera-tenue px-5 py-4 text-normal text-espera">
          No hay archivos en esta carpeta todavía.
        </p>
      ) : (
        <ArmarCalendario
          carpetaId={carpetaId}
          piezas={datos.piezas}
          visible={datos.carpeta.visible}
        />
      )}

      <HistoriaDePiezas piezas={datos.historia} />
    </main>
  );
}
