# Mesa de trabajo

Revisión y aprobación de piezas entre una agencia y sus clientes, encima de
Google Drive.

- **La agencia** trabaja en Drive como siempre. Cada cliente es una carpeta
  compartida con el robot de la aplicación; cada subcarpeta es un trabajo; cada
  archivo es una pieza, y un `V2`, `V3` en el nombre es una vuelta, que alguien
  de la agencia asigna al trabajo que corresponde.
- **El cliente** entra por un link y una clave, ve lo que se le entregó,
  aprueba o pide cambios, y habla con el equipo por un chat.
- **La aplicación** anota qué pasó con cada pieza, avisa al equipo, cuenta los
  plazos y muestra el tablero del día. No guarda ningún archivo: los archivos
  siguen en Drive.

## Cómo está armada

| Capa | Qué es |
| --- | --- |
| `src/app` | Rutas de Next (App Router). `(admin)` es la gestión, `(portal)` es lo que ve el cliente, `api/` sirve archivos y miniaturas. |
| `src/admin`, `src/portal`, `src/ui` | Pantallas. Ninguna toca Drive ni el almacén: reciben datos y llaman acciones. |
| `src/lib` | Lo que sabe hacer cosas: Drive, almacén, sesiones, permisos, avisos. |
| `src/dominio` | Las reglas del negocio, sin dependencias: estados de una pieza, roles, comentarios. |
| `src/proxy.ts` | La puerta de `/gestion`: exige sesión y separa por sección. |
| `supabase/` | La única tabla y el script para subir los datos de `datos/`. |

Lo que se guarda —clientes, estados, chats, equipo— va a **Supabase** si están
`SUPABASE_URL` y `SUPABASE_SERVICE_KEY`, y si no a archivos en `datos/` (solo
sirve en una computadora, nunca en internet).

## Correr en esta computadora

```bash
npm install
cp .env.example .env.local   # y completarlo
npm run dev
```

- `/gestion` — la gestión de la agencia. Pide correo y contraseña.
- `/t/<token>` — el portal de un cliente. El link se copia desde la gestión.
- `/diagnostico` — si la aplicación llega a Drive y dónde guarda.

Cómo se usa, paso a paso: `COMO-USAR.md`. Cómo se sube a internet:
`DESPLIEGUE.md`. Por qué está hecho como está: `DECISIONES.md`.

## Comprobar

```bash
npm test        # las pruebas, incluidas las que vigilan los cimientos
npm run lint
npx tsc --noEmit
npm run build   # lo mismo que corre Netlify
```
