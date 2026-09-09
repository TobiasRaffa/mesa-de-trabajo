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

## 18. La computadora manda; el teléfono es una versión, no un recorte.

Los dos mundos no se usan igual, y conviene no fingir que sí.

**La administración se usa en la computadora.** El tablero, armar entregas,
configurar clientes, la cobranza: todo eso se hace sentado. Es la pantalla
principal y se diseña para pantalla grande.

**El portal del cliente se abre donde caiga.** Llega por WhatsApp, así que
muchas veces va a ser un teléfono — pero también una computadora, y una no vale
menos que la otra. Es un solo diseño que se reacomoda, no dos.

En la práctica, la pantalla de una entrega va en tres columnas en la
computadora y en una en el teléfono; las acciones quedan dentro de cada pieza
en pantalla grande y en una barra fija abajo en el teléfono, donde llega el
pulgar.

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

## 22. La pantalla usa la máquina de estados, no una copia de sus reglas.

Cuando el cliente aprueba una pieza, la pantalla llama a la misma función
`aplicar()` que va a correr en el servidor. No hay una versión de las reglas
para el navegador y otra para el servidor: hay una sola.

Eso significa que un botón se deshabilita porque el dominio dice que ese evento
no se puede, y no porque alguien se acordó de deshabilitarlo. Y cuando el
dominio rechaza algo, la pantalla muestra el motivo que devuelve, en vez de no
hacer nada y dejar al cliente adivinando.

Hoy los cambios viven solo en el navegador y al recargar se pierden. Cuando
exista la base, lo único que cambia es dónde se guarda el resultado — las
reglas ya están donde tienen que estar.

## 23. Guardar no es enviar, y la pantalla lo dice con todas las letras.

Un cliente puede revisar tres piezas hoy, cerrar el navegador y seguir mañana.
Son dos actos distintos y merecen dos botones distintos, en dos lugares
distintos:

| | Dónde | Qué hace |
|---|---|---|
| **Guardar y seguir después** | dentro de la pieza | Deja el trabajo esperando. La agencia no se entera. |
| **Enviar revisión a la agencia** | en la barra de abajo | El único momento en que la agencia recibe algo. |

Debajo de la caja de texto dice, literalmente, «esto todavía no llegó a la
agencia». No alcanza con que el sistema esté bien: el cliente tiene que
entender qué pasó cuando apretó.

## 24. Las piezas empiezan cerradas.

Doce posteos abiertos a la vez son un muro, sobre todo en un teléfono. Se abre
una, se resuelve, se cierra sola y sigue la que viene. La lista siempre deja
ver cuánto falta, y en la fila cerrada se lee el pedido que quedó escrito.

## 25. Enviar pide confirmación, con el resumen a la vista.

Enviar es lo único que la agencia ve y no se deshace. Antes de que ocurra
aparece un resumen: qué aprobó, qué mandó a cambiar con el texto de cada
pedido, y —en rojo— qué quedó sin revisar.

Si alguna pieza tiene cambios pedidos pero sin explicar, el resumen lo marca.
Un pedido de cambios en blanco es una vuelta perdida para los dos lados.

## 26. Aprobar es definitivo; pedir cambios es un borrador.

No son simétricos, y la asimetría es a propósito.

Aprobar libera la pieza en el momento: el equipo puede publicarla el jueves
aunque el resto siga en revisión. Como tiene consecuencia inmediata, no se
deshace — para eso está el permiso de reabrir, que es de una administradora y
queda registrado.

Pedir cambios, en cambio, no salió a ningún lado hasta que se envía la
revisión. Así que mientras tanto se puede editar el texto, o cambiar de opinión
y aprobar. Si no se pudiera, un clic dejaría al cliente atrapado.

## 27. La pieza se muestra entera, y se puede agrandar.

`object-contain` y no `object-cover`. Recortar una pieza de diseño para que
entre prolija en un recuadro puede cambiar lo que se está juzgando: un margen,
un borde, dónde termina el texto. Si sobra espacio, sobra espacio.

Y se abre a pantalla completa. Una miniatura no alcanza para decidir, y en el
teléfono la diferencia entre revisar y adivinar es poder acercarse.

