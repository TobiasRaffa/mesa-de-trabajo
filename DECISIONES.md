# Decisiones de arquitectura

Por qué las cosas son como son. Si algo de acá se cambia, conviene actualizar
la explicación en vez de borrarla: el motivo suele importar más que la regla.

---

## 1. Los archivos viven en Drive. El portal no guarda ninguno.

El estudio ya paga el almacenamiento de Drive y ya tiene las carpetas
organizadas por cliente. Copiar los archivos a otro lado sería pagar dos veces,
mantener dos versiones de la verdad, y ver crecer una factura todos los meses.

El portal guarda **decisiones** —estados, plazos, aprobaciones, comentarios—,
que pesan bytes. Los archivos, que pesan de verdad, se quedan donde están.

**Consecuencia:** no existe ni va a existir un botón de "subir archivo". El día
que exista, alguien lo va a usar y se acabó la regla.

## 2. Las miniaturas pasan por nuestro servidor. No van directo a Google.

Google entrega la miniatura de un archivo de Drive en una URL de
`lh3.googleusercontent.com`. Es tentador ponerla directo en el `src` de la
imagen. **No funciona.**

Comprobado el 8/9/2026 contra las carpetas reales:

| Pedido | Respuesta |
|---|---|
| Sin cabecera `Referer` (desde un servidor) | `200 image/jpeg` |
| Con cabecera `Referer` (desde una página) | `429 Too Many Requests` |

Es protección anti-hotlinking de Google. Por eso existe
`/api/miniatura/[fileId]`: el servidor pide la imagen sin `Referer` y le pasa
los bytes al navegador.

Dos beneficios que no buscábamos y conviene conservar:

- El navegador nunca recibe una URL de Google, así que no se filtra nada de la
  estructura de Drive en el HTML de la página.
- Todo el acceso a imágenes pasa por una sola puerta, que se puede controlar.

## 3. Los permisos se deciden en un solo lugar.

`src/lib/permisos.ts` es el único módulo que responde "¿esta persona puede ver
esto?". Las pantallas y las rutas preguntan, no deciden.

La razón es simple: si la regla está repetida en cada pantalla, alcanza con
olvidarse en una para filtrar datos de otro cliente. Y ese es exactamente el
error que arruinaría la confianza que el portal viene a construir.

Hoy la regla es "el archivo tiene que estar dentro de una carpeta que la
aplicación administra". Cuando existan los usuarios pasa a ser "...y esta
persona tiene que poder ver ese proyecto", en la misma función.

**Regla de oro:** ante la duda, no se sirve. Si no se puede verificar, es `null`.

## 4. Un archivo que no está autorizado responde 404, no 403.

Un `403` confirma que el archivo existe pero no te lo damos. Un `404` no dice
nada. Como no hay ninguna razón legítima para que alguien pida un archivo fuera
de su alcance, no le debemos una explicación.

## 5. Cuenta de servicio de Google, no "iniciar sesión con Google".

Con OAuth de usuario, las credenciales se vencen cada 7 días mientras la
aplicación no esté verificada por Google. Eso significa reconectar la cuenta
todas las semanas.

La cuenta de servicio es un usuario robot con su propia llave: no caduca, no
necesita verificación, y solo ve las carpetas que alguien le compartió
explícitamente. Para una herramienta interna es la respuesta correcta.

**Su acceso se controla desde Drive**, compartiendo o dejando de compartir
carpetas con su dirección. No hay nada que programar para quitarle permisos.

## 6. La llave nunca toca el repositorio.

Viaja como variables de entorno (`GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`), en
`.env.local` para trabajar en la máquina y en el panel de Netlify para
producción. `.gitignore` cubre `.env*`.

Todo el código que la usa vive en el servidor. Si algún día una función que
toca la llave termina corriendo en el navegador, la llave queda expuesta a
cualquiera que abra las herramientas de desarrollo.

## 7. Netlify, no Vercel.

