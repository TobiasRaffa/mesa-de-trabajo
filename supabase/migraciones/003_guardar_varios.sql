-- Guardar varios documentos de una sola vez, de verdad.
--
-- **El contrato del almacén promete que esto no se puede quedar a medias**, y
-- del lado de Supabase la promesa era falsa. `guardarVarios` existe porque hay
-- cambios que no tienen sentido partidos: guardar el calendario de doce piezas,
-- o poner un plazo arriba y dejar heredando a todo lo de abajo. En el almacén
-- de archivos es una sola escritura, así que se cumple sola. Acá eran **dos
-- pedidos HTTP** —un DELETE y después un POST—, y un corte en el medio dejaba
-- la mitad hecha: las carpetas sin su plazo propio *y* el cliente sin el nuevo,
-- o sea todo heredando de la nada.
--
-- Una función de Postgres corre entera o no corre: adentro de una función hay
-- una transacción, y si algo falla se deshace lo anterior. Es la misma garantía
-- que da renombrar un archivo encima de otro, que es lo que hace la otra
-- implementación.
--
-- `cambios` llega como un objeto de `id` a documento, y un `null` borra —la
-- misma forma que tiene el contrato del lado del código.

create or replace function guardar_varios(
  la_coleccion text,
  cambios jsonb
)
returns void
language plpgsql
as $$
declare
  a_borrar text[];
begin
  -- Lo que viene en `null` se va. Se junta primero para hacer un solo borrado.
  select coalesce(array_agg(clave), '{}')
    into a_borrar
    from jsonb_each(cambios) as pares(clave, valor)
   where jsonb_typeof(valor) = 'null';

  if array_length(a_borrar, 1) is not null then
    delete from documentos
     where coleccion = la_coleccion
       and id = any(a_borrar);
  end if;

  -- Y el resto se escribe encima de lo que hubiera.
  insert into documentos (coleccion, id, datos)
  select la_coleccion, clave, valor
    from jsonb_each(cambios) as pares(clave, valor)
   where jsonb_typeof(valor) <> 'null'
      on conflict (coleccion, id) do update
         set datos = excluded.datos;
end;
$$;

-- Igual que la tabla: solo el servidor.
revoke all on function guardar_varios(text, jsonb) from public;
revoke all on function guardar_varios(text, jsonb) from anon;
revoke all on function guardar_varios(text, jsonb) from authenticated;
grant execute on function guardar_varios(text, jsonb) to service_role;
