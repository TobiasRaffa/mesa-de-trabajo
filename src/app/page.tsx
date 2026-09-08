import { redirect } from "next/navigation";

// La raíz no muestra nada: cada mundo tiene su propia entrada.
export default function Inicio() {
  redirect("/diagnostico");
}