Vercel hace Next.js y la integración es algo más fina. Pero su plan gratuito es
para proyectos personales, y esto es una herramienta de una empresa. El plan
gratuito de Netlify permite uso comercial, y además es la plataforma que el
estudio ya usa.

---

## Pendientes conocidos

- **Caché de miniaturas.** Hoy cada pedido va a Google (dos viajes: metadatos y
  bytes). Con `Cache-Control: private, max-age=3600` el navegador no repite,
  pero un visitante nuevo paga el costo. Si molesta, se guardan en el
  almacenamiento de Supabase; son unos 24 MB al mes y son descartables.
- **Autorización por persona.** `permisos.ts` todavía no sabe quién está
  mirando, porque no hay usuarios. Es lo primero que se suma cuando existan.

---

## 8. La llave se normaliza siempre, venga como venga.

La misma llave privada llega de dos formas distintas según dónde corra la
aplicación:

- **En la máquina**, desde `.env.local` entre comillas, con saltos de línea de
  verdad. Next los interpreta al leer el archivo.
- **En Netlify**, pegada en un panel web, donde lo normal es escribirla en una
  sola línea con la secuencia `\n` escrita literalmente.

`normalizarLlave()` contempla las dos. Convertir es inofensivo cuando no hay
nada que convertir, así que se hace siempre y no según el entorno.

**Por qué está anotado:** este bug estuvo en el código y no se notaba, porque en
la máquina funcionaba igual. Hubiera aparecido recién en el primer despliegue,
con un error de Google que no explica nada. Lo delató un aviso del linter sobre
un import sin usar.

## 9. Las pruebas verifican el caso que rompe, no el que anda.

La primera versión de la prueba de la llave pasaba sin probar nada: ponía
saltos de línea reales y esperaba saltos de línea reales. Confirmaba que la
función no hacía daño, no que hiciera su trabajo.

Ahora usa `String.raw` para construir una llave con la secuencia `\n` literal
—la forma que llega desde Netlify— y verifica que las dos formas terminen
idénticas. Una prueba que solo confirma el camino feliz da confianza falsa, que
es peor que no tener prueba.

## 10. La máquina de estados vive aparte de todo lo demás.

`src/dominio/pieza.ts` no sabe nada de Drive, ni de la base de datos, ni de
React. Recibe una pieza y un evento, y devuelve la pieza nueva o el motivo por
el que no se puede.

Está separada porque es la única parte que no puede estar mal. Las pantallas se
rediseñan y la base de datos se cambia, pero si estas reglas fallan el portal
miente sobre en qué estado está un trabajo — que es justo lo que vino a
arreglar.

Devuelve un motivo en vez de fallar en silencio, así una pantalla puede
explicar por qué un botón no está disponible en lugar de esconderlo.

### Las cuatro reglas que no se pueden romper

1. **Aprobar es inmediato y por pieza.** No espera al cierre de la ronda ni a
   las demás piezas de la entrega. Es lo que permite publicar un posteo el
   jueves con el resto del mes todavía en revisión.
2. **Los pedidos de cambio esperan al cierre.** La agencia recibe la devolución
   completa de una vez, no de a goteo.
3. **El plazo avisa, no decide.** No existe un evento de vencimiento: que se
   cumpla el plazo dispara un aviso, nunca un cambio de estado.
4. **Nada se aprueba solo.** La única forma de llegar a «final» es que una
   persona apruebe.

## 11. Las pruebas se prueban rompiendo el código a propósito.

Escritas las pruebas de la máquina de estados, se rompieron tres reglas a mano
para ver si alguna prueba fallaba. Dos las detectaron. **La tercera no.**

Se podía hacer que cerrar la ronda aprobara todo lo que el cliente no había
decidido —o sea, romper la regla más importante— y las 61 pruebas seguían en
verde. El agujero era justamente donde más dolía.

Ahora hay un grupo entero de pruebas dedicado a eso, incluida una que recorre
todos los estados con todos los eventos que no son «aprobar» y verifica que
ninguno pueda terminar en «final».

