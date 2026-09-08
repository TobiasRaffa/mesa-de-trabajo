-- ============================================================================
--  Mesa de trabajo — reglas de acceso
-- ============================================================================
--
--  Quién ve qué, decidido por la base de datos y no por las pantallas.
--
--  Estas reglas gobiernan el lado de la agencia, donde cada persona entra con
--  su propia cuenta y la base sabe quién es. El portal del cliente no tiene
--  cuentas —entra con link y tag— así que su acceso lo resuelve el servidor,
--  con el filtro aplicado por construcción. Ver DECISIONES.md, punto 14.
--
--  Dos cosas que conviene tener presentes al leer:
--
--    · Sin política, no hay permiso. Activar RLS cierra la tabla; lo que no
--      se abre explícitamente queda cerrado. Es lo contrario de una lista
--      negra, y es por eso que olvidarse tiende a fallar del lado seguro.
--
--    · No hay una sola política de borrado en todo el archivo. No es un
--      olvido: es la forma de que «nada se borra» deje de ser una promesa.
--      Ni siquiera una administradora puede borrar una aprobación.
-- ============================================================================


-- ============================================================================
--  Quién es quien pregunta
-- ============================================================================
--
--  Se marcan `security definer` para que puedan leer `perfiles` sin que eso
--  requiera darle permiso de lectura sobre `perfiles` a todo el mundo. El
--  `search_path` fijo evita que alguien las engañe cambiando el suyo.

create or replace function rol_actual()
returns rol_equipo
language sql
stable
security definer
set search_path = public
as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(rol_actual() = 'admin', false)
$$;

create or replace function es_de_la_casa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(rol_actual() in ('admin', 'equipo'), false)
$$;

