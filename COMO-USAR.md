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
| **Mesa de trabajo — ENCENDER gestion** | Prende el servidor y abre Administración |
| **Mesa de trabajo — Administración** | Solo abre, con el servidor ya prendido |

**Los dos ENCENDER hacen lo mismo.** Si el servidor ya está prendido, no
prenden otro: abren la aplicación y te avisan. Antes no chequeaban, y el
segundo fallaba con la ventana cerrándose sola —parecía que el acceso no hacía
nada—.

El acceso al portal entra por `/probar`, que lleva al primer cliente. Es un
atajo **solo mientras corre en tu computadora**: cuando la subamos a internet
esa dirección deja de existir y cada cliente entra con su link. Igual pide la
clave, como cualquiera.

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
| Administración | `/gestion` (pide correo y contraseña) |
| Diagnóstico de Drive | `/diagnostico` |

Por ahora el portal muestra siempre el mismo cliente, escribas lo que escribas
después de `/t/`. Cuando exista la base de datos, ahí va a ir el token de
verdad y va a pedir el tag del cliente.

---

## Qué se puede configurar hoy

Administración tiene cinco secciones, arriba:

### Qué pasó (`/gestion/tablero`)

La primera pantalla del día. Arriba, lo que hay que mirar hoy: las fechas
vencidas y los clientes que escribieron y nadie contestó. Abajo, cómo viene
cada trabajo.

En el medio está **la bandeja de novedades**: cada vez que un cliente aprueba,
pide cambios, manda la revisión o escribe, queda anotado ahí. Si el correo está
configurado, además le llega un mail a quien lleva ese trabajo.

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
- **Quién la lleva.**
- **Tiempo de revisión**, en días.
- **Su propio link**, si querés mandarle esa carpeta sola.

Y cada **archivo** tiene su propia ruedita, con quién lo lleva y su tiempo de
revisión. Es para los casos sueltos: «esta la necesitamos el jueves», «esta la
lleva Delfi aunque el resto sea de Nari».

Y abajo de todo, los **mensajes listos**: los textos que se mandan siempre, ya
escritos. Los abrís, los cambiás si querés, los copiás y los mandás por donde
le escribís siempre. **Los escribe el equipo, no la aplicación.**

### La ficha de un cliente (`/gestion/cliente/<id>`)

Arriba, **los números de la cuenta**: cuántas piezas, cuántas aprobadas,
vueltas por pieza, cuántas necesitaron más de dos, revisiones extra y cuántos
días tarda el cliente en decidir. Al lado, **Descargar historial (CSV)**: todo
lo que le pasó a cada pieza —quién, cuándo, qué—, para abrir en Excel.

En la lista de clientes, cada uno dice **cuándo entró al portal por última
vez**. Después de entregar, «no lo abrió» y «lo abrió y no decidió» piden
mensajes distintos. Con más de un cliente aparece un buscador, que filtra por
nombre de cliente y, adentro de los abiertos, por carpeta y archivo.

### Los recordatorios de plazo

Cuando una pieza entregada pasa la mitad de su plazo sin que el cliente decida,
entra un aviso en Notificaciones («va por la mitad del plazo»); cuando se
cumple, otro («se cumplió el plazo»). Cada uno sale **una sola vez** por
entrega. Los dispara el tablero al abrirse —no hay un reloj corriendo en el
servidor—, así que pueden llegar con horas de demora, nunca repetidos. El
cliente ve el mismo plazo en su portal: «vence en 3 días», «vence hoy».

### Quién aprueba

Al aprobar, el portal pregunta el nombre de quien aprueba. Es opcional: vacío
queda «Cliente», como siempre; con nombre queda «Cliente · Juana Pérez» en la
historia de la pieza y en la notificación. El navegador se acuerda del nombre
para la próxima.

### Conversaciones (`/gestion/chats`)

Una por cliente, no por carpeta: con el cliente se habla de todo en el mismo
hilo. Arriba las que tienen mensajes **sin leer**. El número baja a cero cuando
abrís.

### Admin (`/gestion/admin`)

Dos cosas que se configuran una vez: las claves con las que entra cada cliente
y el equipo. **El equipo es la lista de usuarios**: quien está con un correo y
un rol entra, quien no está no entra. A cada persona se le da de alta con su
correo y su rol, y la aplicación le asigna un **código de alta** que aparece en
su fila. Se lo pasás por donde le hablás siempre; con el correo y ese código
elige su contraseña la primera vez que entra, y desde ahí no la sabe nadie más.

