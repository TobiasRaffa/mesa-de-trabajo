-- ============================================================================
--  Mesa de trabajo — la vista de calendario
-- ============================================================================
--
--  Una entrega de doce posteos con fecha de publicación no se lee igual que
--  una lista: se lee como un mes. Pero eso vale para los clientes de abono y
--  no para una campaña suelta, así que **es una marca por entrega y no una
--  función aparte**.
--
--  Se guarda en la entrega y no en el proyecto porque un mismo cliente puede
--  tener la grilla de septiembre —que es un mes— y una campaña de packaging
--  —que es una lista— dentro del mismo proyecto.
-- ============================================================================

create type vista_entrega as enum (
  'lista',      -- una detrás de otra, en el orden en que se armó
  'calendario'  -- ubicadas en el mes, por fecha de publicación
);

alter table entregas
  add column vista vista_entrega not null default 'lista';

comment on column entregas.vista is
  'Cómo se le muestra la entrega al cliente. Se elige al armarla, en el panel.';


-- ============================================================================
--  La fecha de cada pieza
-- ============================================================================
--
--  Se carga a mano al armar la entrega. Se descartó sacarla del nombre del
--  archivo —«01_lunes-08.jpg»— porque obliga a una convención que se rompe la
--  primera vez que alguien nombra un archivo distinto, y esa rotura sería
--  silenciosa: la pieza simplemente no aparecería en el calendario.
--
--  Cargar doce fechas es un minuto de trabajo. Perseguir por qué falta un
--  posteo en el calendario es una tarde.

alter table piezas
  add column publica_el date;

comment on column piezas.publica_el is
  'Cuándo sale publicada. Solo para entregas con vista de calendario; en las demás queda vacío.';

-- Las piezas de un mes, en orden. Es la consulta que arma el calendario.
create index on piezas (proyecto_id, publica_el) where publica_el is not null;


-- ============================================================================
--  Coherencia
-- ============================================================================
--
--  Una entrega de calendario sin fechas se vería como un mes vacío, y nadie
--  entendería por qué. Esto no se puede exigir con una restricción simple
--  —las fechas están en otra tabla— así que queda como comprobación al
--  momento de entregar, del lado de la aplicación.
--
--  Se anota acá para que quede junto a las columnas que lo motivan.
