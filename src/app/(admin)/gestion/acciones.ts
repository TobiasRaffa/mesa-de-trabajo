"use server";

// Lo que la pantalla de gestión puede cambiar.
//
// **Una acción de servidor es un endpoint público.** Next le cambia el cuerpo
// por una referencia en el navegador, pero la dirección queda accesible para
// cualquiera que sepa mandar el POST. Que el formulario solo se dibuje en una
// pantalla interna no protege nada.
//
// Por eso acá no se cree nada de lo que llega: el identificador de carpeta se
// compara contra las carpetas que de verdad existen adentro de la del cliente,
// y la vista solo puede ser una de las dos que conocemos. Sin eso, un POST
// armado a mano podría llenar el archivo de ajustes con lo que quisiera.
//
// Lo que todavía NO hay es autenticación: cualquiera que llegue a la máquina
// puede entrar. Hoy alcanza porque la aplicación corre en una computadora y no
// está en internet. Antes de subirla, esto necesita login.

import { revalidatePath } from "next/cache";
import { idsDeCarpetasReales } from "@/admin/datos/carpetas";
import { esCarpetaReservada, guardarAjustesDe, type Vista } from "@/lib/ajustesDeCarpeta";

export type Resultado = { ok: true } | { ok: false; motivo: string };

export async function guardarCarpeta(_previo: unknown, formulario: FormData) {
  const carpetaId = String(formulario.get("carpetaId") ?? "");
  const nombre = String(formulario.get("nombre") ?? "");
  const visible = formulario.get("visible") === "si";
  const vistaCruda = String(formulario.get("vista") ?? "lista");

  if (!carpetaId) return { ok: false as const, motivo: "Falta la carpeta." };

  const reales = await idsDeCarpetasReales();
  if (!reales.has(carpetaId)) {
    return {
      ok: false as const,
      motivo: "Esa carpeta no está adentro de la carpeta del cliente.",
    };
  }

  if (esCarpetaReservada(nombre)) {
    return {
      ok: false as const,
      motivo: "«Entregas finales» no se configura: no es un trabajo.",
    };
  }

  const vista: Vista = vistaCruda === "calendario" ? "calendario" : "lista";

  await guardarAjustesDe(carpetaId, { visible, vista });

  // La pantalla se vuelve a dibujar con lo guardado, en el mismo viaje.
  revalidatePath("/gestion");
  return { ok: true as const };
}