## 28. Se puede enviar una pieza sola, pero no es lo que se propone.

El botón grande de abajo manda la revisión completa. Dentro de cada pieza hay
uno más chico que manda solo esa.

La excepción existe porque a veces una pieza urge y el resto puede esperar. Pero
sigue siendo la excepción: mandar de a una devuelve a la agencia el goteo de
pedidos que este sistema vino a evitar. Por eso el de arriba es principal y el
de adentro es secundario — la jerarquía visual dice cuál es el camino normal.

## 29. «Descartar» descarta; no aprueba.

El botón decía «Mejor está bien así» y aprobaba la pieza. Ahora dice
«Descartar» y hace lo que dice: borra el pedido de cambios y deja la pieza sin
decidir, para volver a elegir con calma.

No es un detalle de redacción. Un botón que hace algo distinto de lo que dice
es la forma más barata de perder la confianza de quien lo aprieta — sobre todo
si lo que hace de más es aprobar un trabajo.

## 30. Guardado y editable son dos cosas distintas.

Al guardar, el texto deja de ser un campo y pasa a ser texto: se lee, no se
toca. Para volver a cambiarlo hay que apretar **Editar cambios**.

La razón es que un campo abierto invita a escribir, y en un teléfono invita
también a borrar sin querer. Si el cliente ya decidió qué pedir, lo que
corresponde es mostrárselo, no dejarle el lápiz en la mano.

La disposición de los botones dice lo mismo sin palabras:

```
[ Editar cambios ] [ Descartar cambios ]  ················  [ Enviar revisión ]
   lo que se puede hacer con el texto                        lo que no se deshace
```

Juntos a la izquierda lo que se puede rehacer; solo a la derecha, lejos, lo
único que sale hacia la agencia.

## 31. Los botones dicen lo que hacen, en el idioma del cliente.

«Está bien así» pasó a **Aprobar**. La frase amable describía un sentimiento;
el botón ejecuta un acto con consecuencias —la pieza queda cerrada y el equipo
puede publicarla— y merece el verbo que le corresponde.

«Descartar» pasó a **Descartar cambios**, que dice qué se descarta. Solo, podía
leerse como descartar la pieza.

## 32. El seguimiento tenía que verse.

Era una fila de palabras grises de once píxeles y se perdía en la pantalla.
Ahora tiene marcas, línea y tamaño de lectura: el punto donde está la pieza va
en color y en negrita, lo recorrido en gris, y lo que falta apenas dibujado.

Sigue siendo información y no reproche. Pero información que nadie ve no es
información.

## 33. Cabeceras de seguridad, que no cuestan nada.

Next no pone ninguna por su cuenta. Sin esto, la aplicación sale a internet sin
defensas gratuitas.

| Cabecera | Por qué |
|---|---|
| `frame-ancestors 'none'` | La más importante acá. Sin ella, cualquiera puede meter el portal en un marco invisible y hacer que un cliente **apruebe un trabajo creyendo que hace otra cosa**. Es el ataque más plausible contra una pantalla cuyo botón principal aprueba trabajo. |
| `Referrer-Policy: no-referrer` | El link del cliente lleva su token. Sin esto viaja a cualquier sitio que se abra desde adentro. |
| `X-Content-Type-Options: nosniff` | Si decimos que algo es una imagen, el navegador nunca lo trata como código. |
| `base-uri` y `form-action` | Que nadie reescriba a dónde apuntan las direcciones ni a dónde se manda un formulario. |
| `Permissions-Policy` | Cámara, micrófono y ubicación apagados: nada de eso hace falta para revisar bocetos. |
| `Strict-Transport-Security` | Solo en producción. En la máquina de desarrollo haría que localhost dejara de abrir. |

La política de contenido es **parcial a propósito**: falta `script-src`, que es
la parte más valiosa, pero exige firmar cada script que Next genera y romperlo
es fácil. Lo que está puesto no puede romper nada y ya cierra las puertas más
grandes. Endurecerlo es una tarea aparte, para cuando la aplicación esté quieta.

