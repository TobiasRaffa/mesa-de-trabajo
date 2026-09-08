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
