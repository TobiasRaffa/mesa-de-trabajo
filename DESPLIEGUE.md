# Subir la aplicación a internet

Esto es lo que hay que hacer, en orden, cuando decidamos que está lista.
Todavía no lo hicimos.

Está escrito para hacerse una vez y de corrido. Si algo no coincide con lo que
ves en pantalla, parás y preguntás: es preferible eso a seguir y descubrir a
mitad de camino que faltaba un paso.

---

## La puerta de gestión: ya está

**Hecho.** `/gestion` y el diagnóstico piden sesión, cada persona entra con su
correo y su contraseña, y **cada una ve solo la parte que le toca**. Lo que hace
queda firmado con su nombre en vez de «El equipo».

Lo que hay que saber para arrancar:

1. **La primera vez no hay ninguna contraseña cargada**, así que la puerta
   acepta `CLAVE_DE_ADMIN` sola y lo dice: «Primera vez».
2. Adentro, en **Admin → El equipo**, se da de alta gente con **un correo y un
   rol, y nada más**. No se pone contraseña: la elige esa persona la primera
   vez que entra, y desde ahí no la sabe nadie más. Al darla de alta aparece
   en su fila un **código de alta** (ocho letras, como `P7D6-RT85`): se lo
   pasás por donde le hablás siempre, y nunca por el mismo canal que el link.
   Quien todavía no entró aparece marcada: existe en la lista —se le asigna
   trabajo, le llegan los avisos— pero nunca entró.
3. Esa persona toca «Ya me dieron de alta: entrar con mi correo», escribe su
   correo, **el código de alta** y la contraseña que elige. Sin el código no
   entra: saber el correo de alguien no alcanza para quedarse con su cuenta.
4. **En cuanto alguien tiene la suya, el arranque se cierra solo.** De ahí en
   más `CLAVE_DE_ADMIN` no abre nada y se entra con correo y contraseña.
   Quien se dio de alta antes de que existieran los códigos tiene en Admin el
   botón «Generar código».

### Los roles

Tres, y se cambian en **Admin → El equipo → Editar**:

| Rol             | Qué ve                                                     |
| --------------- | ---------------------------------------------------------- |
| Administración  | Todo, incluido Admin. Es la única que reparte accesos.      |
| Diseño          | Tablero, Clientes, Conversaciones, Notificaciones.          |
| Facturación     | Facturas.                                                  |

Además del rol, a una persona se le pueden dar **secciones sueltas** —«esta
diseñadora también mira las facturas»— sin inventarle un rol nuevo. Suman y
nunca restan: para quitarle algo a alguien se le cambia el rol.

### A qué clientes llega cada uno

El rol dice a qué **partes** entra; esto, a **cuáles clientes**. Se elige en la
misma pantalla: «Todos» o «Solo estos», con la lista al lado.

«Todos» quiere decir los que haya, **incluidos los que se den de alta más
adelante**. Una lista con todos los de hoy dejaría afuera a los nuevos sin que
nadie se entere de por qué.

Acotar a alguien le recorta todo a la vez: el árbol de clientes, el tablero,
las conversaciones, las notificaciones, las facturas, los archivos y las
miniaturas. Escribir a mano la dirección de un cliente que no lleva contesta
«no existe» —lo mismo que si de verdad no existiera: distinguirlos contaría
qué clientes tiene la agencia—, y los avisos de esos clientes no le llegan ni
le inflan el contador.

El rol es un molde vivo, no una copia: cambiar qué ve «Diseño» cambia lo que
ven todas las diseñadoras en el acto, sin repasarlas una por una. Y la
aplicación **no deja quedarse sin nadie en Administración**: si sos la única y
te lo sacás, avisa y no lo hace.

### «Olvidé mi contraseña»

No manda ningún correo, a propósito: un link que abre la aplicación sin
contraseña es una segunda puerta para cuidar. Quien no puede entrar toca
«Olvidé mi contraseña» y el pedido **aparece en Admin**. Ahí se le **reinicia**
—no se le pone una nueva; nadie elige la contraseña de otro— y esa persona
elige la suya la próxima vez que entre.

