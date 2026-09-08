-- ============================================================================
--  Mesa de trabajo — estructura
-- ============================================================================
--
--  Trece tablas. Las decisiones que hay detrás están en DECISIONES.md; acá
--  quedan solo las que se explican mejor al lado de la columna que las
--  encarna.
--
--  Dos reglas que atraviesan todo el archivo:
--
--    1. Nada se borra. Lo que se cae se marca como cancelado y conserva su
--       historia. Por eso casi no hay borrados en cascada sobre cosas que
--       llevan registro, y sí `on delete restrict` donde borrar sería perder.
--
--    2. Lo que se pueda hacer cumplir en la base, se hace cumplir en la base.
--       Una restricción vale más que un comentario pidiendo que alguien se
--       acuerde.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;


-- ============================================================================
--  Equipo de la agencia
-- ============================================================================

create type rol_equipo as enum (
  'admin',    -- puede todo: plazos, rondas extra, reabrir, cobranza
  'equipo',   -- arma entregas y trabaja los proyectos que tiene asignados
  'externo'   -- colaborador: solo los proyectos que se le asignaron
);

create table perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  rol         rol_equipo not null default 'equipo',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

comment on table perfiles is
  'El equipo. Cuelga de auth.users: la contraseña la maneja Supabase, acá va quién es y qué puede.';


-- ============================================================================
--  Clientes
-- ============================================================================

create table clientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null check (length(trim(nombre)) > 0),

  -- El tag es la clave que el cliente escribe después de abrir el link.
  -- Se guarda cifrado con bcrypt, como cualquier contraseña: si algún día
  -- alguien lee la base, no se lleva las claves de todos los clientes.
  -- Es lento a propósito, y eso está bien: se comprueba una vez por sesión.
  tag_hash              text not null,

  -- La carpeta madre en Drive. Adentro, cada subcarpeta es un proyecto.
  drive_folder_id       text not null,

  -- Configuración por cliente. Los valores por defecto son propuestas, no
  -- verdades: se cambian desde el panel sin tocar el programa.
  dias_revision         int not null default 4 check (dias_revision between 1 and 90),
  recordatorio_cliente  boolean not null default false,
  canal_aviso           text not null default 'mail'
                          check (canal_aviso in ('mail', 'whatsapp', 'ambos')),

  activo                boolean not null default true,
  creado_en             timestamptz not null default now()
);

comment on column clientes.dias_revision is
  'Días corridos. El aviso sale a la mitad; que venza no aprueba nada.';


-- ============================================================================
--  Proyectos
-- ============================================================================

create type estado_proyecto as enum ('activo', 'cerrado', 'cancelado');

create table proyectos (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references clientes on delete restrict,
  nombre            text not null check (length(trim(nombre)) > 0),
  drive_folder_id   text not null,
  rondas_incluidas  int not null default 2 check (rondas_incluidas >= 0),
  estado            estado_proyecto not null default 'activo',
  creado_en         timestamptz not null default now(),

  -- Necesaria para que un link pueda referenciar proyecto y cliente a la vez
  -- y que la base garantice que coinciden. Ver la tabla `links`.
  unique (id, cliente_id)
);

create index on proyectos (cliente_id) where estado = 'activo';

comment on column proyectos.rondas_incluidas is
  'Se cuentan por pieza, no por entrega: un ajuste en un posteo no consume la ronda de los otros once.';


-- Colaboradores externos: ven solo los proyectos que se les asignaron.
create table asignaciones (
  perfil_id    uuid not null references perfiles on delete cascade,
  proyecto_id  uuid not null references proyectos on delete cascade,
  creado_en    timestamptz not null default now(),
  primary key (perfil_id, proyecto_id)
);


-- ============================================================================
--  Links de acceso del cliente
-- ============================================================================

