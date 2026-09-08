// Acceso a datos del lado del cliente.
// Provisorio hasta que exista la base de datos.

export type ProyectoDelCliente = { id: string; nombre: string };

export async function proyectoVisible(_linkId: string): Promise<ProyectoDelCliente | null> {
  return null;
}