**La costumbre que queda:** después de escribir pruebas de algo importante,
romper el código a propósito y confirmar que fallan. Un conjunto de pruebas en
verde no significa nada hasta que se comprueba que sabe ponerse en rojo.

## 12. El portal y la administración no se tocan, y lo verifica una herramienta.

```
src/
  dominio/   las reglas del negocio, sin lados
  lib/       plomería (Drive, entorno), sin lados
  portal/    lo que ve el cliente
  admin/     lo que ve la agencia
```

Los dos mundos pueden usar `dominio` y `lib`. Lo que no pueden es tocarse entre
ellos: **comparten información a través de la base de datos, no llamándose
funciones**.

Y no es una convención que haya que recordar. Está escrito como regla en
`eslint.config.mjs`, así que si alguien la cruza no compila:

| Quién intenta qué | Resultado |
|---|---|
| `portal/` importa de `admin/` | error |
| `admin/` importa de `portal/` | error |
| `dominio/` importa de `lib/` o de cualquier mundo | error |

Las tres se probaron escribiendo el archivo que las viola y confirmando que el
linter las rechaza.

**Por qué el dominio tampoco puede importar nada:** si dependiera de Drive o de
la base de datos, dejaría de poder probarse sin infraestructura — y eso es todo
su valor. Lo que necesite de afuera se le pasa como parámetro.

**Una sola aplicación y no dos.** Dos despliegues separados darían un poco más
de aislamiento, a cambio de duplicar configuración, mantenimiento y costos. Con
la frontera vigilada por herramientas y las reglas de acceso en la base de
datos, el aislamiento que importa ya está. Y si alguna vez hiciera falta
separarlas de verdad, mover `portal/` a su propio proyecto es mecánico, porque
ya no depende de nada del otro lado.

## 13. La dirección del cliente no dice de quién es.

El link es `/t/<token al azar>` y nada más. Sin nombre de cliente ni de
proyecto adentro.

La tentación es hacerlo legible —`/cafeotono/K7fP2…`— para que se reconozca en
WhatsApp. Pero como el segundo factor es el tag del cliente, **poner su nombre
en la dirección es escribir la clave al lado de la cerradura**: quien reciba el
link reenviado lee el nombre y prueba lo obvio.

El mensaje de WhatsApp igual va a decir de qué se trata, porque lo escribe una
persona. El link no necesita repetirlo.

Además, las páginas del portal van con `referrer: no-referrer`, así la
dirección no viaja a ningún sitio que se abra desde adentro.

## 14. El filtro por cliente se aplica por construcción, no por memoria.

El link apunta a un proyecto, el proyecto pertenece a un cliente, y ese cliente
tiene su tag. Comprobar el tag contra *ese* cliente y servir *ese* proyecto es
toda la regla. No hace falta nada más.

Lo que sí hace falta es que la regla no se pueda olvidar. En vez de acordarse
de escribir «y que sea de este cliente» en cada consulta del portal, las
consultas salen de una función que ya lo trae puesto: **no se puede omitir el
filtro porque no se escribe**.

Se descartó una alternativa más elaborada —darle al cliente un permiso firmado
y que la base de datos rechazara todo lo demás— porque para un portal que hace
un puñado de consultas era más maquinaria de la que compraba. Si el portal
crece mucho, se puede agregar después sin cambiar nada de lo anterior.

La base igual hace su parte donde sale gratis: un link con proyecto lleva una
restricción compuesta que **impide guardar la fila** si ese proyecto no es de
ese cliente. No es un comentario pidiendo cuidado: es una fila rechazada.

## 15. Las migraciones se verifican sin base de datos.

Sin Docker no se puede levantar Postgres localmente, así que el esquema se
escribiría a ciegas y el primer error aparecería a mitad de una migración, con
la base ya medio construida.

`supabase/migraciones.test.ts` se lo pasa al **analizador de verdad de
Postgres**, compilado a WebAssembly. Corre con `npm test`, tarda medio segundo
y no necesita nada instalado.