Al reiniciarle la contraseña a alguien se le genera un código de alta nuevo, y
**sus sesiones abiertas se cierran solas**: hasta que elija la contraseña
nueva, nadie entra con su nombre.

### Las sesiones

Duran **siete días** desde que se entra, y el vencimiento va firmado adentro
de la galleta: una galleta copiada de otra máquina no dura más que eso. Se
cierran antes si a la persona se le reinicia la contraseña, si se la saca del
equipo, o si cambia `CLAVE_DE_ADMIN`, que es la llave que firma todas las
sesiones. No hay lista de sesiones abiertas que mantener.

Para ver o cambiar la clave con la que entra un cliente, la aplicación vuelve a
pedir **tu** contraseña —no la llave del servidor—.

### Si nadie de Administración puede entrar

Puede pasar: la única administradora se olvidó la contraseña y no hay otra que
se la reinicie. La salida es **reabrir el arranque**: borrar las contraseñas
del equipo. En Supabase, en el SQL Editor:

```sql
delete from documentos where coleccion = 'claves';
```

(En una computadora, borrar `datos/claves.json`.) Con eso la puerta vuelve a
aceptar `CLAVE_DE_ADMIN`, y desde Admin se genera un código de alta para cada
persona. Nadie pierde nada más que su contraseña: todos eligen otra.

**Lo que esto cerró**, y era peor de lo que parecía: mientras la puerta estuvo
sacada, una sola visita a `/gestion` dejaba una galleta de treinta días que las
rutas de archivos aceptaban como «soy del equipo». Con eso se bajaba cualquier
archivo de cualquier cliente, incluidos los escondidos a propósito. No era «se
ven las pantallas»: era repartir una credencial.

---

## Lo primero, porque no es opcional

**En internet la aplicación no puede guardar en archivos.** Hoy, en esta
computadora, todo lo que la agencia carga —clientes, estados de cada pieza, el
calendario, los chats— vive en la carpeta `datos/`. En Netlify eso no
funciona: el disco es de solo lectura y se borra entero en cada despliegue.

No es un detalle a mejorar después. Sin base de datos, la aplicación abriría
igual, se vería bien, y **cada cosa que se cargara se perdería sin un solo
mensaje de error**. Por eso la aplicación se niega a compilar en Netlify si no
encuentra Supabase configurado: falla ahí, cuando todavía no hay nadie usándola.

Entonces: **Supabase primero, Netlify después.**

---

## 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com). Elegir la región
   más cercana —Brasil (São Paulo) para Buenos Aires—.
2. Guardar la contraseña de la base que pide al crearlo. No la vamos a usar
   acá, pero perderla es un lío.
3. Abrir **SQL Editor** y pegar, **en orden y de a uno**, los archivos de
   `supabase/migraciones/`. Hoy son tres:

   - `001_documentos.sql` — crea la única tabla, `documentos`.
   - `002_version.sql` — le agrega el número de versión de cada documento, que
     es lo que impide que dos personas escribiendo a la vez se pisen. Sin esto
     la aplicación arranca igual, y el día que el cliente y la agencia escriban
     en el mismo instante se pierde un mensaje. **Es también la que deja escrito
     el disparador**, así que no alcanza con la 001.
   - `003_guardar_varios.sql` — la función que guarda varios documentos en una
     sola transacción. Sin ella, guardar el calendario de doce piezas o cambiar
     un plazo con todo lo que hereda debajo **falla**: la aplicación la llama
     por su nombre.

   Las tres van **en orden**. Y si alguna vez hay que volver a pegar una vieja,
   pegá también las que vienen después: la 001 está escrita para poder
   repegarse, y hasta hace poco eso apagaba en silencio el cerrojo de la 002.
4. Ir a **Project Settings → API** y copiar dos cosas:
   - **Project URL** → va en `SUPABASE_URL`
   - **`service_role` key** → va en `SUPABASE_SERVICE_KEY`

