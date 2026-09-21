-- La base de datos entera.
--
-- Una tabla. No es un atajo: es la forma que tiene lo que la aplicación
-- guarda. Once colecciones de documentos con su identificador, ninguna
-- consulta que cruce unas con otras.
--
--   clientes         un cliente por carpeta de Drive del cliente
--   ajustes          qué se muestra de cada carpeta, y cómo
--   piezas           en qué estado está cada archivo y sus cambios
--   publicaciones    qué día sale cada pieza
--   plazos           días de revisión, heredables
--   responsables     quién lleva cada cosa, heredable
--   equipo           las personas de la agencia
--   avisos           los correos que salieron
--   conversaciones   el chat con cada cliente
--   leidos           hasta dónde leyó cada lado   (una sola fila)
--   secreto          con qué se firman las galletas (una sola fila)
--
-- **Por qué no catorce tablas.** Hubo catorce escritas acá, de un diseño que
-- la aplicación nunca implementó: perfiles, proyectos, asignaciones, facturas,
-- decisiones. Quedaron meses describiendo algo que no existía. Un esquema que
-- se escribe antes que el código envejece sin que nadie lo note; este no
-- puede, porque es exactamente lo que el código escribe.
--
-- El día que haga falta cruzar datos —informes, facturación— se normaliza lo
-- que lo necesite. Pasar de jsonb a columnas es una migración normal; arrancar
-- con catorce tablas equivocadas es la deuda que ya tuvimos una vez.

create table if not exists documentos (
  -- Qué clase de cosa es: "clientes", "piezas", "conversaciones".
  coleccion   text not null,

  -- Cuál. Suele ser el identificador de la carpeta o del archivo en Drive.
  -- Los documentos sueltos —los que son uno solo— usan el id "unico".
  id          text not null,

  -- El documento, tal como lo escribe la aplicación. Se valida al leerlo:
  -- lo que sale de la base es tan poco confiable como lo que llega por la red.
  datos       jsonb not null,

  creado      timestamptz not null default now(),
  modificado  timestamptz not null default now(),

  primary key (coleccion, id)
);

-- Casi todas las lecturas son «traeme todo lo de esta colección», y el orden
-- de alta es el que espera quien lo cargó.
create index if not exists documentos_por_coleccion
  on documentos (coleccion, creado);

-- `modificado` lo pone la base y no la aplicación: si lo mandara el código,
-- alcanzaría con olvidarse una vez para que la fecha mienta.
--
-- **La función la escribe la 002 y nadie más, y eso es lo importante.** Estaba
-- definida acá *y* allá: la 002 le agrega subir el número de versión, que es el
-- cerrojo que impide que dos personas se pisen. Como este archivo está escrito
-- para poder volver a pegarse —`if not exists`, `create or replace`—, alcanzaba
-- con repegarlo para mirar las políticas y el cerrojo se apagaba **en
-- silencio**: la versión dejaba de subir, la comprobación coincidía siempre, y
-- volvía la pérdida de mensajes que la 002 vino a arreglar. Una sola definición
-- y no hay forma de que eso pase.
--
-- El disparador sí se crea acá, porque es de esta tabla; apunta a la función
-- que la 002 deja escrita.

-- ---------------------------------------------------------------------------
-- Quién puede entrar.
--
-- Nadie, salvo el servidor.
--
-- El navegador nunca habla con la base: cada lectura y cada escritura pasan
-- por el servidor de la aplicación, que usa la llave de servicio. Esa llave
-- salta las políticas por diseño, así que la política acá es cerrar todo lo
-- demás: si la llave pública se filtrara —está pensada para ser pública—, no
-- alcanzaría para leer una sola fila.
--
-- Lo que separa los datos de un cliente de los de otro sigue siendo el código,
-- igual que hoy: el portal deriva de qué cliente es cada pedido a partir del
-- link, y ninguna acción acepta que se lo digan desde afuera.

alter table documentos enable row level security;

-- **El permiso de la llave de servicio, escrito a mano.**
--
-- Supabase le da permisos a las tablas nuevas por omisión, pero eso depende de
-- una casilla del panel —«Automatically expose new tables»— que es razonable
-- querer apagada. Apagada, una tabla nueva puede quedar sin permiso **también**
-- para `service_role`, que es la que usa el servidor de la aplicación: cada
-- pedido fallaría con un error de permisos, y el error no diría que la causa
-- fue una casilla marcada hace meses.
--
-- Dicho acá no depende de ninguna casilla. Y no abre nada: `service_role` ya
-- es la llave que puede todo, y es la única que nunca sale del servidor.
grant usage on schema public to service_role;
grant select, insert, update, delete on documentos to service_role;

-- Sin ninguna `policy`, RLS niega todo. Se deja dicho igual, porque «no hay
-- políticas» se lee como un olvido y esto es una decisión.
drop policy if exists documentos_nadie on documentos;
create policy documentos_nadie
  on documentos
  for all
  using (false)
  with check (false);
