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

## 45. La dirección visual, elegida entre opciones y no propuesta a ciegas.

Se dibujaron siete maquetas —tres ventanas, dos calendarios, dos páginas— y se
eligió sobre ellas. Quedó **«marcado»**: contraste alto, tipografía con peso,
bloques de color definidos, y **cero esquinas redondeadas**. Los bordes se ven.

| | |
|---|---|
| Neutros | Cálidos, girados al ocre. Al lado de una pieza impresa un gris frío se ve enfermo; este papel se ve papel. |
| Acento | Verde profundo `#1b4d3e`. Es también el color de aprobar, porque aprobar **es** la acción principal del portal. |
| Ámbar | Lo que está esperando algo. |
| Rojo | Lo que está mal. Se usa poco, a propósito. |

La banda de color en el encabezado de la ventana es la idea central: dice de
quién es la pieza, cómo se llama y en qué anda, sin que haya que buscarlo.

Se descartó la barra lateral fija: en una pantalla de 1280 se come una cuarta
parte de forma permanente para tres botones que se usan al final.

> **Revertido.** Ver la [decisión 48](#48-el-resumen-y-las-acciones-van-al-costado):
> la barra lateral entró igual, y el argumento de arriba resultó estar mirando
> la dimensión equivocada.

## 46. La fuente la servimos nosotros.

`next/font` la descarga al compilar y la deja junto al resto de la aplicación.
Eso evita un pedido a otro servidor mientras el cliente espera —en un teléfono
con datos móviles se nota— y de paso no le cuenta a Google quién abrió el
portal de la agencia.

Se intentó primero con un `@import` en la hoja de estilos y **rompió la
aplicación entera**: CSS exige que los `@import` vayan antes que cualquier
regla, y el nuestro quedó al final. Devolvía 500 y el mensaje hablaba de
«Parsing CSS source code failed», que no dice qué hacer.

## 47. Mes, semana o lista: elige el cliente, habilita la agencia.

El interruptor de tres vistas aparece **solo si la agencia marcó la entrega
como calendario** al armarla. Si no la marcó, hay lista y nada más.

La división es a propósito: la agencia sabe si esa entrega tiene sentido como
mes —una grilla de contenido sí, una campaña de packaging no—, y el cliente
sabe cómo prefiere mirarla. Cada uno decide lo que le corresponde.

## 48. El resumen y las acciones van al costado.

Estaban en una banda negra a lo ancho, arriba de las piezas. Pasaron a una
columna a la derecha, fija mientras se baja. En el teléfono vuelven arriba,
que es donde hay lugar.

Esto revierte lo que decía la [decisión 45](#45-la-dirección-visual-elegida-entre-opciones-y-no-propuesta-a-ciegas).
El argumento de entonces —«se come una cuarta parte del ancho»— medía la
dimensión que sobra. Una pantalla de computadora es más ancha que alta: el
ancho es lo que hay de más y el alto es lo que falta. La banda horizontal se
llevaba alto que le hacía falta al trabajo y, peor, se perdía apenas se bajaba
un poco; la columna no se va nunca.

## 49. Los cambios son una lista, no un texto.

Un cliente no piensa el pedido entero de una vez: se acuerda de una cosa hoy y
de otra mañana. Con un solo campo, agregar significaba reabrir, releer y
escribir al final, con el riesgo de pisar lo anterior. Ahora cada punto se
agrega, se corrige y se borra por separado, hasta que se envía la revisión;
después queda firme.

**Anotar el primer cambio es pedir cambios; borrar el último es arrepentirse.**
Son las dos únicas veces que tocar la lista mueve la pieza. Corregir la
redacción o sumar el tercer punto no es una decisión nueva y no toca la
máquina de estados.

Esto arregla el botón de «editar cambios», que no funcionaba: despachaba
`pedir_cambios` sobre una pieza que ya estaba en `cambios_marcados`, y el
dominio —con razón— lo rechazaba. **Editar es estado de pantalla, no un evento
del negocio.** Confundir las dos cosas era el error; la regla del dominio
estaba bien y no se tocó.

## 50. Las ventanas se apilan, y atiende la de arriba.

Al ampliar una pieza hay dos ventanas abiertas, una encima de la otra. Cada
una escuchaba el teclado en `document` por su cuenta, así que Escape las
cerraba a las dos de golpe: se cerraba la imagen y, detrás, la pieza entera
que se estaba revisando —con lo escrito a medias adentro—.

Hay una pila (`src/ui/pilaDeVentanas.ts`) y solo la de más arriba atiende
Escape y atrapa el foco. Se sacan una ventana del medio y un cierre repetido
—React puede limpiar un efecto más de una vez— sin que ninguna de las dos
cosas promueva a la ventana equivocada.

Vive aparte del `hook` a propósito: así la regla se prueba sin navegador, como
el resto de lo que decide algo.

## 51. Tres errores de medida que solo aparecen probando.

Ninguno de los tres da error; los tres se ven mal y nada avisa.

| Dónde | Qué pasaba | Por qué |
|---|---|---|
| Imagen ampliada | Se dibujaba a tamaño completo y se iba de la pantalla | Faltaba `min-h-0` en la cadena de elementos flexibles: un elemento flexible no se achica por debajo de su contenido si no se le dice |
| Grilla del portal, en el teléfono | Un pedido largo la ensanchaba y la página se desplazaba de costado | Faltaba `min-w-0` en las columnas: lo mismo, pero a lo ancho |
| Comparador | Las láminas se medían con una proporción fija (`aspect-[4/5]`) | Una pieza se juzga contra la pantalla que la muestra, no contra su propia forma |

## 52. La forma real: carpeta del cliente, carpetas de trabajo, archivos.

Lo que la agencia comparte con la aplicación es **la carpeta del cliente**.
Adentro arma carpetas de trabajo —«Logos», «Calendario septiembre»,
«Banners»— y en cada una van varios archivos. Cada archivo es una pieza.

```
Café Otoño/                 ← lo único compartido con el robot
├── Logos/
│   ├── 9304.jpeg           ← una pieza
│   └── 9304 V2.jpeg        ← otra pieza
└── Calendario septiembre/
```

La consecuencia que importa: **crear una carpeta en Drive alcanza para que
aparezca en el portal**. No hay nada que dar de alta. Subir el archivo *es*
darlo de alta, que era el punto de todo esto.

## 53. El permiso sube por el árbol, no mira solo la carpeta madre.

Con la forma anterior —archivos sueltos en la carpeta compartida— alcanzaba
con mirar el padre directo. Con la forma real, los archivos cuelgan un nivel
más abajo y **todos quedaban rechazados**: el portal se veía vacío y las
miniaturas devolvían 404.

Ahora `archivoAutorizado` sube por las carpetas madres hasta encontrar una
administrada, con tres cuidados que están probados:

| Cuidado | Por qué |
|---|---|
| Tope de 6 niveles | Un árbol muy profundo no puede volverse una cadena infinita de pedidos a Google. Pasado el tope se rechaza, que es el lado seguro. |
| No revisitar carpetas | En Drive un elemento puede tener varias madres, y con atajos se arman ciclos. |
| Recuerdo de 5 minutos | Doce miniaturas preguntaban doce veces por la misma carpeta madre. Cada pregunta es un viaje de red. |

El recuerdo no es un agujero: quitarle el acceso se hace dejando de compartir
la carpeta en Drive, y entonces el pedido a Google falla antes de llegar a la
caché.

## 54. Qué se muestra de cada carpeta vive en un solo módulo.

Si el cliente ve una carpeta, y si se mira como lista o como mes, no puede
vivir en Drive: Drive no tiene dónde anotarlo.

`src/lib/ajustesDeCarpeta.ts` es el único lugar que contesta esas dos
preguntas. Hoy contesta desde variables de entorno, que es lo único que hay
sin base de datos. Cuando exista el panel de administración se cambia el
cuerpo de dos funciones y **no se toca ninguna pantalla**.

Por omisión: **se muestra, como lista**. Una carpeta nueva aparece sola;
esconderla es la acción deliberada. Al revés —que haya que habilitar cada
carpeta— convertiría cada trabajo nuevo en un trámite, que es justo lo que el
portal viene a sacar del medio.

## 55. La barra pasa a la izquierda y se lleva todo lo que no es el trabajo.

A la izquierda, a lo alto y quieta: quién es el cliente, en qué carpeta está,
a cuáles más puede entrar, cómo viene la revisión, los botones y el link a
Drive. A la derecha, solo las piezas.

Esto termina de mover lo que la [decisión 48](#48-el-resumen-y-las-acciones-van-al-costado)
había empezado. El encabezado que estaba arriba de todo —cliente y proyecto—
se fue adentro de la barra: era información de contexto ocupando el lugar del
trabajo.

El link de Drive es **el de la carpeta que se está mirando**, no el del
cliente entero: lleva a lo mismo que hay en pantalla. Solo funciona para quien
ya tenga acceso a esa carpeta desde su cuenta de Google; para el resto, Drive
muestra su propia pantalla de pedir acceso. Es correcto que sea así: los
permisos de Drive los da la agencia en Drive, no esta aplicación.

## 56. Un error de Drive no se le muestra al cliente.

La pantalla del portal la abre gente de afuera de la agencia. Los mensajes de
Google traen identificadores de carpeta y a veces la dirección del robot.

El detalle va al registro del servidor; al cliente se le dice que es un
problema nuestro y que su trabajo no se perdió. Mientras se desarrolla, el
detalle sí se ve en pantalla —ahí no hay a quién filtrárselo—.

## 57. Una vuelta nueva se marca con el nombre del archivo.

`9304.jpeg` es la primera versión; `9304 V2.jpeg` es la segunda vuelta de la
**misma** pieza. El portal las junta, muestra la última y habilita el botón de
comparar.

Se eligió esto porque es **lo más barato que había**: renombrar al guardar es
algo que un diseñador ya hace sin pensar, y no obliga a abrir la aplicación
para avisar nada. La alternativa —marcar la versión desde una pantalla— agrega
un paso a algo que hoy no lo tiene, y el paso que se agrega es el que se
olvida. De hecho el nombre ya venía escrito así en la carpeta de prueba, sin
que nadie lo hubiera pedido.

Dos límites, los dos a propósito:

- **La extensión cuenta.** `9304.jpg` y `9304.png` son dos piezas. Entregar el
  mismo trabajo en dos formatos —uno para mirar, otro para imprimir— es común,
  y juntarlos sería mentir sobre qué se está aprobando.
- **No se adivina nada más.** Solo el sufijo. Que dos trabajos distintos se
  junten solos sería mucho peor que no agruparlos.

La regla vive en `src/lib/versiones.ts`, aparte de Drive y de las pantallas,
con veinte pruebas: incluye que «Verano 2026» no es una versión, que «V2» a
secas no es la vuelta de nada, y que subir una vuelta nueva no reordena la
lista que el cliente venía mirando.

## 58. Existe la app de gestión, y guarda en un archivo.

`/gestion` es la primera pantalla que configura la agencia: qué carpetas ve el
cliente y cuáles se miran como calendario.

Los ajustes van a `datos/ajustes.json`, al lado de la aplicación. Es lo que
corresponde mientras corre en una computadora: se abre con el Bloc de notas,
se copia, y no hace falta base de datos para empezar a usarla. Todo pasa por
`src/lib/ajustesDeCarpeta.ts`, así que mudarlo a Supabase es cambiar el cuerpo
de ese módulo sin tocar ninguna pantalla.

Se escribe a un archivo temporal y después se renombra encima. Renombrar es
atómico: si se corta la luz en el medio queda la configuración vieja entera,
en vez de una nueva por la mitad.

Lo que sale del archivo se valida igual que lo que llega por la red, porque el
archivo se puede editar a mano.

## 59. La acción de servidor valida contra Drive, no contra el formulario.

Una acción de servidor **es un endpoint público**: Next le cambia el cuerpo
por una referencia en el navegador, pero la dirección queda accesible para
cualquiera que sepa mandar el POST. Que el formulario solo se dibuje en una
pantalla interna no protege nada.

Por eso `guardarCarpeta` no cree el identificador que le llega: lo compara
contra las carpetas que de verdad existen adentro de la del cliente, y la
vista solo puede ser una de las dos conocidas. Sin eso, un POST armado a mano
podría llenar el archivo de ajustes con cualquier cosa.

**Lo que todavía no hay es autenticación.** Alcanza mientras la aplicación
corre en una computadora y no está en internet, y está dicho en la propia
pantalla. Antes de subirla, esto necesita login: es la deuda más grande que
queda abierta.

## 60. El error se cuenta distinto según quién mire.

En el portal, un fallo de Drive se registra en el servidor y al cliente se le
dice que es un problema nuestro. En `/gestion` el detalle **sí** se muestra:
esa pantalla la ve la agencia, que es justamente quien tiene que enterarse de
qué está mal y puede arreglarlo.

Es la misma información contada a dos públicos distintos, y esa asimetría es
la decisión, no un descuido.

## 61. El robot puede mover archivos, y no puede borrarlos.

Preguntado a Drive el 9/9/2026 sobre la carpeta real, con el permiso de Editor
que ya tiene:

| | |
|---|---|
| `canMoveItemWithinDrive` | ✅ `true` — puede mover lo aprobado a «Entregas finales» |
| `canAddChildren` / `canRemoveChildren` | ✅ `true` — sobre las carpetas |
| `canEdit` | ✅ `true` |
| `canDelete` | ❌ **`false`** |

Que no pueda borrar no es una limitación: es la garantía que hacía falta.
«Nada se borra nunca» dejó de depender de que el código se porte bien y pasó a
estar puesto en Google. Aunque un error nuestro pidiera borrar un archivo,
Drive lo rechaza.

Se preguntó en vez de probarlo: probar un movimiento habría movido un archivo
de verdad en la carpeta de la agencia.

## 62. El comentario general se convierte en conversación.

Era un cuadro de texto que se mandaba y desaparecía. Una entrega no se
resuelve con un mensaje suelto: se resuelve hablando, y eso hoy pasa en
WhatsApp, donde se mezcla con todo lo demás y se pierde. Ahora hay una
conversación por carpeta, al lado del trabajo del que se está hablando.

**Del otro lado siempre hay una persona.** Es la regla más vieja del proyecto
y la conversación no la toca: la aplicación no contesta, no sugiere
respuestas, no resume lo que dijo nadie. Está escrito en el encabezado del
módulo y el pie de la pantalla lo dice en voz alta: «contesta una persona del
equipo».

Lo único que la aplicación escribe son **avisos de estado** —«se envió la
revisión»—, y van centrados, en gris y sin burbuja, para que nadie los
confunda con alguien hablando.

La hora va en 24 horas. El formato que sale por omisión en `es-AR` es
«05:31 P. M.», que se lee como traducido de otro lado.

## 63. Cada cosa tiene su link a Drive: el archivo, el archivo; la carpeta, la carpeta.

En la barra, el link es de la carpeta que se está mirando. En cada fila de la
lista y adentro de la ventana de la pieza, el link es **de ese archivo**.

El link de la lista va **afuera** del botón que abre la pieza y no adentro: un
enlace adentro de un botón es HTML inválido y cada navegador resuelve el
conflicto como quiere —a veces abriendo las dos cosas—.

## 64. El avance se pega al nombre de la carpeta.

«Cuánto me falta» es una propiedad de lo que estoy mirando, no un dato suelto
en otra columna. El contador y la barra pasaron al lado del título, y el
título dejó de decir «Las piezas» para decir el nombre de la carpeta.

La barra de la izquierda queda con lo que identifica —el cliente, arriba y
grande; las carpetas— y con los botones **al fondo**: son el final del
recorrido, no el principio.

## 65. La conversación se guarda en el servidor, no en el navegador.

Una conversación necesita **dos lados**: el cliente escribe desde el portal y
la agencia contesta desde la app de gestión. Guardada en el navegador, cada uno
hablaba solo.

Va a `datos/conversaciones.json`, con el mismo renombre atómico que los
ajustes, y todo pasa por `src/lib/conversaciones.ts`. Mudarlo a Supabase es
cambiar el cuerpo de tres funciones.

Dos decisiones de forma:

- **Leer es una ruta, escribir es una acción.** Las acciones de servidor se
  despachan de a una por cliente, así que usarlas para preguntar cada pocos
  segundos le pondría un tapón a todo lo demás. Preguntar es `GET
  /api/conversacion/[carpetaId]`; escribir es una acción.
- **Se pregunta cada seis segundos, y solo con el chat abierto.** Es cuando
  importa enterarse rápido. Cerrado, el número del botón se actualiza al
  abrirlo y alcanza.

## 66. Quién habla lo fija la acción, no el formulario.

Hay **dos** acciones para escribir —`escribirComoCliente` en el portal,
`escribirComoAgencia` en gestión— y cada una tiene el lado puesto adentro,
fijo.

Con una sola acción y un parámetro `de`, cualquiera podría mandar un POST
desde el portal diciendo ser la agencia y ponerle palabras en la boca al
equipo. Una acción de servidor es un endpoint público: que el botón solo se
dibuje de un lado no protege nada.

Las dos validan que la carpeta exista de verdad adentro de la del cliente
(`src/lib/carpetas.ts`), y la ruta de lectura también: sin eso, alguien podría
probar identificadores hasta adivinar una conversación ajena. Contesta 404,
no 403, por lo mismo de siempre.

El panel es uno solo, en `src/ui/Conversacion.tsx`, y lo usan los dos mundos
—es la misma pantalla vista desde los dos lados del mostrador—. Lo único que
cambia es quién es «yo», que decide de qué lado va cada burbuja. Dos copias
serían la forma segura de que un día se vean distinto.

## 67. Una regla de `.gitignore` sin anclar se comió un archivo.

`datos/` parecía apuntar a la carpeta de ajustes de la raíz. En realidad
`git` la aplica a **cualquier** carpeta llamada `datos` en todo el árbol, así
que también tapó `src/admin/datos` y `src/portal/datos`, que son código
fuente.

Consecuencia real: `src/admin/datos/carpetas.ts` se creó y **nunca se
commiteó**. No hubo error, no hubo aviso; `git status` simplemente no lo
mostraba. Se descubrió al notar que un archivo modificado no aparecía en el
estado.

Ahora es `/datos/`, con la barra adelante, que ancla la regla a la raíz. Vale
la pena revisar con `git status --ignored` cada vez que se agrega una regla:
lo que se ignora de más no avisa nunca.

## 68. Los clientes se descubren, no se cargan.

La lista de clientes son las carpetas que alguien le compartió al robot. No hay
pantalla de «nuevo cliente» y no la va a haber: compartir la carpeta en Drive
es el único trámite, y a partir de ahí el cliente aparece solo.

Es la misma idea que ya regía para las carpetas de trabajo, aplicada un nivel
más arriba. Y por lo mismo, un cliente nuevo llega **habilitado**: el acto
deliberado ya ocurrió cuando alguien compartió la carpeta. Quitarle el acceso
es lo que hay que hacer a propósito.

Esto retira `DRIVE_CARPETA_CLIENTE`. La aplicación dejó de tener «el cliente»
en la configuración.

## 69. Cada cliente tiene su link, y se puede cambiar.

96 bits al azar en la dirección del portal (`/t/<token>`). Adivinarlo probando
no es una estrategia.

Es la primera mitad del modelo de acceso que se había diseñado; la segunda
—pedirle al cliente su tag— llega con la base de datos. Hasta entonces, el
link **es** el acceso, y por eso importa que se pueda cambiar: renovar el link
corta en el acto a quien tenga el viejo. Es lo que se hace cuando alguien se va
de la empresa del cliente o el link se reenvía a quien no correspondía.

Mientras se trabaja en la máquina, un link inexistente cae en el primer cliente
habilitado, con un cartel que lo dice. En producción no: ahí un link que no
vale es un link que no vale. Sin eso, cada prueba local empezaba copiando un
link.

## 70. Un link que no vale y un cliente apagado dan la misma respuesta.

«Este link no está disponible», sin distinguir cuál de las dos cosas es.
Distinguirlas le diría a quien prueba links si acertó el cliente y falló el
resto. Es la misma razón por la que un archivo no autorizado responde 404 y no
403.

## 71. El calendario se edita a propósito, y se guarda de a una tanda.

Tres decisiones, y las tres son la misma idea: un calendario es una promesa de
fechas, y no se toca sin querer.

1. **Se abre en modo mirar.** Editar es un botón. Siempre editable es siempre
   a un clic de desarmarse.
2. **Se guarda de a una tanda.** Se acomodan varias piezas y recién ahí se
   guarda. Guardando en cada movimiento, cualquier reacomodo a medio hacer
   deja el calendario diciendo algo que nadie quiso decir. Y cancelar sin
   haber tocado el servidor es la mitad del valor de tener un botón.
3. **Se arrastra, pero también se puede sin arrastrar.** Arrastrar es lo
   natural con el mouse y no existe con el teclado: cada pieza puesta tiene su
   botón para sacarla, y las que no tienen día se asignan eligiéndolas y
   tocando el día.

La fecha se guarda por **archivo** y como `AAAA-MM-DD`, no como un instante.
Un posteo sale «el 12», no «el 12 a las 03:00 UTC»: guardar una hora que nadie
eligió es pedir que un cambio de horario lo mueva un día. Convertir texto a
fecha se hace con el constructor de tres números y no parseando —`new
Date("2026-09-12")` es medianoche UTC, o sea el 11 a las 21 en Buenos Aires—.
Está probado en los dos sentidos.

Lo que se guarda acá es lo mismo que lee el portal: un dato, dos pantallas.

## 72. Las conversaciones se ordenan por quién debe una respuesta.

La pantalla de chats no se ordena por cliente ni alfabéticamente, sino por lo
que la agencia se pregunta todo el día: **dónde me están esperando**. Arriba,
lo que dijo el cliente y nadie contestó; después, lo más reciente; al final,
las carpetas donde no se habló nunca.

«El último que habló fue el cliente» es lo más parecido a «sin responder» que
se puede saber sin registrar quién leyó qué. Cuando existan los usuarios pasa
a ser «no leído» de verdad, por persona.

## 73. El estado de las piezas se mudó al servidor.

Vivía en el navegador del cliente, y eso tenía un techo: **si la aprobación no
llega al servidor, nada puede reaccionar a ella**. No se puede mover el archivo
a «Entregas finales», no se le puede avisar a nadie, y gestión no puede decir
qué pasó. Todo lo que se pidió después dependía de esto.

De paso arregla algo que ya molestaba: el cliente que revisaba desde el
teléfono y seguía desde la computadora encontraba dos borradores distintos.

Las reglas **no se mudaron**: `aplicar()` sigue siendo la misma función, ahora
llamada desde el servidor. Lo que se agregó alrededor es comprobar que el
pedido sea legítimo, guardar, y anotar en la historia.

La pantalla **no es optimista**: espera la respuesta y muestra lo que de verdad
quedó guardado. Adivinar el resultado y corregirlo después es cómo se termina
mostrando una aprobación que no ocurrió.

## 74. Aprobar mueve el archivo, y la pieza sigue a la vista.

Cuando el cliente aprueba, el archivo se muda a «Entregas finales» del cliente.
Ahí es donde lo va a buscar dentro de tres meses.

Dos cosas que hacen esto seguro:

- **El robot no puede borrar** (comprobado: `canDelete: false`). Mover es lo
  único que puede hacerle a un archivo, así que el peor error posible es
  dejarlo en la carpeta equivocada.
- **Si Drive no contesta, la aprobación vale igual.** Mover es una consecuencia
  de aprobar, no una condición: se anota «no se pudo mover» y sigue. Que Google
  esté caído no puede deshacer la decisión que tomó una persona.

**La consecuencia que había que resolver:** una vez mudado, Drive ya no lista
el archivo en la carpeta de trabajo, así que la pieza desaparecía del portal
—el cliente perdía de vista justo lo que acababa de aprobar, y con eso el botón
de descargarlo—. Por eso el estado recuerda de qué carpeta salió, y las piezas
mudadas se vuelven a traer por su identificador. Aprobar no puede costarle al
cliente perder la pieza de vista.

## 75. Dos links: uno del cliente y uno por carpeta.

- **Link del cliente**: todas sus carpetas visibles.
- **Link de una carpeta**: esa sola. Sirve para mandar «Calendario septiembre»
  sin que de paso se vea «Rediseño de identidad».

Uno de cada y estables. El del cliente se genera al descubrirlo; el de una
carpeta, recién cuando alguien lo pide —una carpeta que nadie va a compartir
por separado no necesita link, y generarlos todos de entrada llenaría el
archivo de tokens que no se usan nunca—.

## 76. El tag es la segunda mitad del acceso, y no viaja en la dirección.

El link solo no alcanza: se reenvía sin querer, queda en un chat de grupo, lo
ve quien mira el teléfono de al lado. El tag es una palabra que elige la
agencia y le pasa al cliente **por otro lado** —mandar los dos juntos es mandar
la llave pegada a la puerta—.

Cuatro decisiones alrededor:

| | |
|---|---|
| El tag **no viaja en la URL**, ni después de acertarlo | En la URL se copia al compartir, queda en el historial y viaja en `Referer` |
| Lo que queda es una galleta **firmada**, sin el tag adentro | Dice «este navegador acertó el de este link». Leerla no sirve para otro lado; fabricarla necesita la llave del servidor |
| Se compara **en tiempo constante** | `===` tarda distinto según cuánto coincide, y eso se mide |
| Se frena al octavo intento por link | El link ya es lo caro de adivinar; el freno cubre a quien consiguió el link y prueba tags a mano |

Un link que no vale, un cliente apagado y un tag equivocado dan **el mismo
mensaje**. Distinguirlos le diría a quien prueba si acertó a medias.

**Sin tag, el portal no deja entrar a nadie**, ni con el link correcto. Es el
estado seguro mientras alguien no decidió cuál va, y la pantalla de gestión lo
marca en amarillo.

## 77. Ver el portal desde gestión abre una pestaña nueva.

Entrar al portal desde gestión no tenía vuelta atrás. La solución **no** fue
poner un link de vuelta: un link a administración adentro del portal sería una
puerta de un mundo al otro, y la vería también el cliente.

Se abre en una pestaña nueva. La de gestión queda donde estaba, y el portal
sigue sin saber que administración existe.

## 78. La historia se anota sola.

Cada decisión queda con quién y cuándo: aprobó, pidió cambios, envió la
revisión, se movió a finales. Es lo que contesta «esto ya lo habíamos
aprobado» sin que nadie tenga que acordarse.

Se muestra en la pantalla de la carpeta, con lo último arriba, y con los
cambios pedidos al lado. Los avisos de la aplicación —«se movió a Entregas
finales»— figuran a nombre de la aplicación y no de una persona.

## 79. Del portal no sale ningún camino hacia administración.

Había uno, y era el más obvio: **la raíz del sitio redirigía a `/diagnostico`**.
Un cliente que borra el final de la dirección —o que toca el nombre del sitio
en el historial— caía en una pantalla interna, con las miniaturas de los
archivos y el estado de la conexión con Drive.

Ahora la raíz no contesta nada. Cada mundo tiene su puerta y hay que saberla.

Tres cosas más, en la misma dirección:

- **El portal no nombra ninguna ruta de administración**, ni siquiera para
  refrescarla. Los `revalidatePath("/gestion")` que tenían las acciones del
  portal no hacían nada —esas pantallas se dibujan de nuevo en cada visita— y
  eran una referencia de un mundo al otro.
- **Nada se indexa.** El link de un cliente es medio acceso: si Google lo
  indexara, dejaría de serlo.
- **Hay una prueba que lo vigila** (`sinPuertas.test.ts`). El linter ya impedía
  *importar* algo de administración; lo que no veía nadie era **un link**, que
  no rompe ninguna regla de módulos y abre exactamente la puerta que no tiene
  que haber. La prueba lee los archivos del portal como texto y busca esas
  direcciones. Se comprobó que falla de verdad agregando un link a propósito.

Lo que sigue abierto y no lo tapa esto: **`/gestion` no pide usuario ni
contraseña**, así que alguien que adivine la dirección entra. Eso se arregla
con login, antes de subir la aplicación a internet.

## 80. Se avisa siempre, se manda si se puede.

Anotar el aviso y mandarlo por correo son dos cosas separadas a propósito. Que
el correo no esté configurado —o que el proveedor se caiga— **no puede hacer
que el aviso se pierda**: queda en la bandeja del tablero igual, y ahí se ve,
con una etiqueta que dice que no salió.

El correo va por HTTP contra la API de un proveedor y no por SMTP: mandar mails
desde una casa suele estar bloqueado por el proveedor de internet, y lo que
llega termina en spam. Sin librería, con `fetch`, igual que con Drive.

Avisar **nunca lanza**. Un aviso es una consecuencia de lo que hizo el cliente,
no una condición: si falla, la aprobación vale igual.

Y los avisos van **hacia adentro**, al equipo. Lo que sale hacia el cliente lo
sigue escribiendo una persona.

## 81. Los mensajes listos son un papelito, no un robot.

La aplicación no le escribe al cliente. Lo que hay es el texto ya escrito para
que una persona lo lea, lo cambie si quiere, lo copie y lo mande por donde ya
le escribe siempre.

La diferencia importa y es la misma regla de siempre: un mensaje automático es
la aplicación hablando; esto es no tener que escribirlo de cero a las siete de
la tarde. Quien manda decide qué dice y cuándo.

## 82. El plazo es de la carpeta, y una pieza puede tener el suyo.

Se pone en la carpeta porque así se trabaja: una tanda de doce posteos vence
junta. Y se puede correr una pieza sola sin mover el resto —«esta la
necesitamos el jueves, el resto la semana que viene»—. El de la pieza gana.

Sigue valiendo la regla del principio: **el plazo avisa, no decide**. No hay un
evento de vencimiento en el dominio y no lo va a haber. Y una fecha vencida en
una carpeta ya terminada no es un problema: solo cuenta como vencida si todavía
falta que el cliente decida algo.

## 83. Aprobar escondía las piezas aprobadas, en tres lugares.

Mudar el archivo a «Entregas finales» tiene una consecuencia que apareció de a
poco: Drive deja de listarlo en la carpeta de trabajo, así que **cualquier
pantalla que cuente desde el listado crudo dice que la pieza no existe**.

Se vio tres veces: el portal perdía de vista lo recién aprobado, la historia de
gestión no mostraba justo la pieza más consultada, y el tablero decía «0
aprobadas» un segundo después de aprobar.

Las dos primeras se arreglaron con una copia cada una. La tercera obligó a lo
que correspondía desde el principio: **una sola función**,
`archivosConLasMudadas`, que todas usan. Tres copias de la misma idea es la
señal de que la idea tenía que vivir en un solo lado.

## 84. El link no andaba porque no era un link.

Se mostraba en un `<code>`: el texto de la dirección, sin poder tocarlo. Quien
lo veía hacía clic y no pasaba nada, y la conclusión razonable era «el link no
anda».

No había ningún problema con generarlos —comprobado: `/t/<token>` contesta y
pide la clave—. El problema era de la pantalla. Ahora es un enlace de verdad y
abre en otra pestaña.

La otra mitad de la confusión es la dirección: mientras la aplicación corre en
una computadora, lo que se copia es `http://localhost:3000/...`, que solo
funciona en **esa** computadora. Mandado a un teléfono no abre. No es un error:
es que todavía no está en internet. Los links de verdad nacen con el despliegue.

## 85. Los clientes son un árbol, y la configuración está aparte.

La pantalla de clientes se abre como Drive: cliente, sus carpetas, los archivos
de cada una. Imita esa forma porque **es** esa forma, y quien la usa ya tiene
ese mapa en la cabeza.

Dos decisiones:

- **Cada nivel se pide al abrirlo.** Leer de Drive todos los archivos de todos
  los clientes para dibujar una lista que arranca cerrada sería pagar por
  adelantado algo que casi nunca se mira.
- **Navegar y configurar son dos cosas.** La flecha muestra qué hay adentro; el
  botón de configuración muestra qué se puede cambiar. Antes estaban mezclados,
  y buscar un archivo obligaba a pasar por encima del botón que le corta el
  acceso a un cliente.

La pantalla de un cliente solo usa **el mismo árbol** y no una copia. Dos
formas distintas de configurar lo mismo terminan divergiendo, y la que se usa
menos queda vieja sin que nadie se entere.

## 86. El acceso directo no abría por dos razones a la vez.

La primera: **abría `/t/ejemplo`**, una dirección que quedó muerta cuando los
links pasaron a ser aleatorios por cliente. Contestaba «este link no está
disponible», que es exactamente lo que tiene que contestar.

La segunda, la que hacía que no abriera nada: **si el servidor ya estaba
prendido, el segundo fallaba** al chocar contra el mismo puerto, y la ventana
se cerraba sola. Desde afuera parecía que el acceso no hacía nada.

Ahora mira si el puerto ya está ocupado. Si lo está, no prende otro: abre la
aplicación y avisa que el servidor lo tiene la otra ventana. Y abre
`/gestion`, que es la puerta de la agencia y siempre existe; el portal se abre
con el link de cada cliente, que sale de ahí.

Los dos `.bat` son uno: el de gestión llama al otro con una variable. Dos
copias de un script se separan, y la que se usa menos queda vieja.

## 87. Los botones de la derecha van siempre en la misma columna.

La sangría del árbol se dibuja **adentro** de la fila, como un espacio en
blanco al principio, y no como relleno de la lista. Con relleno, cada nivel
angostaba la fila y los botones de la derecha se corrían hacia adentro: la
columna de Drive quedaba en escalera.

Cuando una fila no tiene un botón —un archivo no se configura— va **un hueco
del mismo ancho**. Una columna donde algunos botones faltan se lee como rota;
una donde hay lugares vacíos se lee como una columna.

Por lo mismo, las carpetas reservadas también tienen engranaje: adentro está lo
único que hay para ellas —el link a Drive y por qué no hay nada más—.

La configuración pasó a ser un icono. Un botón con la palabra «Configuración»
en cada fila competía por atención con el nombre, que es lo que se viene a
leer.

## 88. La clave de un cliente pide contraseña, y no viaja al navegador.

Estaba escrita en la pantalla de administración, a la vista de cualquiera que
pasara por atrás. Ahora está tapada: para verla o cambiarla hay que escribir
una contraseña (`CLAVE_DE_ADMIN`, en `.env.local`).

Lo que la hace valer algo es que **el dato no se manda al navegador** hasta que
alguien lo pide con la contraseña. Si solo se tapara en pantalla, estaría en el
código de la página y se leería con dos clics.

La contraseña sale de una variable de entorno y no del código: una contraseña
escrita en el fuente termina en el repositorio, y de ahí no sale más. Se
compara en tiempo constante, por lo mismo que el tag del cliente.

**Es una cortina, no una puerta.** Administración sigue sin login: quien llega
a la máquina, entra. Esto no lo arregla. La puerta es el login, y va antes de
subir la aplicación.

## 89. Sí o No, en vez de un botón que dice lo contrario.

«Ocultar» obliga a deducir el estado actual a partir de la acción contraria:
para saber si el cliente la ve hay que leer el botón y darlo vuelta en la
cabeza. Con dos botones —Sí marcado, No apagado— el estado se lee sin pensar,
y tocar el que ya está no rompe nada.

## 90. Las pantallas de administración no explican qué hace cada cosa.

Cada control tenía su párrafo en gris. Juntos tapaban lo que se viene a leer:
en una lista, los nombres y los estados. La explicación está en `COMO-USAR.md`,
que es donde se lee una vez, y no al lado de un botón que se usa todos los días.

Se conservan los avisos que **cambian una decisión** —«sin clave el link no deja
entrar», «sin correo configurado los avisos quedan solo acá»—, porque eso no es
explicar cómo funciona algo: es decir qué está pasando.

## 91. Una dirección de prueba para entrar al portal en la máquina.

El acceso directo no puede saber el link de un cliente: son al azar y distintos
para cada uno. `/probar` lleva al portal del primero.

**En producción no existe**: ahí devuelve 404. Una dirección fija que lleva al
portal de un cliente es justamente lo que el link al azar viene a evitar. Y aun
en la máquina no saltea nada: del otro lado sigue pidiendo la clave.

## 92. La conversación es del cliente, no de la carpeta.

Al principio había una por carpeta. En la práctica no se habla así: con el
cliente se habla de todo en el mismo hilo, y tener que adivinar en cuál de sus
cinco carpetas dijo algo es peor que no tenerlo separado.

Y el número que se muestra al lado es **lo que no leíste**, no cuántos mensajes
hay. Un contador que dice «14» para siempre no dice nada; el que importa es el
que baja a cero cuando mirás. Se guarda hasta qué momento leyó cada lado, y
abrir el chat marca leído.

La pantalla de conversaciones muestra lo único que hace falta para decidir a
quién contestar: **el cliente, lo último que se dijo y cuándo**. El nombre de
la carpeta no estaba ayudando a nada.

## 93. El tiempo de revisión se cuenta en días y se hereda.

Una fecha hay que volver a poner en cada tanda; «tres días» se pone una vez y
sirve siempre. La fecha de vencimiento sale sola: el día que se subió el
archivo, más los días.

Se hereda cliente → carpeta → archivo, y **lo de arriba borra lo de abajo**.
Cambiar el del cliente vuelve a poner a todos en esa cifra. Sin eso, poner
cinco días arriba dejaría carpetas con tres y nadie sabría de dónde salió ese
tres. La pantalla marca **heredado** cuando el número viene de arriba, porque
un «3» solo no distingue entre «alguien eligió tres» y «nadie eligió nada».

## 94. `node:fs` se coló al navegador y rompió la compilación entera.

El desplegable de días importaba sus constantes de `plazos.ts`, que lee y
escribe archivos. Turbopack falló con «the chunking context does not support
external modules (request: node:fs/promises)» —un mensaje que no nombra al
culpable ni al archivo que lo importó—.

La regla que deja: **lo que una pantalla necesita saber va en un módulo que no
toque el servidor.** Las constantes y la regla de herencia viven ahora en
`src/lib/dias.ts`, que no importa nada de Node.

## 95. La ruta del chat pedía el identificador y nada más.

Encontrado probando la ruta a mano, no desde el navegador: `GET
/api/conversacion/<id>` devolvía la conversación entera **a cualquiera que
supiera el identificador de la carpeta en Drive** —que lo ve cualquiera con
quien la agencia haya compartido esa carpeta—, sin haber escrito nunca la
clave.

La página del portal pedía la clave; la ruta que la página usa, no. Es el error
clásico de poner el control en la pantalla y no en la puerta.

Ahora la ruta pide la misma galleta que el portal, y vale tanto el link del
cliente como el de cualquiera de sus carpetas. La app de gestión dejó de usar
esa ruta: pide los mensajes por una acción, que es su lado del mostrador.

## 96. Sin textos que expliquen los controles.

Se sacaron de las dos aplicaciones. Lo que quedó son estados, avisos que
cambian una decisión, y mensajes de error. La explicación vive en
`COMO-USAR.md`, que se lee una vez, y no al lado de un botón que se usa todos
los días.

En el mismo pasada: el engranaje es la ruedita dentada de siempre, «Ocultar»
pasó a ser Sí/No, la gente del equipo no se edita hasta apretar **Editar**, y
el diagnóstico salió de la barra —cuando Drive falla, cada pantalla lo dice
donde pasa—.

## 97. La herencia se escribió una sola vez.

El tiempo de revisión y quién lleva cada cosa tienen **exactamente la misma
regla**: se hereda cliente → carpeta → archivo, y poner un valor arriba deja
heredando a todo lo de abajo.

Escrita dos veces, ya se sabe cómo termina: una de las dos se arregla y la otra
no. Vive en `src/lib/almacenHeredable.ts` y los dos ajustes son envoltorios
finos con su regla de negocio.

**«No está» y «está puesto en nada» son cosas distintas.** Una carpeta puesta
en «sin asignar» **no** vuelve a heredar el responsable del cliente: alguien
decidió que esa carpeta no la lleva nadie. Por eso se guarda `null` y no se
borra la entrada, y por eso la herencia usa `!== undefined` y no `??` —con
`??`, un «nadie» caería al de arriba en silencio, que es justo lo contrario de
lo que se pidió—. Está probado en los dos sentidos.

## 98. Cada archivo tiene su ruedita.

Antes solo se configuraban el cliente y la carpeta, y los casos sueltos no
entraban: «esta la necesitamos el jueves y el resto la semana que viene»,
«esta la lleva Delfi aunque el resto sea de Nari».

El archivo es el último escalón: lo que se pone ahí gana sobre todo lo de
arriba, y no tiene nada debajo que borrar.

Comprobar que un archivo existe es distinto que comprobar una carpeta: no
alcanza con el identificador, hay que saber en qué carpeta está. Por eso la
acción recibe también la carpeta y verifica que el archivo esté adentro —el
identificador llega de afuera y no se puede creer—.