Sobre esa segunda llave: es la que puede todo. Nunca sale del servidor —el
navegador del cliente jamás habla con la base—, y por eso la tabla tiene el
acceso cerrado para todo lo demás. Si la llave pública se filtrara, que para
eso está pensada, no alcanzaría para leer una sola fila. No la pegues en un
chat, ni en un correo, ni en el código.

---

## 2. Pasar lo que ya está cargado

Si para entonces hay datos cargados en esta computadora —clientes, tags,
calendarios, chats— hay que subirlos: la base arranca vacía.

Lo hace un script, `supabase/subir-datos.mjs`. **Antes de tocar nada, copiá la
carpeta `datos/` a otro lado**: es el único lugar donde está eso.

Primero mirar qué haría, sin escribir nada:

```bash
node supabase/subir-datos.mjs
```

Imprime cuántos documentos hay en cada colección. Si el número pinta bien:

```bash
node supabase/subir-datos.mjs --escribir
```

Necesita `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` cargadas, las mismas del paso
anterior. **No escribe si la base ya tiene algo**: si la migración ya se hizo,
avisa y no hace nada.

Cada archivo de `datos/` es una colección y cada clave adentro es un documento
—`clientes.json` → filas con `coleccion = 'clientes'`—, salvo `secreto.json` y
`leidos.json`, que son un documento solo y van como una fila `unico`. Eso lo
sabe el script, y hay una prueba que verifica que la lista siga siendo la que
el código usa.

Después de subir, abrí la aplicación con las variables puestas y mirá tres
cosas: que estén los clientes, que el tablero muestre lo que tiene que
mostrar, y que una conversación tenga sus mensajes.

---

## 3. Netlify

1. Subir el repositorio a GitHub, si todavía no está.
2. En Netlify: **Add new site → Import an existing project**, elegir el
   repositorio. El `netlify.toml` ya dice cómo compilar; no hay que tocar nada
   de eso.
3. **Antes de dejar que compile**, cargar las variables en
   **Site configuration → Environment variables**. La lista completa, con qué
   es cada una, está en `.env.example`. Las que no pueden faltar:

   | Variable               | Qué pasa si falta                                  |
   | ---------------------- | -------------------------------------------------- |
   | `SUPABASE_URL`         | no compila                                         |
   | `SUPABASE_SERVICE_KEY` | no compila                                         |
   | `GOOGLE_SA_EMAIL`      | compila, pero no se ve ninguna carpeta ni archivo   |
   | `GOOGLE_SA_KEY`        | igual                                              |
   | `CLAVE_DE_ADMIN`       | no compila                                         |
   | `SECRETO_DE_SESION`    | no compila                                         |

   Las dos opcionales de correo (`GMAIL_USUARIO`, `GMAIL_CLAVE_DE_APLICACION`): sin ellas
   la aplicación funciona igual, los avisos quedan anotados en la bandeja de
   adentro pero no sale ningún correo.

   La de errores (`NEXT_PUBLIC_SENTRY_DSN`) también es opcional: sin ella los
   errores quedan solo en el registro de Netlify. Cómo sacarla está más abajo,
   en «Enterarse de los errores».

   `GOOGLE_SA_KEY` es la que más se rompe al copiar. Va completa, con el
   `-----BEGIN PRIVATE KEY-----`, y los saltos de línea escritos como `\n`,
   tal como vienen en el JSON de Google. Si Netlify la corta en varias líneas,
   está mal pegada.

   `CLAVE_DE_ADMIN` y `SECRETO_DE_SESION` en internet **no pueden ser las de
   esta computadora**: son llaves, y una llave que anduvo por un `.env.local`
   de prueba no es una llave. Se generan así, una vez cada una:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Compilar. La aplicación usa **Next 16**, que Netlify compila con su runtime
   para Next. Si la compilación falla mencionando `proxy` o `middleware`, es
   que el runtime de Netlify todavía no entiende `src/proxy.ts` (el nombre nuevo
   de `middleware.ts`): parar ahí, no publicar, y mirar la versión de
   `@netlify/plugin-nextjs` en el registro de la compilación.

---

## 4. Revisar que quedó bien

En este orden, que va de lo que falla feo a lo que falla fácil:

