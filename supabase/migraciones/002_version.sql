-- El número de versión de cada documento.
--
-- **Es lo que impide que dos personas se pisen.** Casi todo lo que la
-- aplicación guarda se calcula a partir de lo que ya había: se lee el hilo de
-- una conversación, se le agrega un mensaje, se vuelve a escribir. Si entre lo
-- que se lee y lo que se escribe alguien más guardó, lo suyo desaparece: sin
-- error, sin aviso y sin rastro. Pasó con el chat, y lo que se perdía era un
-- mensaje que alguien había escrito.
--
-- En la computadora eso se resuelve haciendo cola —corre un proceso solo—. En
-- internet no hay cola posible: cada pedido puede caer en otra máquina. Lo que
-- sí hay es esto: cada fila lleva en qué versión está, se lee con su número, y
-- se escribe **solo si sigue en ese número**. Quien llega segundo no escribe:
-- vuelve a leer y rehace su cambio sobre lo nuevo.
--
-- Se puede ejecutar sobre una base que ya tiene datos: las filas que había
-- arrancan en 1.

alter table documentos
  add column if not exists version integer not null default 1;

-- **La versión la sube la base, no la aplicación.** Si la mandara el código,
-- alcanzaría con olvidarse una vez —una función nueva, un camino que nadie
-- repasó— para que dos escrituras quedaran con el mismo número y la guarda las
-- dejara pasar a las dos. Acá no hay forma de olvidarse.
create or replace function marcar_modificado()
returns trigger
language plpgsql
as $$
begin
  new.modificado = now();
  new.version = old.version + 1;
  return new;
end;
$$;