## 34. Se probó rompiéndola, no leyéndola.

`scratchpad/sondear.mjs` golpea la ruta de miniaturas con saltos de directorio,
identificadores de cinco mil caracteres, comillas, etiquetas de script, tamaños
absurdos, parámetros repetidos y métodos no permitidos. Y revisa que el HTML no
filtre la dirección de Google, el correo de la cuenta de servicio, la llave
privada, el identificador de la carpeta ni rutas del disco.

Todo dio bien. Pero el valor no está en el resultado sino en tener el sondeo:
la próxima vez que se toque esa ruta, se vuelve a correr.

## 35. El archivo original se reenvía, no se junta.

`/api/archivo/[fileId]` conecta el caño de Drive con la respuesta al cliente y
deja pasar los bytes. No los carga en memoria primero.

Con una miniatura de veinte kilos daría igual. Con un archivo de diseño de
trescientos megas, juntarlo antes de reenviarlo es la forma más rápida de
tumbar el servidor — y en un servicio que cobra por memoria, de gastar plata
sin motivo.

Pasa por el servidor y no por un enlace directo a Drive por tres razones: la
estructura de Drive no llega al navegador, todo el acceso queda detrás de una
sola puerta, y **el cliente no necesita tener permiso sobre la carpeta**. Se
lleva su archivo sin que nadie le comparta nada.

## 36. El nombre de un archivo puede ser un ataque.

Un nombre con un salto de línea, metido tal cual en la cabecera que dice cómo
se llama la descarga, **permite inyectar otras cabeceras**. Por eso
`cabeceraDeDescarga()` limpia siempre: saltos de línea, comillas y separadores
de ruta.

Y manda el nombre en dos formas: una simple para navegadores viejos y otra
codificada que respeta acentos. Sin la segunda, «Diseño otoño.jpg» baja como
«Dise_o oto_o.jpg».

Nueve pruebas cubren la función, incluidas las de inyección. Es una función de
diez líneas que toca datos que vienen de afuera: exactamente donde conviene
gastar pruebas.

## 37. Cinco errores que encontró una lectura del código.

Ninguno rompía la pantalla, y por eso ninguno se había notado.

**Efectos secundarios adentro del actualizador de estado.** Guardar en el
navegador y avisar de un rechazo se hacían dentro de la función que React usa
para calcular el estado siguiente. React puede ejecutar esa función **más de
una vez** —lo hace a propósito en desarrollo, justamente para encontrar este
error—, así que se guardaba dos veces. Ahora todo se calcula antes y el
actualizador solo devuelve el resultado.

**El borrador se guardaba con una sola clave para todo.** Dos entregas del
mismo cliente se hubieran pisado el borrador entre ellas: escribir un pedido en
una y encontrarlo en la otra. Ahora la clave lleva el identificador de la
entrega.

**La dirección de la miniatura mandaba `v=` vacío** cuando el archivo no traía
fecha de modificación. La ruta pregunta si el parámetro está, no si vale algo,
así que le ponía caché de un día a algo que no se puede invalidar: si el
archivo cambiaba, el cliente seguía viendo el viejo durante 24 horas. Ahora es
una función probada que no pone el parámetro si no hay fecha.

**Las listas se identificaban por nombre.** Dos piezas llamadas igual daban
claves repetidas, y React puede confundirlas al reordenar. Ahora van por
identificador.

**El foco se escapaba de las ventanas emergentes.** Apretar Tab dentro de un
diálogo llevaba el foco a los botones de atrás: quien navega con teclado se
encontraba apretando cosas que no ve, con el diálogo abierto tapándolo todo.

## 38. Y lo que encontró usar la aplicación.

Después de leer, probar. Doble clic rápido en Aprobar, texto de once mil
caracteres sin espacios en el pedido, diálogos abiertos con teclado, la barra
de avance contra el texto que dice lo mismo.

Todo aguantó. Pero el valor no está en el resultado: está en que las dos
revisiones buscan cosas distintas. Leer encuentra lo que está mal escrito;
usar encuentra lo que está mal pensado. Ninguna de las dos ve lo de la otra.

