"use client";

// El fondo gris de una ventana emergente, que cierra al tocarlo.
//
// **Existe por un error que se repitió en cuatro pantallas.** Cada ventana
// escribía su propio fondo con `onClick={onCerrar}` y le ponía al recuadro de
// adentro un `stopPropagation` para que tocar adentro no la cerrara. Funciona,
// pero cortar la propagación es una regla que hay que acordarse de escribir en
// cada recuadro nuevo, y con dos ventanas apiladas —la configuración de una
// pieza encima del trabajo— **no alcanza**: tocar el fondo de la de arriba
// para cerrarla le llegaba igual al fondo de la de abajo, y se cerraban las
// dos de golpe. Quien iba a cambiar los días de revisión terminaba de vuelta
// en el tablero sin haber cambiado nada.
//
// Acá se pregunta al revés, y la pregunta correcta es una sola: **¿el toque
// fue en el fondo mismo, o en algo que está adentro?** Solo el fondo cierra.
// Así ni hace falta el `stopPropagation`, ni importa quién esté apilado encima
// de quién.

import { useEffect, type ReactNode } from "react";

export function Fondo({
  onCerrar,
  className = "",
  children,
}: {
  onCerrar: () => void;
  /** Cómo se acomoda el recuadro adentro: al centro, abajo, con qué aire. */
  className?: string;
  children: ReactNode;
}) {
  // **Traba el fondo mientras hay una ventana.** Lo hacía una sola de las seis
  // —la imagen ampliada— y en las otras cinco la página de atrás corría con la
  // rueda: se abría una pieza, se bajaba para leer lo que pidió el cliente, y
  // lo que se movía era el tablero de atrás. Al cerrar, la pantalla estaba en
  // otro lado. Acá es el único componente por el que pasan todas, así que deja
  // de ser algo que cada ventana nueva tenga que acordarse.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 bg-tinta/50 ${className}`}
      onClick={(e) => {
        // `currentTarget` es este div; `target`, lo que se tocó de verdad. Si
        // no son el mismo, el toque fue adentro de la ventana.
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      {children}
    </div>
  );
}