Hace falta además para asignarle un trabajo a alguien y avisarle cuando el
cliente hace algo.

Todo lo que elegís queda guardado al lado de la aplicación, en la carpeta
`datos`:

| Archivo | Qué guarda |
|---|---|
| `clientes.json` | Quién tiene acceso, y el link de cada uno |
| `ajustes.json` | Qué carpeta se muestra, y si es lista o calendario |
| `publicaciones.json` | Qué día sale publicada cada pieza |
| `conversaciones.json` | Los chats |
| `piezas.json` | En qué anda cada pieza, y su historia |
| `plazos.json` | Los días de revisión puestos a mano |
| `leidos.json` | Hasta dónde leyó cada lado el chat |
| `equipo.json` | Quiénes son y sus correos |
| `avisos.json` | La bandeja de novedades |
| `secreto.json` | La llave con la que se firman las sesiones del portal |
| `claves.json` | Las huellas de las contraseñas del equipo (nunca el texto) |
| `olvidos.json` | Quién pidió que le reinicien la contraseña |
| `frenos.json` | Cuántas veces se erró cada clave, para frenar a quien prueba |

Y en `.env.local` está `CLAVE_DE_ADMIN`, la **llave maestra**: firma las
sesiones de gestión y abre la puerta solo mientras nadie del equipo tenga
contraseña. No es la contraseña de nadie y no hace falta que la sepa el equipo.

Si está configurado Supabase, todo esto vive en la base y no en `datos/`. Las
pantallas no cambian.

> Gestión **pide correo y contraseña**, y cada persona ve solo la parte que le
> toca según su rol. Está explicado en `DESPLIEGUE.md`, «La puerta de gestión».

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


---

## Cómo entra un cliente

Son **dos cosas**, y ninguna sirve sola:

1. **El link.** Se lo mandás vos. Hay uno por cliente —ve todas sus carpetas— y
   uno por carpeta, si querés mandarle una sola.
2. **La clave.** Una palabra que elegís vos en la pantalla de Clientes.

> **Mandalas por separado.** El link por un lado y la clave por otro. Mandar las
> dos en el mismo mensaje es mandar la llave pegada a la puerta.

Para **ver o cambiar** la clave de un cliente hay que volver a escribir **tu**
contraseña, ahí mismo. Evita que la clave de cada cliente esté escrita en
pantalla a la vista de cualquiera que pase por una máquina con la sesión
abierta.

Si el link se le va a quien no correspondía, **Cambiar link** lo mata en el
acto y le pasás uno nuevo.

Un cliente sin clave puesta no deja entrar a nadie, ni con el link bueno. La
pantalla te lo marca en amarillo.

---

## Prender los avisos por correo

Mientras no estén prendidos, todo queda igual en la bandeja del tablero: no se
pierde nada. Para que además salgan por mail hacen falta dos datos en
`.env.local`:

    RESEND_API_KEY=...
    CORREO_DESDE=Mesa de trabajo <avisos@tudominio.com>

La cuenta se hace en **resend.com** y tiene un plan gratis que alcanza de
sobra. Se configura una sola vez.

> No se usa el correo de Gmail directamente a propósito: mandar mails desde una
> casa suele estar bloqueado por el proveedor de internet, y lo que llega
> termina en spam.


---

## Lo que se hereda: el tiempo de revisión y quién lo lleva

Los dos funcionan igual.

El tiempo se cuenta en **días**, no en fechas: una fecha hay que volver a poner
en cada tanda, «tres días» se pone una vez. La fecha en que vence cada pieza
sale sola: el día que se subió el archivo, más los días.

Se heredan de arriba hacia abajo:

    Cliente ─────────► 3 días
      └ Carpeta ─────► hereda 3, salvo que le pongas otro
          └ Archivo ─► hereda el de su carpeta, salvo que le pongas otro

**Lo de arriba pisa lo de abajo.** Si cambiás el del cliente, todas sus
carpetas y archivos vuelven a esa cifra. Si cambiás el de una carpeta, alcanza
a sus archivos y no a las otras carpetas. Si cambiás el de un archivo, alcanza
solo a ese.

Es a propósito: si no, poner cinco días en el cliente dejaría carpetas con tres
y nadie sabría por qué. Donde dice **heredado**, el valor viene de arriba.

> **«Sin asignar» es una decisión, no la falta de una.** Una carpeta que ponés
> en «sin asignar» no vuelve sola al responsable del cliente: alguien decidió
> que esa carpeta no la lleva nadie.
