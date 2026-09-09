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

Administración tiene tres secciones, arriba:

### Clientes (`/gestion`)

**La lista se descubre sola.** Un cliente aparece acá cuando alguien le
comparte su carpeta al robot desde Drive. No hay que darlo de alta.

De cada uno podés:

- **Darle o quitarle acceso.** Quitar acceso apaga su portal sin tocar Drive.
- **Copiar su link.** Es lo que se le manda por WhatsApp: `/t/<algo largo>`.
- **Cambiar el link.** El viejo deja de funcionar en el acto. Sirve cuando se
  fue alguien de la empresa del cliente, o el link se reenvió a quien no
  correspondía.
- **Entrar a sus carpetas.**

### Las carpetas de un cliente

- **Ocultar o mostrar cada una.** Una carpeta nueva de Drive aparece sola y se
  muestra; ocultarla es la acción deliberada.
- **Pasarla a calendario o a lista.**
- **Armar el calendario**, si está en modo calendario.
- **Hablar con el cliente**, con la conversación de esa carpeta.

### Conversaciones (`/gestion/chats`)

Todas juntas, sin entrar cliente por cliente. Arriba de todo, **las que están
esperando tu respuesta** —o sea, donde el último que habló fue el cliente—.

Todo lo que elegís queda guardado al lado de la aplicación, en la carpeta
`datos`:

| Archivo | Qué guarda |
|---|---|
| `clientes.json` | Quién tiene acceso, y el link de cada uno |
| `ajustes.json` | Qué carpeta se muestra, y si es lista o calendario |
| `publicaciones.json` | Qué día sale publicada cada pieza |
| `conversaciones.json` | Los chats |

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


---

## El calendario

Una carpeta puesta en **calendario** tiene su propia pantalla para armarlo:
**Armar calendario**.

1. Se abre en modo mirar. Nada se puede mover por accidente.
2. **Editar fechas** habilita el arrastre.
3. Arrastrás cada pieza al día que sale. Las que todavía no tienen día están
   abajo, en «Sin fecha».
4. **Guardar** lo publica; **Cancelar** deja todo como estaba.

Se puede pasar de mes con las flechas, así que una grilla que arranca a fin de
mes se arma igual.

> Sin mouse: tocá una pieza de abajo para elegirla y después tocá el día.

Lo que guardás acá es exactamente lo que ve el cliente en su portal. No hay dos
copias: es el mismo dato leído por las dos pantallas.
