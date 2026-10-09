# Preparar Google Drive

Lo que hay que dejar armado para que la aplicación pueda leer los archivos.
Son dos cosas: **ordenar las carpetas** y **crear un usuario robot** que las
pueda leer.

La primera se puede hacer hoy y no depende de nada. La segunda conviene hacerla
con la cuenta de Google de la agencia, no con una personal.

---

## Parte 1 — Ordenar las carpetas

Lo único que se le comparte a la aplicación es **la carpeta del cliente**. Todo
lo que hay adentro lo descubre sola.

```
Café Otoño/                    ← esto es lo que se comparte. Una sola vez.
├── Logos/                        una carpeta de trabajo
│   ├── 9304.jpeg
│   └── 9304 V2.jpeg
├── Calendario septiembre/
├── Banners/
├── Entregas finales/          ← nombre fijo, igual en todos
└── Facturas/                  ← nombre fijo, igual en todos
```

### Las reglas

**Una carpeta por cliente, y es la que se comparte.** Se conecta una sola vez y
no se toca nunca más.

**Cada carpeta de adentro es un trabajo.** Si mañana creás «Campaña verano» en
Drive y le tirás los archivos, aparece sola en el portal. No hay que cargar
nada en ningún lado: subir el archivo *es* cargarlo.

**Adentro de cada una van varios archivos.** Cada archivo es una pieza que el
cliente aprueba o devuelve por separado.

**Desde el panel de administración se elige cuáles ve el cliente** y cuáles
quedan solo para el equipo. Una carpeta nueva se muestra por defecto; esconderla
es la acción deliberada.

**Dos subcarpetas con nombre fijo, iguales en todos los clientes:**

| Carpeta | Para qué |
|---|---|
| `Entregas finales` | Acá se mueve solo lo aprobado. De acá se lo baja el cliente. |
| `Facturas` | Se sube el PDF y aparece en el portal del cliente. |

Tienen que llamarse **exactamente igual** en todos, porque la aplicación las
busca por nombre.

### Y una costumbre nueva

**Numerar los archivos** cuando el orden importe: `01_`, `02_`, `03_` adelante
del nombre. La aplicación los muestra por nombre, así que numerarlos es lo
único que hace falta para que los doce posteos de una grilla entren en orden
sin que nadie los acomode.

---

## Parte 2 — El usuario robot

> ### ✅ Hecho, con la cuenta de la agencia — 9/9/2026
>
> El robot ya existe y ya está conectado a la aplicación. Su correo es:
>
> ```
> <correo-de-la-cuenta-de-servicio>.iam.gserviceaccount.com
> ```
>
> Proyecto de Google Cloud: `mesa-de-trabajo-508117`. La llave está guardada
> fuera del proyecto, en `C:\Users\windows\claves\mesa-de-trabajo-agencia.json`.
> Comprobado el 9/9/2026: la llave funciona y la Drive API está habilitada.
>
> **Conectado a la primera carpeta** el 9/9/2026: «Cafe Otono - Prueba», con
> «Banners - prueba» y «Logo - Prueba» adentro. El portal ya la lee.
>
> Falta compartirle las carpetas de los clientes de verdad, una por una
> (paso 7). Los pasos 1 a 6 quedan escritos abajo para cuando haya que
> rehacerlo.

La aplicación no entra a Drive con la cuenta de nadie. Google deja crear un
**usuario que no es una persona**: no tiene contraseña ni pantalla de login,
tiene un archivito con una llave. Y tiene su propio correo, feo pero correo al
fin.

Ese correo se comporta como cualquier compañero de trabajo: **se le comparte
una carpeta y la ve; se le saca y deja de verla**. No tiene acceso a nada más.

> **Importante:** hacer esto con la cuenta de Google **de la agencia**, no con
> una personal. Si la aplicación depende de una cuenta personal, el día que esa
> persona no esté, la aplicación se queda afuera.

### Los pasos

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) con la
   cuenta de la agencia.

2. Arriba a la izquierda, en el selector de proyecto: **Proyecto nuevo**.
   Ponerle `mesa-de-trabajo`. Tarda unos segundos; después hay que asegurarse
   de que quede seleccionado arriba.

3. En el buscador de arriba escribir **Google Drive API**, entrar y apretar
   **Habilitar**.

   > Este paso es el que más se olvida. Sin él la aplicación falla con un error
   > que no explica nada.

4. En el buscador escribir **Cuentas de servicio** → **Crear cuenta de
   servicio**. Nombre: `portal`. Los dos pasos que ofrece después (roles y
   usuarios) se saltean: son permisos de Google Cloud, no de Drive.

5. Queda una fila con un correo largo, algo así:

   ```
   portal@mesa-de-trabajo-123456.iam.gserviceaccount.com
   ```

   **Copiarlo.** Es lo que se usa en el paso 7.

6. Clic en esa cuenta → pestaña **Claves** → **Agregar clave** → **Crear clave
   nueva** → **JSON** → Crear. Se descarga un archivo.

   > ⚠️ **Ese archivo es la llave.** Tratarlo como una contraseña: no mandarlo
   > por WhatsApp, no subirlo a ningún lado. Guardarlo en una carpeta aparte.

7. En Drive, a **cada carpeta de cliente**: clic derecho → **Compartir** →
   pegar el correo del robot → permiso de **Editor** → Enviar.

   Tiene que ser Editor y no Lector: la aplicación necesita **mover** los
   archivos aprobados a «Entregas finales».

---

## Cómo se le saca el acceso

Igual que a una persona: se entra a la carpeta, se busca ese correo en los
compartidos y se lo quita. No hay nada que programar.

Es una propiedad que conviene tener presente: **el alcance de la aplicación
sobre Drive se controla desde Drive**, no desde la aplicación.

---

## Qué me tenés que pasar por cada cliente nuevo

Solo **el link de su carpeta**, después de compartirla con el robot. Nada más:
las carpetas de adentro y los archivos los descubre sola.