## 39. Comparar versiones: dos juntas en la computadora, alternadas en el teléfono.

Contesta la pregunta que hace todo cliente que pidió un cambio: «¿qué cambió?».
Contestarla de memoria es incómodo para los dos lados; contestarla mal es una
vuelta perdida.

En pantalla grande van una al lado de la otra, que es como se compara de
verdad. En un teléfono no entran dos imágenes útiles al mismo tiempo —quedarían
dos estampillas—, así que se alternan con dos pestañas. El ojo compara igual,
recordando, y cada imagen se ve al tamaño que sirve.

**No son dos diseños.** Es el mismo componente: lo que cambia es cuántas
muestra a la vez.

## 40. La vista de calendario es una marca de la entrega.

Doce posteos con fecha no se leen como una lista: se leen como un mes. Pero eso
vale para los clientes de abono y no para una campaña suelta, así que es una
marca que se elige al armar la entrega —`entregas.vista`— y no una función
aparte con su propia pantalla.

Va en la entrega y no en el proyecto porque un mismo cliente puede tener la
grilla de septiembre, que es un mes, y una campaña de packaging, que es una
lista, dentro del mismo proyecto.

**La fecha se carga a mano.** Se descartó sacarla del nombre del archivo
—`01_lunes-08.jpg`— porque esa convención se rompe la primera vez que alguien
nombra un archivo distinto, y la rotura sería silenciosa: la pieza no
aparecería en el calendario y nadie sabría por qué. Cargar doce fechas es un
minuto; perseguir un posteo que no aparece es una tarde.

El calendario no reemplaza la lista: la acompaña. Tocar un día abre la pieza en
la lista de abajo y la trae a la vista — sin ese arrastre, en el teléfono la
pieza se abre fuera de pantalla y parece que el toque no hizo nada.

## 41. Un enlace subrayado no es un botón.

«Ver en grande» y «Comparar con la v1» eran texto azul subrayado en medio de
una fila de botones. Se leían como un texto que alguien se olvidó de terminar,
y eso es exactamente lo que hace que una aplicación parezca una página web
armada de apuro.

Ahora hay cinco variantes de botón, y cada una dice algo distinto sobre lo que
va a pasar:

| | Cuándo |
|---|---|
| `principal` | El camino que se propone. Lleno, con el acento. |
| `aprobar` | El acto que cierra una pieza. Verde, porque es un final. |
| `contorno` | Una acción real, pero no la propuesta. |
| `fantasma` | Acciones de apoyo: ampliar, comparar, cerrar. |
| `sutil` | Lo que existe pero no se quiere invitar. |

Y ocho iconos dibujados a mano, no una librería. Son ocho formas: traer una
librería entera para eso es peso que el cliente paga en el teléfono. Comparten
caja y grosor de trazo, que es lo que hace que se vean de la misma familia.

## 42. Cada pieza se revisa en una ventana.

Antes se desplegaba hacia abajo. Tocar un día del calendario mandaba al fondo
de la página y había que subir de nuevo para tocar el siguiente — lo que
convertía «revisar doce posteos» en doce viajes.

Ahora se abre una ventana: se resuelve, se cierra y se sigue con la que viene,
sin perder el lugar. Y trae el paso a la anterior y a la siguiente, que es lo
que permite hacer las doce de una sentada.

## 43. Lo que el cliente vino a hacer va arriba.

Descargar lo aprobado y enviar la revisión son las dos cosas por las que abrió
el portal. Estaban al final de la página, después de todas las piezas. Ahora
están arriba a la derecha, junto al avance, desde el primer segundo.

## 44. El calendario cambia de forma, y no es capricho.

En una computadora, la grilla del mes se lee de un vistazo. En un teléfono,
siete columnas dejan celdas de cuarenta píxeles donde no entra ni la palabra
«Boceto» — y **el estado en palabras es justo lo que hace falta**: un punto de
color no dice nada, hay que aprenderse qué significa cada uno.

Así que en el teléfono es una agenda: los días con trabajo, uno abajo del otro,
con lugar para decir las cosas por su nombre. Mismo componente, dos formas.
