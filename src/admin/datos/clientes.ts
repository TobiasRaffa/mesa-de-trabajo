// Acceso a datos del lado de la agencia.
// Provisorio hasta que exista la base de datos.

export type ClienteResumen = { id: string; nombre: string; tag: string };

export async function listarClientes(): Promise<ClienteResumen[]> {
  return [];
}
