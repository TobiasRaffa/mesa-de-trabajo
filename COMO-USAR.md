# Cómo abrir Mesa de trabajo

## Lo primero: esto todavía no está en internet

La aplicación corre **en tu computadora**, no en un servidor de afuera. Eso
quiere decir dos cosas:

- Hay que **encenderla** antes de poder entrar. Cuando cerrás la ventana negra,
  se apaga.
- Solo se puede entrar **desde tu computadora, o desde un teléfono conectado al
  mismo wifi**. Nadie de afuera la ve.

Cuando la subamos a internet esto desaparece: va a estar prendida siempre y se
va a entrar desde cualquier lado con una dirección normal.

## Encenderla

En el escritorio hay tres accesos directos:

| | |
|---|---|
| **Mesa de trabajo — ENCENDER** | Prende el servidor y abre el portal del cliente |
| **Mesa de trabajo — ENCENDER gestion** | Prende el servidor y abre donde configurás vos |
| **Mesa de trabajo — Portal del cliente** | Lo que ve el cliente |
| **Mesa de trabajo — Administración** | Donde configurás vos |

Los dos que dicen **ENCENDER** hacen lo mismo con el servidor: cambian solo en
qué pantalla abren. Da igual cuál toques primero; si el servidor ya está
prendido, el segundo lo reusa.

Se toca uno de los **ENCENDER**, se espera unos segundos y el navegador se abre
solo. Se
abre también una ventana negra con letras: **esa ventana es el servidor y tiene
que quedar abierta**. Si la cerrás, la aplicación deja de responder.

Los otros dos accesos directos solo sirven con el servidor ya encendido.

## Entrar desde el teléfono

Con el servidor prendido y el teléfono en el mismo wifi que la computadora:

    http://192.168.0.67:3000/t/ejemplo

Esa dirección aparece escrita en la ventana negra cada vez que encendés, porque
**puede cambiar** si se reinicia el módem.

La primera vez Windows puede preguntar si permite el acceso a la red. Hay que
decirle que sí, o el teléfono no va a poder entrar.

## Las direcciones

| Qué | Dirección |
|---|---|
| Portal del cliente | `/t/<lo que sea>` |
| Administración | `/gestion` |
| Diagnóstico de Drive | `/diagnostico` |

Por ahora el portal muestra siempre el mismo cliente, escribas lo que escribas
después de `/t/`. Cuando exista la base de datos, ahí va a ir el token de
verdad y va a pedir el tag del cliente.

---

## Qué se puede configurar hoy

En **Administración** (`/gestion`):

- **Ocultar o mostrar cada carpeta.** Una carpeta nueva de Drive aparece sola y
  se muestra; ocultarla es la acción deliberada.
- **Pasarla a calendario o a lista.**
- **Hablar con el cliente.** Cada carpeta tiene su conversación. El cliente
  escribe desde el portal y vos contestás desde acá; el número al lado del
  botón dice cuántos mensajes hay.

Lo que elegís queda guardado al lado de la aplicación, en la carpeta `datos`:
los ajustes en `ajustes.json` y las conversaciones en `conversaciones.json`.
Se pueden abrir con el Bloc de notas y se pueden copiar. Cuando tengamos base
de datos, se mudan solos y las pantallas no cambian.

> Esa pantalla **todavía no pide usuario ni contraseña**. Alcanza mientras la
> aplicación corre en tu computadora y no está en internet. Antes de subirla
> hay que ponerle login.

---

## Cómo se marca una vuelta nueva de una pieza

Con el nombre del archivo, en Drive. Nada más.

    9304.jpeg       <- primera version
    9304 V2.jpeg    <- segunda vuelta de la MISMA pieza
    9304 V3.jpeg    <- tercera

Se juntan en una sola pieza: el cliente ve la última y le aparece el botón para
compararla con la anterior. Sirve `V2`, `v2`, `_v2` o `-v2`.

**La extensión cuenta.** `9304.jpg` y `9304.png` son dos piezas distintas, no
dos vueltas: entregar el mismo trabajo en dos formatos es común y juntarlos
sería mentir sobre qué se está aprobando.

---

## Carpetas con nombre reservado

`Entregas finales` no es un trabajo: no aparece como carpeta para revisar y no
se configura. Es a donde va lo aprobado.


---

## La conversación con el cliente

Cada carpeta tiene su propio chat. No es un chat con todo mezclado: lo que se
habla de «Banners» queda en «Banners».

| Quién | Desde dónde |
|---|---|
| El cliente | El portal, botón **Hablar con el equipo** |
| Vos | Administración, botón **Conversación** en cada carpeta |

Los mensajes se guardan **en el servidor**, así que el ida y vuelta funciona de
verdad entre las dos pantallas. Mientras el chat está abierto se actualiza solo
cada pocos segundos: no hace falta recargar.

> **Del otro lado siempre hay una persona.** La aplicación no contesta, no
> sugiere respuestas y no resume lo que dijo nadie. Si alguna vez parece
> contestar sola, algo se rompió y hay que avisar.