- [ ] Abrir `/diagnostico`. Tiene que decir **Supabase**, no «archivos». Si
      dice archivos, algo está mal y hay que parar acá.
- [ ] Abrir `/` a secas: no tiene que llevar a ningún lado. Es la dirección que
      queda cuando alguien borra el final del link.
- [ ] Abrir `/gestion`. **Tiene que pedir entrar.** Si abre derecho, la puerta
      no se volvió a poner: parar acá y leer lo primero de este documento.
      Probá también `/gestion/chats` y `/diagnostico` directo: las dos tienen
      que mandarte a la misma puerta.
- [ ] Entrar con `CLAVE_DE_ADMIN` (arranque), dar de alta a la primera
      administradora, salir, y entrar con su correo, su código de alta y una
      contraseña nueva. Volver a probar `CLAVE_DE_ADMIN`: **ya no tiene que
      abrir**.
- [ ] Con una persona de rol Diseño, escribir a mano `/gestion/admin` y
      `/gestion/facturas`: tiene que rebotar a su pantalla.
- [ ] Crear un cliente de prueba con una carpeta de Drive de prueba, ponerle un
      tag, abrir su link en una ventana de incógnito. Tiene que pedir el tag, y
      con el tag mal no tiene que dejar pasar.
- [ ] Desde ese portal de prueba, aprobar una pieza. Verificar en gestión que
      figura aprobada y que **el archivo sigue en su carpeta de trabajo**: la
      aplicación no lo mueve. «Entregas finales» la llena el equipo a mano con
      el archivo terminado de verdad.
- [ ] Escribir un mensaje de cada lado del chat y ver que llegan los dos.
- [ ] **Volver a desplegar sin cambiar nada** y comprobar que el cliente de
      prueba sigue ahí. Esto es lo que prueba que la base está de verdad en el
      medio; es el paso que más importa de todos.
- [ ] En Netlify, **Logs → Functions → tarea-diaria → Run now**. El registro
      tiene que decir `Respaldo:` con un nombre de archivo y `Plazos revisados:
      1 de 1 clientes` (o los que haya). Después, en Supabase → **Storage**,
      tiene que aparecer el depósito `respaldos` con el archivo de hoy.
- [ ] Borrar el cliente de prueba.

---

## 5. Lo que corre solo todas las mañanas

En internet la aplicación no tiene un reloj propio: cada pedido arranca y
termina. Así que hay **una tarea programada** (`netlify/functions/tarea-diaria.mjs`)
que Netlify corre todos los días a las **8 de la mañana de Buenos Aires**. No
hay que configurar nada: Netlify la encuentra sola al desplegar, y usa las
mismas variables que la aplicación. Hace dos cosas:

- **Manda los recordatorios de plazo** —«va por la mitad del plazo», «se
  cumplió el plazo»— aunque nadie haya abierto el tablero. Antes salían solo
  al abrirlo: un fin de semana largo, el aviso llegaba el martes. Siguen
  saliendo una sola vez cada uno, abra quien abra el tablero.
- **Guarda un respaldo de toda la base** en Supabase → Storage → `respaldos`,
  un archivo por día, y borra solo los de hace más de treinta días. El depósito
  es privado: no tiene link, y la aplicación lo crea sola la primera vez.

Si algo falla, queda en **Logs → Functions → tarea-diaria**, y ahí mismo está
«Run now» para correrla sin esperar a mañana.

### Los respaldos

El plan gratis de Supabase no guarda copias propias: por eso existe esto. Cubre
los errores —una fila borrada a mano, algo que la aplicación guardó mal—, pero
vive en el mismo proyecto que la base, así que **no cubre perder el proyecto
entero**. Para eso, de vez en cuando, bajar una copia a esta computadora:

```bash
node --env-file=.env.local supabase/restaurar-respaldo.mjs --bajar
```

Queda en `respaldos/`, que no se sube al repositorio (es la base entera, con
las claves y los chats). Con una fecha, baja la de ese día:
`--bajar 2026-09-23`.

**Para volver atrás** después de un error, primero mirar qué cambiaría:

