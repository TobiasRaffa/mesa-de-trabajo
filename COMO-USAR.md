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
| **Mesa de trabajo — ENCENDER** | Prende el servidor y abre el portal. Es el primero que hay que tocar. |
| **Mesa de trabajo — Portal del cliente** | Lo que ve el cliente |
| **Mesa de trabajo — Administración** | Lo que ve la agencia |

Se toca **ENCENDER**, se espera unos segundos y el navegador se abre solo. Se
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
| Administración | `/diagnostico` |

Por ahora el portal muestra siempre la misma entrega de ejemplo, escribas lo
que escribas después de `/t/`. Cuando exista la base de datos, ahí va a ir el
token de verdad y va a pedir el tag del cliente.
