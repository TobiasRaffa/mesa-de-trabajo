# Subir la aplicación a internet

Esto es lo que hay que hacer, en orden, cuando decidamos que está lista.
Todavía no lo hicimos.

Está escrito para hacerse una vez y de corrido. Si algo no coincide con lo que
ves en pantalla, parás y preguntás: es preferible eso a seguir y descubrir a
mitad de camino que faltaba un paso.

---

## La puerta de gestión: ya está

**Hecho.** `/gestion` y el diagnóstico piden sesión, y cada persona entra con
su correo y su contraseña. Lo que hace queda firmado con su nombre en vez de
«El equipo».

Lo que hay que saber para arrancar:

1. **La primera vez no hay ninguna contraseña cargada**, así que la puerta
   acepta `CLAVE_DE_ADMIN` sola y lo dice: «Primera vez».
2. Adentro, en **Admin → El equipo**, cada persona tiene un botón «Poner
   contraseña». Quien todavía no tiene una aparece marcada: existe en la lista
   —se le asigna trabajo, le llegan los avisos— pero no puede entrar.
3. **En cuanto alguien tiene la suya, el arranque se cierra solo.** De ahí en
   más se entra con correo y contraseña, y nada más.

Cambiar `CLAVE_DE_ADMIN` echa a todo el mundo en el acto: la firma de las
sesiones sale de ahí. No hay lista de sesiones abiertas que mantener.

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
3. Abrir **SQL Editor** y pegar entero el archivo
   `supabase/migraciones/001_documentos.sql`. Ejecutarlo. Crea una sola tabla,
   `documentos`, que es todo lo que la aplicación necesita.
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

Son los archivos de la carpeta `datos/`, uno por colección. Cada archivo es
`{ "identificador": {...} }`, y cada par de esos es una fila:

| en el archivo         | en la tabla         |
| --------------------- | ------------------- |
| el nombre del archivo | `coleccion`         |
| la clave              | `id`                |
| el valor              | `datos`             |

`clientes.json` → filas con `coleccion = 'clientes'`. `secreto.json` y
`leidos.json` tienen una sola clave, `unico`, y son una fila cada uno.

Decime cuándo y lo hago; es un rato, pero conviene hacerlo con cuidado y una
sola vez, no a mano.

**Antes de tocar nada, copiá la carpeta `datos/` a otro lado.** Es el único
lugar donde está eso.

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

   Las dos opcionales de correo (`RESEND_API_KEY`, `CORREO_DESDE`): sin ellas
   la aplicación funciona igual, los avisos quedan anotados en la bandeja de
   adentro pero no sale ningún correo.

   `GOOGLE_SA_KEY` es la que más se rompe al copiar. Va completa, con el
   `-----BEGIN PRIVATE KEY-----`, y los saltos de línea escritos como `\n`,
   tal como vienen en el JSON de Google. Si Netlify la corta en varias líneas,
   está mal pegada.

4. Compilar.

---

## 4. Revisar que quedó bien

En este orden, que va de lo que falla feo a lo que falla fácil:

- [ ] Abrir `/diagnostico`. Tiene que decir **Supabase**, no «archivos». Si
      dice archivos, algo está mal y hay que parar acá.
- [ ] Abrir `/` a secas: no tiene que llevar a ningún lado. Es la dirección que
      queda cuando alguien borra el final del link.
- [ ] Abrir `/gestion`. **Tiene que pedir la contraseña del equipo.** Si abre
      derecho, la puerta no se volvió a poner: parar acá y leer lo primero de
      este documento. Probá también `/gestion/chats` y `/diagnostico` directo:
      las dos tienen que mandarte a la misma puerta.
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
- [ ] Borrar el cliente de prueba.

---

## Lo que todavía no está

- **El freno de intentos de la puerta vive en memoria**, igual que el del
  portal. Frena ocho intentos por minuto y por correo en una computadora; en
  Netlify, donde cada pedido puede caer en otra máquina, no frena nada. Los dos
  se arreglan igual: moviéndolo al almacén.
- **Dos personas escribiendo el mismo hilo de chat en el mismo instante.** Al
  mandar un mensaje se lee la conversación entera y se vuelve a guardar. Si el
  cliente y la agencia mandan uno en la misma fracción de segundo, uno de los
  dos se pierde. Las escrituras a archivos distintos ya no se pisan —hacen
  cola—, pero eso no alcanza para dos cambios al **mismo** documento.

  Se arregla con una operación de «leer y escribir en un solo paso» en el
  contrato del almacén. Conviene hacerlo junto con Supabase, que es donde hay
  transacciones de verdad.

- **Una conversación crece sin techo.** Los avisos tienen tope; los mensajes
  no. No es un problema con el uso normal, pero conviene decidir un límite
  antes de que un hilo de tres años haga lento cada guardado.

- **El freno de intentos vive en memoria.** Sirve en una computadora. En
  Netlify, donde cada pedido puede caer en una máquina distinta, no frena nada:
  hay que moverlo al almacén antes de mandarle el primer link a un cliente
  real.
- **Los archivos siguen en Drive.** La aplicación no guarda ninguno: muestra lo
  que hay en Drive y anota qué pasó con cada cosa. Perder la aplicación no
  pierde ningún archivo.
- **No se borra nada.** Ni piezas, ni mensajes, ni historial. Lo que se saca de
  la vista se marca, no se elimina.
