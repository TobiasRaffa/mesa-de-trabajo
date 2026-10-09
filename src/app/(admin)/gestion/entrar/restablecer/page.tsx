// Elegir una contraseña nueva desde el link del correo.
//
// Es pública a propósito, igual que la entrada: quien llega acá todavía no tiene
// sesión. Lo que la protege es el token del link, que vence y sirve una sola vez
// (ver `lib/restablecer.ts`).

import { Restablecer } from "@/admin/Entrar";

export const dynamic = "force-dynamic";

export default async function PaginaDeRestablecer({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return <Restablecer token={t ?? ""} />;
}