-- Un externo ve únicamente los proyectos que se le asignaron. El resto del
-- equipo ve todos. Esta función es la que usan casi todas las políticas de
-- abajo: cambiarla acá cambia el alcance en todo el sistema a la vez.
create or replace function ve_proyecto(p_proyecto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when es_de_la_casa() then true
    when rol_actual() = 'externo' then exists (
      select 1 from asignaciones
      where perfil_id = auth.uid() and proyecto_id = p_proyecto_id
    )
    else false
  end
$$;

comment on function ve_proyecto(uuid) is
  'El alcance de una persona sobre un proyecto. Un solo lugar para cambiarlo.';


-- ============================================================================
--  Cerrar todo
-- ============================================================================

alter table perfiles          enable row level security;
alter table clientes          enable row level security;
alter table proyectos         enable row level security;
alter table asignaciones      enable row level security;
alter table links             enable row level security;
alter table entregas          enable row level security;
alter table piezas            enable row level security;
alter table versiones         enable row level security;
alter table comentarios       enable row level security;
alter table decisiones        enable row level security;
alter table revisiones_extra  enable row level security;
alter table facturas          enable row level security;
alter table eventos           enable row level security;
alter table avisos            enable row level security;


-- ============================================================================
--  Equipo
-- ============================================================================

-- Cada uno se ve a sí mismo. Las administradoras ven a todos, porque son
-- quienes dan de alta y asignan roles.
create policy "verse a uno mismo o, si es admin, a todos"
  on perfiles for select
  using (id = auth.uid() or es_admin());

create policy "solo una admin da de alta gente"
  on perfiles for insert
  with check (es_admin());

create policy "solo una admin cambia roles"
  on perfiles for update
  using (es_admin())
  with check (es_admin());


-- ============================================================================
--  Clientes y proyectos
-- ============================================================================

-- Un externo no tiene por qué conocer la cartera de clientes: ve solo aquellos
-- para los que tiene un proyecto asignado.
create policy "clientes que a uno le corresponden"
  on clientes for select
  using (
    es_de_la_casa()
    or exists (
      select 1 from proyectos p
      join asignaciones a on a.proyecto_id = p.id
      where p.cliente_id = clientes.id and a.perfil_id = auth.uid()
    )
  );

create policy "el equipo da de alta clientes"
  on clientes for insert
  with check (es_de_la_casa());

-- El tag, los días de revisión y el canal de aviso son configuración: solo
-- las administradoras la tocan.
create policy "solo una admin cambia la configuración del cliente"
  on clientes for update
  using (es_admin())
  with check (es_admin());


create policy "proyectos que a uno le corresponden"
  on proyectos for select
  using (ve_proyecto(id));

create policy "el equipo crea proyectos"
  on proyectos for insert
  with check (es_de_la_casa());

create policy "el equipo trabaja sus proyectos"
  on proyectos for update
  using (ve_proyecto(id))
  with check (ve_proyecto(id));


create policy "asignaciones propias, o todas si es admin"
  on asignaciones for select
  using (perfil_id = auth.uid() or es_admin());

create policy "solo una admin asigna externos"
  on asignaciones for insert
  with check (es_admin());


-- ============================================================================
--  Links de acceso
-- ============================================================================
--
--  Del token solo hay huella, así que ni siquiera quien lea la tabla se lleva
--  links usables. Aun así se restringe: saber qué links existen y a qué
--  cliente pertenecen ya es información de más para un colaborador externo.

create policy "links de los proyectos de uno"
  on links for select
  using ((proyecto_id is null and es_de_la_casa()) or ve_proyecto(proyecto_id));

create policy "el equipo comparte lo que puede ver"
  on links for insert
  with check ((proyecto_id is null and es_de_la_casa()) or ve_proyecto(proyecto_id));

-- Revocar es una actualización, no un borrado: el link queda con su historia.
create policy "el equipo revoca los links que ve"
  on links for update
  using ((proyecto_id is null and es_de_la_casa()) or ve_proyecto(proyecto_id))
  with check ((proyecto_id is null and es_de_la_casa()) or ve_proyecto(proyecto_id));


-- ============================================================================
--  El trabajo
-- ============================================================================
--
--  Entregas, piezas y versiones siguen a su proyecto. Se escriben las tres
--  igual a propósito: la regla es siempre la misma y se lee de un vistazo.

create policy "entregas de los proyectos de uno"
  on entregas for select using (ve_proyecto(proyecto_id));
create policy "el equipo arma entregas"
  on entregas for insert with check (ve_proyecto(proyecto_id));
create policy "el equipo mueve sus entregas"
  on entregas for update using (ve_proyecto(proyecto_id)) with check (ve_proyecto(proyecto_id));


create policy "piezas de los proyectos de uno"
  on piezas for select using (ve_proyecto(proyecto_id));
create policy "el equipo crea piezas"
  on piezas for insert with check (ve_proyecto(proyecto_id));
create policy "el equipo mueve sus piezas"
  on piezas for update using (ve_proyecto(proyecto_id)) with check (ve_proyecto(proyecto_id));


create policy "versiones de los proyectos de uno"
  on versiones for select
  using (exists (select 1 from piezas where piezas.id = versiones.pieza_id and ve_proyecto(piezas.proyecto_id)));

create policy "el equipo sube versiones"
  on versiones for insert
  with check (exists (select 1 from piezas where piezas.id = versiones.pieza_id and ve_proyecto(piezas.proyecto_id)));


-- ============================================================================
--  Lo que dijeron las personas
-- ============================================================================

create policy "comentarios de los proyectos de uno"
  on comentarios for select
  using (exists (
    select 1 from versiones v join piezas p on p.id = v.pieza_id
    where v.id = comentarios.version_id and ve_proyecto(p.proyecto_id)
  ));

create policy "el equipo comenta con su propio nombre"
  on comentarios for insert
  with check (
    autor = 'equipo'
    and autor_perfil_id = auth.uid()
    and exists (
      select 1 from versiones v join piezas p on p.id = v.pieza_id
      where v.id = comentarios.version_id and ve_proyecto(p.proyecto_id)
    )
  );

comment on policy "el equipo comenta con su propio nombre" on comentarios is
  'Nadie puede dejar un comentario firmado por otra persona: el autor tiene que ser quien escribe.';


-- Las decisiones no se modifican jamás. Se leen y se agregan, nada más — y las
-- agrega el portal, no el equipo: aprobar es del cliente.
create policy "decisiones de los proyectos de uno"
  on decisiones for select
  using (exists (
    select 1 from versiones v join piezas p on p.id = v.pieza_id
    where v.id = decisiones.version_id and ve_proyecto(p.proyecto_id)
  ));


-- ============================================================================
--  Revisiones adicionales
-- ============================================================================

create policy "revisiones extra de los proyectos de uno"
  on revisiones_extra for select
  using (exists (select 1 from piezas where piezas.id = revisiones_extra.pieza_id and ve_proyecto(piezas.proyecto_id)));

-- Habilitar una revisión adicional cuesta plata: es de las administradoras.
create policy "solo una admin habilita una revisión adicional"
  on revisiones_extra for update
  using (es_admin())
  with check (es_admin());


-- ============================================================================
--  Plata
-- ============================================================================
--
--  Ni el equipo ni los externos ven facturas. Es la única parte del sistema
--  donde el rol decide y no el proyecto.

create policy "solo una admin ve la cobranza"
  on facturas for select using (es_admin());
create policy "solo una admin carga facturas"
  on facturas for insert with check (es_admin());
create policy "solo una admin marca una factura pagada"
  on facturas for update using (es_admin()) with check (es_admin());


-- ============================================================================
--  Registro
-- ============================================================================
--
--  Los eventos se leen pero no se tocan: no hay política de actualización ni
--  de borrado, así que ni siquiera una administradora puede reescribir la
--  historia. Es lo que hace que el registro sirva para algo.

-- Los externos no leen el registro. No lo necesitan para trabajar, y darselo
-- abriria la pregunta de que ven de proyectos que no son suyos. Menos
-- preguntas, menos superficie.
create policy "el registro, sin la parte de plata"
  on eventos for select
  using (es_admin() or (es_de_la_casa() and entidad <> 'factura'));

create policy "solo una admin revisa los avisos que salieron"
  on avisos for select using (es_admin());


-- ============================================================================
--  Lo que ninguna política permite
-- ============================================================================
--
--  Con RLS activo, lo que no se abre queda cerrado. Repasando lo que quedó
--  deliberadamente afuera:
--
--    · Borrar. Nada, en ninguna tabla, para nadie. Un proyecto que se cae
--      pasa a «cancelado» y conserva su historia; un link que ya no sirve se
--      desactiva. Perder un proyecto viejo por limpiar la pantalla sería el
--      peor negocio posible.
--
--    · Modificar una decisión o un evento. El registro de qué se aprobó y
--      cuándo no se retoca: es lo que sirve cuando hay que discutir un
--      alcance.
--
--    · Que un externo vea clientes, links o proyectos que no le asignaron.
--
--    · Que alguien que no sea administradora vea una sola factura.
-- ============================================================================
