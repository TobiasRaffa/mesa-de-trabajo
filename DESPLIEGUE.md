# Subir la aplicación a internet

Esto es lo que hay que hacer, en orden, cuando decidamos que está lista.
Todavía no lo hicimos.

Está escrito para hacerse una vez y de corrido. Si algo no coincide con lo que
ves en pantalla, parás y preguntás: es preferible eso a seguir y descubrir a
mitad de camino que faltaba un paso.

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
- [ ] Abrir `/gestion`. Tiene que llevarte a `/gestion/entrar` y pedir la
      contraseña del equipo. Probá también `/gestion/chats` y `/diagnostico`
      directo: las dos tienen que mandarte a la misma puerta.
- [ ] Crear un cliente de prueba con una carpeta de Drive de prueba, ponerle un
      tag, abrir su link en una ventana de incógnito. Tiene que pedir el tag, y
      con el tag mal no tiene que dejar pasar.
- [ ] Desde ese portal de prueba, aprobar una pieza. Verificar en Drive que se
      mudó a «Entregas finales», y en gestión que figura aprobada.
- [ ] Escribir un mensaje de cada lado del chat y ver que llegan los dos.
- [ ] **Volver a desplegar sin cambiar nada** y comprobar que el cliente de
      prueba sigue ahí. Esto es lo que prueba que la base está de verdad en el
      medio; es el paso que más importa de todos.
- [ ] Borrar el cliente de prueba.

---

## Lo que todavía no está

- **Nadie entra con usuario y contraseña propios.** Gestión tiene una sola
  clave compartida para toda la agencia, y hay una puerta real que la pide
  antes de mostrar nada. Lo que no hay es un usuario por persona: no se sabe
  quién de las tres hizo cada cosa. Se decidió así por ahora.
- **El freno de intentos vive en memoria.** Sirve en una computadora. En
  Netlify, donde cada pedido puede caer en una máquina distinta, no frena nada:
  hay que moverlo al almacén antes de mandarle el primer link a un cliente
  real.
- **Los archivos siguen en Drive.** La aplicación no guarda ninguno: muestra lo
  que hay en Drive y anota qué pasó con cada cosa. Perder la aplicación no
  pierde ningún archivo.
- **No se borra nada.** Ni piezas, ni mensajes, ni historial. Lo que se saca de
  la vista se marca, no se elimina.