create table links (
  id                uuid primary key default gen_random_uuid(),

  -- Del token solo se guarda su huella. Si la base se filtra, nadie se lleva
  -- links usables. Se usa sha256 y no bcrypt porque el token tiene 128 bits de
  -- azar: no hace falta un cifrado lento, y sí una búsqueda rápida.
  token_hash        text not null unique,

  cliente_id        uuid not null,

  -- Vacío significa "todos los proyectos de este cliente".
  proyecto_id       uuid,

  creado_por        uuid references perfiles on delete set null,
  creado_en         timestamptz not null default now(),
  activo            boolean not null default true,

  -- El tag es corto y humano, así que se puede adivinar probando. Cinco
  -- intentos y el link se bloquea un rato; a la agencia le llega un aviso.
  intentos_fallidos int not null default 0 check (intentos_fallidos >= 0),
  bloqueado_hasta   timestamptz,
  ultimo_uso_en     timestamptz,

  foreign key (cliente_id) references clientes on delete cascade,

  -- La garantía que importa: si el link apunta a un proyecto, ese proyecto
  -- tiene que ser de ese cliente. No es un comentario pidiendo cuidado; la
  -- base rechaza la fila. Con proyecto_id vacío la restricción no aplica.
  foreign key (proyecto_id, cliente_id) references proyectos (id, cliente_id)
);

create index on links (cliente_id);

comment on table links is
  'Cada vez que alguien aprieta Compartir nace uno. Se revocan de a uno sin tocar los demás.';


-- ============================================================================
--  Entregas — lo que viaja junto y lleva el plazo
-- ============================================================================

create table entregas (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyectos on delete cascade,
  numero       int not null check (numero > 0),

  plazo_dias   int not null check (plazo_dias between 1 and 90),
  enviada_en   timestamptz,
  vence_en     timestamptz,

  -- Cuándo el cliente cerró la ronda. Hasta entonces, los pedidos de cambio
  -- no llegan a la agencia.
  cerrada_en   timestamptz,

  creado_en    timestamptz not null default now(),

  unique (proyecto_id, numero),

  -- Una entrega sin enviar no puede tener vencimiento ni estar cerrada.
  check (enviada_en is not null or (vence_en is null and cerrada_en is null))
);

create index on entregas (proyecto_id);
-- Las que están esperando al cliente: es la consulta del tablero.
create index on entregas (vence_en) where enviada_en is not null and cerrada_en is null;


-- ============================================================================
--  Piezas — la unidad de estado real
-- ============================================================================

create type estado_pieza as enum (
  'en_curso',          -- la agencia la trabaja; el cliente no la ve
  'entregada',         -- corre el plazo; el cliente todavía no la abrió
  'en_revision',       -- el cliente la abrió y no decidió
  'cambios_marcados',  -- pidió cambios; no llegan hasta cerrar la ronda
  'extra_pedida',      -- se agotaron las rondas; espera a una administradora
  'final',             -- aprobada y bloqueada
  'cancelada'
);

create table piezas (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references proyectos on delete cascade,
  nombre          text not null check (length(trim(nombre)) > 0),
  orden           int not null default 0,

  estado          estado_pieza not null default 'en_curso',
  ronda           int not null default 0 check (ronda >= 0),
  rondas_extra    int not null default 0 check (rondas_extra >= 0),

  responsable_id  uuid references perfiles on delete set null,

  -- Solo se llena al aprobar. Es el registro que sirve para discutir alcances.
  aprobada_en     timestamptz,

  creado_en       timestamptz not null default now(),

  -- Aprobada quiere decir aprobada: no hay 'final' sin fecha ni fecha sin final.
  check ((estado = 'final') = (aprobada_en is not null))
);

create index on piezas (proyecto_id, orden);
create index on piezas (responsable_id) where estado not in ('final', 'cancelada');


-- ============================================================================
--  Versiones — la pieza en una vuelta concreta
-- ============================================================================

create table versiones (
  id             uuid primary key default gen_random_uuid(),
  pieza_id       uuid not null references piezas on delete cascade,
  entrega_id     uuid references entregas on delete set null,
  numero         int not null check (numero > 0),

  -- El archivo vive en Drive. Acá solo su identificador: el portal no guarda
  -- archivos, y la miniatura se pide al vuelo porque caduca en horas.
  drive_file_id  text not null,

  creado_en      timestamptz not null default now(),

  unique (pieza_id, numero)
);

create index on versiones (entrega_id);


-- ============================================================================
--  Lo que dijeron las personas
-- ============================================================================

create type autor_tipo as enum ('equipo', 'cliente');

