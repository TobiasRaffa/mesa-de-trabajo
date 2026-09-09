# Preparar Google Drive

Lo que hay que dejar armado para que la aplicación pueda leer los archivos.
Son dos cosas: **ordenar las carpetas** y **crear un usuario robot** que las
pueda leer.

La primera se puede hacer hoy y no depende de nada. La segunda conviene hacerla
con la cuenta de Google de la agencia, no con una personal.

---

## Parte 1 — Ordenar las carpetas

La aplicación espera que todos los clientes tengan la misma forma. Cuanto más
parejo sea, menos configuración especial hace falta después.

```
Clientes/
├── Café Otoño/                ← una carpeta por cliente
│   ├── Campaña de temporada/     un proyecto
│   ├── Rediseño de identidad/    otro proyecto
│   ├── Entregas finales/      ← nombre fijo, igual en todos
│   └── Facturas/              ← nombre fijo, igual en todos
│
└── Nómade/
    ├── Grilla septiembre/
    ├── Packaging lata/
    ├── Entregas finales/
    └── Facturas/
```

### Las reglas

**Una carpeta por cliente.** Se conecta una sola vez y ese link no se toca
nunca más.

**Cada subcarpeta es un proyecto.** Si mañana creás «Campaña verano» en Drive,
aparece sola como proyecto en la aplicación. No hay que cargar nada.

**Dos subcarpetas con nombre fijo, iguales en todos los clientes:**

| Carpeta | Para qué |
|---|---|
| `Entregas finales` | Acá se mueve solo lo aprobado. De acá se lo baja el cliente. |
| `Facturas` | Se sube el PDF y aparece en el portal del cliente. |

Tienen que llamarse **exactamente igual** en todos, porque la aplicación las
busca por nombre.

### Y una costumbre nueva

**Numerar los archivos** desde el próximo trabajo: `01_`, `02_`, `03_` adelante
del nombre.

```
01_lunes.jpg
02_martes.jpg
03_receta.jpg
```

Es lo único que hace falta para que los doce posteos de una grilla entren en
orden sin que nadie los acomode. No cuesta nada y no molesta a nadie.

---

## Parte 2 — El usuario robot

> ### ✅ Hecho, con la cuenta de la agencia — 9/9/2026
>
> El robot ya existe y ya está conectado a la aplicación. Su correo es:
>
> ```
> portal@mesa-de-trabajo-508117.iam.gserviceaccount.com
> ```
>
> Proyecto de Google Cloud: `mesa-de-trabajo-508117`. La llave está guardada
> fuera del proyecto, en `C:\Users\windows\claves\mesa-de-trabajo-agencia.json`.
> Comprobado el 9/9/2026: la llave funciona y la Drive API está habilitada.
>
> **Falta solo el paso 7: compartirle las carpetas.** Hasta que eso pase, el
> robot no ve nada —que es exactamente como tiene que ser—.
>
> Los pasos 1 a 6 quedan escritos abajo para cuando haya que rehacerlo.

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

## Qué me tenés que pasar cuando esté

1. El correo del robot
2. Dónde quedó guardado el archivo de la llave (la ruta, no el contenido)
3. El link de la carpeta de un cliente para probar

Con eso conecto la aplicación a las carpetas de verdad.
