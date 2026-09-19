import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";
import { revisarLoQueInternetExige } from "@/lib/entorno";

// Se revisa acá porque este archivo se evalúa sí o sí al compilar, para todas
// las pantallas. Si en Netlify falta la contraseña del equipo o el secreto de
// las sesiones, el despliegue se cae con un mensaje que dice qué cargar y
// dónde, en vez de salir verde y romperse después con gente adentro.
revisarLoQueInternetExige();

// La fuente la sirve nuestro propio dominio, no Google.
//
// Next la descarga al compilar y la deja junto al resto de la aplicación. Eso
// evita un pedido a otro servidor mientras el cliente espera —en un teléfono
// con datos móviles se nota— y de paso no le cuenta a Google quién abrió el
// portal de la agencia.
//
// `display: swap` hace que el texto se vea desde el primer momento con la
// tipografía del sistema y cambie cuando la buena esté lista: preferimos texto
// feo a texto invisible.
const archivo = Archivo({
  variable: "--fuente-archivo",
  subsets: ["latin"],
  // Variable y con el eje de ancho: los titulares de Matter son anchos, y
  // Archivo lo trae. Con la fuente variable vienen todos los pesos en un solo
  // archivo, así que no hay que enumerarlos.
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

// La monoespaciada de las etiquetas chicas —«Mesa de trabajo», «Para
// revisar», el rótulo de cada sección—. Es la que Matter usa en sus piezas para
// el texto de apoyo, y acá cumple el mismo papel: dice de qué se trata lo que
// tiene al lado, sin pesar más que eso.
const mono = Space_Mono({
  variable: "--fuente-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa de trabajo · Matter",
  description: "Revisión y aprobación de piezas entre la agencia y sus clientes.",
  // Nada de esto va a un buscador. El link de un cliente es medio acceso: si
  // Google lo indexara, dejaría de serlo. Y las pantallas internas, menos.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