create table comentarios (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references versiones on delete cascade,

  autor             autor_tipo not null,
  autor_perfil_id   uuid references perfiles on delete set null,
  -- Del lado del cliente entran todos con el mismo tag, así que el nombre es
  -- el que la persona escribió, si lo escribió. Nadie lo verifica, y está
  -- bien: de quién escribe se hace cargo el cliente.
  autor_nombre      text,

  texto             text not null check (length(trim(texto)) > 0),
  creado_en         timestamptz not null default now(),

  -- Un comentario del equipo tiene perfil; uno del cliente, no.
  check ((autor = 'equipo') = (autor_perfil_id is not null))
);

create index on comentarios (version_id, creado_en);


create type tipo_decision as enum ('aprobada', 'cambios');

-- El registro de aprobaciones. Nunca se modifica ni se borra: solo se agrega.
-- Es lo que sirve cuando hay que demostrar qué se aprobó y cuándo.
create table decisiones (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references versiones on delete restrict,
  decision     tipo_decision not null,

  -- Con qué link se tomó. Aunque no haya nombre, queda de qué cliente vino.
  link_id      uuid references links on delete set null,
  quien        text,

  creado_en    timestamptz not null default now()
);

create index on decisiones (version_id);


-- ============================================================================
--  Revisiones adicionales — el tope de rondas
-- ============================================================================

create table revisiones_extra (
  id               uuid primary key default gen_random_uuid(),
  pieza_id         uuid not null references piezas on delete cascade,

  pedida_por       autor_tipo not null,
  pedida_en        timestamptz not null default now(),

  -- Vacío mientras espera. El sistema nunca habilita solo: un sistema que
  -- sumara rondas por su cuenta estaría regalando trabajo.
  habilitada_por   uuid references perfiles on delete set null,
  habilitada_en    timestamptz,

  -- Queda anotada como cobrable para que nadie se olvide al facturar. Cuánto
  -- se cobra lo negocia una persona, fuera del sistema.
  facturada        boolean not null default false,

  check ((habilitada_por is null) = (habilitada_en is null))
);

create index on revisiones_extra (pieza_id);
create index on revisiones_extra (facturada) where habilitada_en is not null;


-- ============================================================================
--  Facturas — el PDF vive en Drive, acá solo el estado
-- ============================================================================

create type estado_factura as enum ('pendiente', 'pagada', 'vencida');

create table facturas (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references clientes on delete restrict,

  -- El PDF se sube a la subcarpeta «Facturas» del cliente, como todo lo demás.
  drive_file_id  text not null,

  numero         text,
  monto          numeric(14, 2) check (monto is null or monto >= 0),
  moneda         text not null default 'ARS',
  vence_en       date,

  estado         estado_factura not null default 'pendiente',
  pagada_en      date,

  creado_en      timestamptz not null default now(),

  check ((estado = 'pagada') = (pagada_en is not null))
);

create index on facturas (cliente_id, estado);


-- ============================================================================
--  Registro y avisos
-- ============================================================================

-- Todo lo que pasa, en orden. Nada se borra: cancelar es un evento más.
-- Es lo que hace posible contestar "¿quién hizo esto y cuándo?" seis meses
-- después.
create table eventos (
  id               bigint generated always as identity primary key,
  tipo             text not null,
  entidad          text not null,
  entidad_id       uuid,
  actor_perfil_id  uuid references perfiles on delete set null,
  actor_link_id    uuid references links on delete set null,
  datos            jsonb not null default '{}'::jsonb,
  creado_en        timestamptz not null default now()
);

create index on eventos (entidad, entidad_id, creado_en desc);
create index on eventos (creado_en desc);


-- Qué avisos salieron. Sirve para no mandar dos veces lo mismo y para poder
-- revisar qué recibió el cliente cuando dice que no le llegó nada.
create table avisos (
  id             bigint generated always as identity primary key,
  tipo           text not null,
  destinatario   text not null,
  canal          text not null check (canal in ('mail', 'whatsapp')),
  entidad_id     uuid,
  enviado_en     timestamptz,
  error          text,
  creado_en      timestamptz not null default now()
);

create index on avisos (tipo, entidad_id);