No verifica que las tablas tengan sentido — eso es trabajo nuestro. Verifica
que ninguna migración tenga un error de escritura, y cuando lo tiene dice la
línea. También comprueba que estén numeradas en orden y sin repetir, porque se
aplican por nombre.

## 16. «Nada se borra» dejó de ser una promesa.

En `002_accesos.sql` no hay una sola política de borrado. No es un olvido: con
las reglas de acceso activas, lo que no se abre queda cerrado, así que **la
base de datos rechaza cualquier borrado, de cualquier tabla, para cualquiera**
— incluida una administradora.

Un proyecto que se cae pasa a «cancelado». Un link que ya no sirve se
desactiva. Una aprobación no se toca nunca.

Lo mismo con el registro de eventos y con las decisiones: se leen y se agregan,
pero no hay política de actualización. Nadie puede reescribir la historia, que
es lo único que hace que un registro sirva para algo.

## 17. El alcance de una persona se decide en una sola función.

`ve_proyecto(id)` contesta si alguien puede ver un proyecto, y casi todas las
reglas de acceso la usan. Hoy dice: el equipo ve todo, un colaborador externo
solo lo que se le asignó.

Cambiarla ahí cambia el alcance en todo el sistema a la vez. Es el equivalente
en la base de datos de tener los permisos en un solo módulo del código: si la
regla estuviera copiada en cada tabla, alcanzaría con olvidarse en una.

## 18. Teléfono primero, y no como un ajuste posterior.

El cliente abre el portal desde un link de WhatsApp: casi siempre va a estar en
el teléfono. Así que las pantallas se diseñan para el teléfono y lo de la
computadora se agrega después, no al revés.

En la práctica:

- Los botones miden al menos `--spacing-toque` (2,75rem), que es lo que mide un
  dedo. Un botón más chico se falla, y en una pantalla donde se aprueba trabajo
  fallar es caro.
- Los botones de decisión van en una barra fija abajo: el pulgar llega sin
  estirarse.
- Esa barra respeta `env(safe-area-inset-bottom)`, así no queda debajo de la
  barra de gestos del iPhone.
- Nada depende de pasar el mouse por encima: en un teléfono no existe.

## 19. Lo más fuerte de la pantalla es el trabajo, no la aplicación.

Los bocetos son piezas de diseño con sus propios colores. Si la interfaz
compite, la pieza pierde — y la pieza es lo que el cliente vino a mirar.

De ahí sale todo el sistema visual: neutros apenas girados al azul (un gris
puro al lado de una pieza cálida se ve sucio), un solo acento para lo que se
puede tocar, y los colores de estado usados **solo** como señal. Si el verde de
«aprobada» aparece también en un botón cualquiera, deja de significar algo.

Tipografía del sistema, sin fuentes que descargar. En un teléfono con datos
móviles, una fuente que hay que bajar es texto que tarda en aparecer. Esto es
una herramienta, no un folleto.

## 20. Hay que decirle a Tailwind dónde mirar.

Tailwind descubre solo qué archivos escanear, pero **se saltea las carpetas con
paréntesis o corchetes** — que en Next son justamente los grupos de rutas,
`(portal)`, y las rutas dinámicas, `[token]`.

O sea: exactamente donde vive el portal del cliente. Sin `@source "../"` en
`globals.css`, las clases que solo se usan ahí no se generan, la pantalla se ve
a medio armar y **nada avisa**: compila, no hay error, y el problema parece de
diseño.

Se descubrió porque una imagen que debía ser vertical salía como una tira de
diecisiete píxeles de alto.

## 21. Las fechas se guardan en universal y se muestran en Buenos Aires.

Guardar en hora local sería cómodo hoy y un problema el día que alguien trabaje
desde otro país, o que Argentina vuelva a mover los relojes.

Y los días se cuentan **de calendario, no de veinticuatro horas**: si algo vence
mañana a las nueve y son las once de la noche, para una persona eso es «un
día», no «diez horas». Contar en horas diría «vence hoy», que es engañoso.
