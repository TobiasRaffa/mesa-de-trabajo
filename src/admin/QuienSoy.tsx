"use client";

// Quién está usando la aplicación, al pie de la barra.
//
// **No es un login.** No pide contraseña: se elige el nombre de la lista del
// equipo y queda anotado en ese navegador. Quien se sienta en esa computadora
// ya está adentro de la oficina; lo que faltaba no era una puerta, era que la
// aplicación supiera **quién**.
//
// Sirve para que los mensajes al cliente salgan firmados con el nombre de
// quien los escribe, en vez de un «El equipo» que no dice nada. Y va a servir
// para más: que la bandeja muestre lo de cada uno, que quede anotado quién
// entregó o reabrió algo.
//
// Está al pie y no arriba porque se toca una vez y no se vuelve a mirar. Pero
// **se ve siempre**: si no estuviera a la vista, nadie se daría cuenta de que
// está escribiendo con el nombre de quien usó la computadora antes.

import { useTransition } from "react";
import { decirQuienSoy } from "@/app/(admin)/gestion/acciones";
import type { Persona } from "@/lib/equipo";

export function QuienSoy({ equipo, yo }: { equipo: Persona[]; yo: Persona | null }) {
  const [cambiando, cambiar] = useTransition();

  if (equipo.length === 0) {
    return (
      <p className="text-micro text-lienzo/45">
        Cargá el equipo en Admin para poder firmar con tu nombre.
      </p>
    );
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-micro font-extrabold uppercase tracking-widest text-lienzo/45">
        Sos
      </span>
      <select
        value={yo?.id ?? ""}
        disabled={cambiando}
        onChange={(e) => {
          const quien = e.target.value;
          cambiar(() => {
            decirQuienSoy(quien);
          });
        }}
        className="min-h-toque w-full border border-lienzo/25 bg-tinta px-2 text-normal
                   font-bold tracking-tight text-lienzo disabled:opacity-50"
      >
        <option value="">Nadie en particular</option>
        {equipo.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