```bash
node --env-file=.env.local supabase/restaurar-respaldo.mjs respaldos/respaldo-2026-09-23.json.gz
```

Muestra, colección por colección, cuántos documentos volverían a como estaban
y cuáles habían desaparecido. Si es lo que se esperaba, se repite con
`--escribir`. Con `--coleccion piezas` se vuelve atrás una sola colección, que
suele ser lo que hace falta. **No borra** lo creado después del respaldo, y
conviene hacerlo con la aplicación sin usar.

### Enterarse de los errores

Sin esto, un error en internet queda en un registro que nadie abre: una
pantalla que se cae para un cliente pasa sin que nadie se entere hasta que se
queja. Con Sentry cada error llega a un panel, y la primera vez que aparece
manda un correo.

1. Crear una cuenta en [sentry.io](https://sentry.io) (el plan gratis alcanza)
   y un proyecto de tipo **Next.js**.
2. En el proyecto: **Settings → Client Keys (DSN)**, copiar el DSN.
3. Cargarlo en Netlify como `NEXT_PUBLIC_SENTRY_DSN` y volver a desplegar.

No hace falta correr el asistente de Sentry ni tocar código: ya está conectado,
y sin el DSN no manda nada. **Lo que se manda está limpio a propósito**: el
token del link del cliente se tacha, y no viajan ni lo que se escribió en un
formulario —puede ser una contraseña—, ni galletas, ni cabeceras, ni quién
estaba mirando. Está en `src/lib/errores.ts`.

## Lo que se arregló para poder subirla

Cuatro cosas que andaban bien en esta computadora y **no hubieran andado en
internet**, o que iban a molestar con el uso:

- **Los frenos de intentos.** Los dos —la puerta de la agencia y la clave del
  cliente— contaban en memoria. En Netlify cada pedido puede caer en otra
  máquina, cada una con su cuenta en cero: el que prueba mil contraseñas no
  toca ocho veces la misma cuenta, toca una vez mil cuentas distintas. El freno
  estaba puesto y no frenaba, que es peor que no tenerlo. Ahora la cuenta vive
  en la base, que es la misma para todas las máquinas.
- **Dos personas escribiendo el mismo chat en el mismo instante.** Mandar un
  mensaje era leer el hilo, sumarle el mensaje y guardarlo: el segundo en
  guardar se llevaba puesto el del primero, sin error y sin aviso. Ahora se
  escribe en un solo paso, y en la base eso lo garantiza el número de versión
  de cada documento.
- **El techo de una conversación.** Cada mensaje reescribía el hilo entero, así
  que un hilo de tres años hacía lento cada guardado. Ahora lo viejo se muda a
  un tramo aparte —**no se borra nada**— y se lee con «Ver lo anterior».
- **Los comentarios de las versiones de antes.** Se leían solo del último
  archivo de cada pieza: lo que el cliente escribía encima de la V1
  desaparecía de la aplicación al subir la V2, y seguía en Drive esperando una
  respuesta que nadie iba a dar. Ahora se leen todas las vueltas, y el pedido
  dice de cuál salió cuando no es la última.

Y una que no era del despliegue pero molestaba: **un renombre que parte un
trabajo en dos** ahora tiene botón. Cuando dos trabajos de una carpeta se
llaman igual en distinto formato, el aviso trae «Es el mismo trabajo:
unirlos», que le devuelve la marca de versión al archivo en Drive —que es de
donde salió el problema— y el grupo se rehace solo. Lo anotado no se muda de un
lado a otro: eso sigue sin hacerse solo, a propósito.

---

## Lo que todavía no está

- **Nadie mira los avisos por correo todavía.** Sin `GMAIL_CLAVE_DE_APLICACION` la
  aplicación funciona igual y los avisos quedan en la bandeja de adentro, pero
  nadie se entera sin abrirla.
- **Los archivos siguen en Drive.** La aplicación no guarda ninguno: muestra lo
  que hay en Drive y anota qué pasó con cada cosa. Perder la aplicación no
  pierde ningún archivo.
- **No se borra nada.** Ni piezas, ni mensajes, ni historial. Lo que se saca de
  la vista se marca, no se elimina.
