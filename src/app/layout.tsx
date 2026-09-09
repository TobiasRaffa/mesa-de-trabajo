import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

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
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa de trabajo",
  description: "Revisión y aprobación de piezas entre la agencia y sus clientes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
