// Los errores del navegador, al panel de errores.
//
// Solo se carga si hay `NEXT_PUBLIC_SENTRY_DSN`: sin él, el portal no baja ni
// un byte de más. Qué se manda y qué se limpia antes está en
// `src/lib/errores.ts`.

import { dsnDeSentry, opcionesDeSentry } from "@/lib/errores";

if (dsnDeSentry()) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(opcionesDeSentry()));
}
