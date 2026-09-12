// Las facturas de cada cliente, para la agencia.
//
// **El cliente no las ve nunca.** El permiso de archivos niega cualquier cosa
// que cuelgue de «Facturas» cuando quien pregunta es un cliente, así que esto
// no es solo que la pantalla no las dibuje: no se sirven. Acá es al revés —la
// agencia ve todo lo que el robot ve— y por eso esta pantalla existe.
//
// La carpeta se busca por nombre dentro de la carpeta del cliente, igual que
// «Entregas finales»: la agencia arma un cliente nuevo entero desde Drive, sin
// configurar nada en la aplicación. Un cliente sin carpeta «Facturas» aparece
// igual, diciendo que no la tiene. Es información, no un error: la mayoría no
// la va a tener.

import { esCarpetaDeFacturas } from "@/lib/ajustes";
import { clientesHabilitados } from "@/lib/clientes";
// Acá sí corresponde preguntarle a Drive en crudo. `piezasDeLaCarpeta` existe
// porque una pieza aprobada se muda a «Entregas finales» y deja de estar en el
// listado; una factura no es una pieza, no se revisa y no se muda nunca. Lo
// que hay en la carpeta es exactamente lo que hay que mostrar.
// eslint-disable-next-line no-restricted-imports
import { archivosDe, subcarpetasDe, type ArchivoDrive } from "@/lib/google";

export type FacturaDeCliente = {
  id: string;
  nombre: string;
  /** Cuándo se subió a Drive. Es lo más cerca de «cuándo se emitió». */
  modificado?: string;
  mimeType: string;
};

export type FacturasDeUnCliente = {
  clienteId: string;
  cliente: string;
  /** La carpeta «Facturas» en Drive, si existe. */
  carpetaId: string | null;
  enlaceDrive?: string;
  facturas: FacturaDeCliente[];
  /** Drive no contestó por este cliente. No es lo mismo que no tener ninguna. */
  fallo: boolean;
};

export async function lasFacturas(): Promise<FacturasDeUnCliente[]> {
  const clientes = await clientesHabilitados();

  return Promise.all(
    clientes.map(async (cliente): Promise<FacturasDeUnCliente> => {
      const base = {
        clienteId: cliente.id,
        cliente: cliente.nombre,
        carpetaId: null,
        facturas: [],
        fallo: false,
      };

      try {
        const carpeta = (await subcarpetasDe(cliente.id)).find((c) =>
          esCarpetaDeFacturas(c.name)
        );
        if (!carpeta) return base;

        const archivos = await archivosDe(carpeta.id);
        return {
          ...base,
          carpetaId: carpeta.id,
          enlaceDrive: carpeta.webViewLink,
          // Lo más nuevo primero: una factura vieja se busca, una nueva se mira.
          facturas: archivos
            .map((a: ArchivoDrive) => ({
              id: a.id,
              nombre: a.name,
              modificado: a.modifiedTime,
              mimeType: a.mimeType,
            }))
            .sort((a, b) => (b.modificado ?? "").localeCompare(a.modificado ?? "")),
        };
      } catch {
        // Un cliente que Drive no contesta no puede tumbar la pantalla entera,
        // pero tampoco puede pasar por «no tiene facturas»: son cosas distintas
        // y confundirlas haría buscar una factura que sí está.
        return { ...base, fallo: true };
      }
    })
  );
}
