-- =====================================================================
--  Datos iniciales · Boda Freddy & Priscila
--  GENERADO AUTOMÁTICAMENTE desde js/data/seed.js (npm run seed)
--  Ejecutar DESPUÉS de schema.sql. Es seguro volver a ejecutarlo.
-- =====================================================================

-- Correos autorizados (agrega aquí el de Priscila y los ayudantes)
insert into public.allowed_emails (email, role, display_name) values
  ('freddypeco1024@gmail.com', 'admin', 'Freddy')
  -- , ('correo_de_prisci@gmail.com', 'admin', 'Priscila')
on conflict (email) do nothing;

-- Datos de la boda
insert into public.wedding (id, couple_names, groom_name, bride_name, wedding_date, time_confirmed, city, kingdom_hall, kingdom_hall_address, reception_venue, reception_address, civil_date, civil_place, speaker, banquet_director, guest_target, budget_target, dress_colors, notes) values
  (1, 'Freddy & Priscila', 'Freddy Peñafiel', 'Priscila Dumancela', '2027-02-26T15:00:00-05:00', false, 'Azogues, Cañar', null, null, null, null, null, null, null, null, 100, 4400, 'Verde salvia y beige', null)
on conflict (id) do nothing;

-- Principios bíblicos
insert into public.principles (id, sort, title, scripture, scripture_url, summary, category) values
  (1, 1, 'Jehová es el Creador del matrimonio', 'Gén. 2:24', 'https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/G%C3%A9nesis/2/#v1002024', 'Él casó a Adán y Eva. Para los novios, el punto de vista de Dios debe ser lo más importante al organizar la boda.', 'espiritual'),
  (2, 2, 'Honrar a nuestro Padre y mejor Amigo', 'Sal. 116:12', 'https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/salmos/116/#v19116012', 'Protejamos nuestra amistad con Jehová y evitemos que algo de ese día lo hiera u ofenda (Sal. 25:14).', 'espiritual'),
  (3, 3, 'Cumplir con los requisitos legales', 'Rom. 13:1, 2', 'https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/romanos/13/#v45013001-v45013002', 'Respetamos las leyes locales sobre el matrimonio: trámites del Registro Civil, documentos y testigos (Mat. 22:21).', 'legal'),
  (4, 4, 'Oración y buena comunicación', 'Filip. 4:6, 7', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Filipenses%204%3A6%2C%207', 'Orar juntos antes de cada decisión y hablar con respeto, tomando decisiones de común acuerdo (Prov. 15:22).', 'espiritual'),
  (5, 5, 'Sencillez y presupuesto sin deudas', '1 Juan 2:15-17', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=1%20Juan%202%3A15-17', 'Una boda bonita no tiene que ser ostentosa. Evitar competir con otros o endeudarse protege el servicio a Dios.', 'presupuesto'),
  (6, 6, 'Vestimenta modesta y digna', '1 Tim. 2:9', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=1%20Timoteo%202%3A9', 'Lucir elegantes pero con ropa decente y apropiada, que no atraiga atención indebida (1 Ped. 3:3, 4).', 'vestimenta'),
  (7, 7, 'Rechazar costumbres contrarias a la Biblia', '2 Cor. 6:14-17', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=2%20Corintios%206%3A14-17', 'Investigar el origen de cada costumbre. No arrojar arroz o confeti ni lanzar el ramo o la liga.', 'espiritual'),
  (8, 8, 'Un Director del Banquete maduro', 'Juan 2:8', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Juan%202%3A8', 'Un hermano espiritual de confianza supervisa el programa para que todo se haga según lo planeado.', 'equipo'),
  (9, 9, 'Moderación con el alcohol', 'Rom. 13:13', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Romanos%2013%3A13', 'Si se sirve alcohol, tomar medidas previas para que nadie beba de más y no haya fiestas descontroladas.', 'recepcion'),
  (10, 10, 'Música y entretenimiento edificantes', 'Filip. 4:8', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Filipenses%204%3A8', 'Revisar letras y videos. Volumen que permita conversar. Palabras limpias, sin bromas de mal gusto (Efes. 5:3).', 'musica'),
  (11, 11, 'Bondad con familiares no Testigos', 'Col. 4:6', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Colosenses%204%3A6', 'Explicarles con tacto cómo son nuestras bodas y complacerlos en lo que no viole principios bíblicos.', 'invitados'),
  (12, 12, 'Previsión con los invitados', 'Prov. 22:3', 'https://wol.jw.org/es/wol/s/r4/lp-s?q=Proverbios%2022%3A3', 'Definir con claridad la lista de invitados para evitar aglomeraciones y personas no invitadas.', 'invitados'),
  (13, 13, 'Todo de forma digna y ordenada', '1 Cor. 14:40', 'https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/1-corintios/14/#v46014040', 'Ensayar, respetar el horario y coordinar con tiempo a todos los colaboradores.', 'equipo')
on conflict (id) do update set sort = excluded.sort, title = excluded.title, scripture = excluded.scripture,
  scripture_url = excluded.scripture_url, summary = excluded.summary, category = excluded.category;

-- Grupos de invitados
insert into public.guest_groups (id, name, color) values
  (1, 'Familia de Freddy', '#4A6B53'),
  (2, 'Familia de Priscila', '#B6863A'),
  (3, 'Congregación', '#688B70'),
  (4, 'Amigos', '#8B5E3C')
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.guest_groups', 'id'), greatest((select max(id) from public.guest_groups), 1));

-- Tareas (solo si la tabla está vacía)
do $$ begin
  if not exists (select 1 from public.tasks) then
    insert into public.tasks (title, description, stage, category, principle_id, assignee, due_date, status, sort) values
      ('Orar juntos antes de cada decisión importante', 'Pedir a Jehová sabiduría, calma y paz familiar en cada paso.', 's1', 'espiritual', 4, null, '2026-11-18', 'pendiente', 1),
      ('Leer juntos el artículo “Cómo planear una boda que honre a Jehová”', 'La Atalaya, estudio de diciembre de 2025. Es la base de toda la organización.', 's1', 'espiritual', 1, null, '2026-11-18', 'pendiente', 2),
      ('Fijar la fecha: viernes 26 de febrero de 2027', 'Fecha confirmada por los novios.', 's1', 'salon', 13, null, '2026-11-18', 'hecho', 3),
      ('Definir el presupuesto total sin deudas', 'Acordar un monto realista e incluir un 10 % para imprevistos.', 's1', 'presupuesto', 5, null, '2026-11-18', 'pendiente', 4),
      ('Conversar con los padres sobre los planes', 'Escuchar sus ideas con cariño y explicar las decisiones con bondad.', 's1', 'invitados', 11, null, '2026-11-18', 'pendiente', 5),
      ('Enviar la carta a los ancianos solicitando el Salón del Reino', 'Hacerlo con suficiente antelación y por escrito.', 's2', 'salon', 2, null, '2026-12-18', 'pendiente', 6),
      ('Pedir a un anciano que presente el discurso de boda', 'Confirmar fecha y hora con el orador.', 's2', 'salon', 1, null, '2026-12-18', 'pendiente', 7),
      ('Averiguar requisitos y agendar turno en el Registro Civil de Azogues', 'Revisar fechas disponibles, tasas y si será en la sede o en otro lugar.', 's2', 'legal', 3, null, '2026-12-18', 'pendiente', 8),
      ('Reunir los documentos para el matrimonio civil', 'Cédulas vigentes, certificados y demás requisitos.', 's2', 'legal', 3, null, '2026-12-18', 'pendiente', 9),
      ('Elegir a los 2 testigos legales', 'Mayores de edad y con documentos en regla.', 's2', 'legal', 3, null, '2026-12-18', 'pendiente', 10),
      ('Reservar el local de recepción para 100 invitados', 'Revisar capacidad, parqueadero, baños, acústica y clima.', 's2', 'recepcion', 12, null, '2026-12-18', 'pendiente', 11),
      ('Elegir al Director del Banquete', 'Un hermano maduro y de confianza.', 's2', 'equipo', 8, null, '2026-12-18', 'pendiente', 12),
      ('Confirmar las parejas de damas y caballeros', 'Nancy y Manuel, Nuria y Darío, Lady e Isaac, Diana y Kevin.', 's2', 'equipo', 13, null, '2026-12-18', 'hecho', 13),
      ('Definir el código de vestimenta: verde salvia y beige', 'Damas con vestido verde salvia; caballeros con camisa blanca, fajín y corbatín verde salvia y pantalón beige.', 's2', 'vestimenta', 6, null, '2026-12-18', 'hecho', 14),
      ('Elegir las canciones del mix de baile (~8 min)', 'Rock Around The Clock, Tu cariñito, Bailando bachata y Te voy a amar.', 's2', 'musica', 10, null, '2026-12-18', 'hecho', 15),
      ('Hacer la lista preliminar de 100 invitados', 'Agrupar por familia de Freddy, familia de Priscila, congregación y amigos.', 's2', 'invitados', 12, null, '2026-12-18', 'pendiente', 16),
      ('Cotizar el banquete para 100 platos', 'Pedir al menos 3 cotizaciones.', 's2', 'proveedores', 5, null, '2026-12-18', 'pendiente', 17),
      ('Conseguir el vestido de la novia y el traje verde salvia del novio', 'Elegantes, modestos y dentro del presupuesto.', 's3', 'vestimenta', 6, null, '2027-01-17', 'pendiente', 18),
      ('Contratar fotografía y video', 'Recordar las pautas de respeto en el Salón del Reino.', 's3', 'proveedores', 13, null, '2027-01-17', 'pendiente', 19),
      ('Coordinar el sonido y la lista musical aprobada', 'Revisar letras y descargar la música para usarla sin internet.', 's3', 'musica', 10, null, '2027-01-17', 'pendiente', 20),
      ('Elegir los cánticos del Reino para la ceremonia', null, 's3', 'musica', 1, null, '2027-01-17', 'pendiente', 21),
      ('Enviar las invitaciones y pedir confirmación', 'Con fecha límite para confirmar.', 's3', 'invitados', 12, null, '2027-01-17', 'pendiente', 22),
      ('Encargar la torta y el postre', null, 's3', 'proveedores', 5, null, '2027-01-17', 'pendiente', 23),
      ('Primer ensayo del baile en casa de Prisci', 'Viernes o sábado, según les convenga a todos.', 's3', 'equipo', 13, null, '2027-01-17', 'pendiente', 24),
      ('Explicar con bondad a familiares no Testigos cómo será la boda', 'Se les puede mostrar información de jw.org.', 's3', 'invitados', 11, null, '2027-01-17', 'pendiente', 25),
      ('Cerrar la lista de confirmados y armar el plano de mesas', '10 a 12 mesas más la mesa principal.', 's4', 'invitados', 12, null, '2027-02-08', 'pendiente', 26),
      ('Revisar el programa de la recepción con el Director del Banquete', 'Horarios, palabras, video y cierre puntual.', 's4', 'equipo', 8, null, '2027-02-08', 'pendiente', 27),
      ('Definir las medidas sobre las bebidas alcohólicas', 'Cantidad, quién sirve y supervisión.', 's4', 'recepcion', 9, null, '2027-02-08', 'pendiente', 28),
      ('Revisar palabras, videos y entretenimiento', 'Que todo sea limpio y edificante.', 's4', 'musica', 10, null, '2027-02-08', 'pendiente', 29),
      ('Comprar los anillos', null, 's4', 'vestimenta', 5, null, '2027-02-08', 'pendiente', 30),
      ('Pagar los saldos pendientes a los proveedores', null, 's4', 'presupuesto', 5, null, '2027-02-08', 'pendiente', 31),
      ('Ensayo general con damas, caballeros y colaboradores', 'Entrada, ubicación y salida.', 's5', 'equipo', 13, null, '2027-02-22', 'pendiente', 32),
      ('Confirmar horarios con todos los proveedores', null, 's5', 'proveedores', 13, null, '2027-02-22', 'pendiente', 33),
      ('Entregar la lista de invitados y el plano a los acomodadores', null, 's5', 'invitados', 12, null, '2027-02-22', 'pendiente', 34),
      ('Preparar documentos y anillos para el Registro Civil', null, 's5', 'legal', 3, null, '2027-02-22', 'pendiente', 35),
      ('Damas y caballeros listos en el Salón 1 hora antes', 'Ya cambiados y listos.', 's6', 'equipo', 13, null, '2027-02-26', 'pendiente', 36),
      ('Discurso de boda en el Salón del Reino', 'Reverencia durante el discurso y las oraciones.', 's6', 'salon', 1, null, '2027-02-26', 'pendiente', 37),
      ('Fotos oficiales y traslado ordenado al local', null, 's6', 'equipo', 13, null, '2027-02-26', 'pendiente', 38),
      ('Recepción y cierre puntual con agradecimiento', 'Sin extenderse hasta altas horas.', 's6', 'recepcion', 13, null, '2027-02-26', 'pendiente', 39);
  end if;
end $$;

-- Equipo (solo si está vacío)
do $$ begin
  if not exists (select 1 from public.team_roles) then
    insert into public.team_roles (role, person, partner, notes, sort) values
      ('Damas y caballeros', 'Manuel', 'Nancy', 'Pareja 1', 1),
      ('Damas y caballeros', 'Darío', 'Nuria', 'Pareja 2', 2),
      ('Damas y caballeros', 'Isaac', 'Lady', 'Pareja 3', 3),
      ('Damas y caballeros', 'Kevin', 'Diana', 'Pareja 4', 4),
      ('Director del Banquete', null, null, 'Hermano maduro (Juan 2:8)', 5),
      ('Orador del discurso', null, null, 'Anciano de congregación', 6),
      ('Audio y música', null, null, '', 7),
      ('Fotografía y video', null, null, '', 8),
      ('Acomodadores', null, null, 'Recepción de los 100 invitados', 9);
  end if;
end $$;

-- Canciones (solo si está vacío)
do $$ begin
  if not exists (select 1 from public.songs) then
    insert into public.songs (title, artist, url, purpose, sort) values
      ('Rock Around The Clock', 'Bill Haley & His Comets', 'https://youtu.be/6HZRldnM-Cs', 'Mix de baile', 1),
      ('Tu cariñito (salsa bailable)', 'DJ Papu GT Música Mix', 'https://youtu.be/MCg2a3wG-dg', 'Mix de baile', 2),
      ('Bailando bachata', 'Chayanne', 'https://youtu.be/dsLjyLn859g', 'Mix de baile', 3),
      ('Te voy a amar', 'Axel', 'https://youtu.be/KZh60U1PqSE', 'Mix de baile', 4);
  end if;
end $$;

-- Mesas base para 100 invitados (solo si está vacío)
do $$ begin
  if not exists (select 1 from public.seating_tables) then
    insert into public.seating_tables (name, capacity, sort) values
      ('Mesa Principal (Novios y Padres)', 8, 1),
      ('Mesa 1', 10, 2),
      ('Mesa 2', 10, 3),
      ('Mesa 3', 10, 4),
      ('Mesa 4', 10, 5),
      ('Mesa 5', 10, 6),
      ('Mesa 6', 10, 7),
      ('Mesa 7', 10, 8),
      ('Mesa 8', 10, 9),
      ('Mesa 9', 10, 10),
      ('Mesa 10', 10, 11);
  end if;
end $$;

-- Rubros base del presupuesto (solo si está vacío)
do $$ begin
  if not exists (select 1 from public.budget_items) then
    insert into public.budget_items (category, concept, estimated, actual, notes) values
      ('recepcion', 'Banquete (100 platos + bebidas sin alcohol)', 1800, null, 'Plato servido a la mesa'),
      ('recepcion', 'Alquiler de local y mobiliario', 700, null, 'Mesas, sillas vestidas y mantelería'),
      ('legal', 'Registro Civil (tasas y trámites)', 100, null, 'Registro Civil de Azogues'),
      ('proveedores', 'Torta y postre para 100 invitados', 250, null, ''),
      ('musica', 'Fotografía, video y equipo de sonido', 550, null, 'Micrófonos y cobertura'),
      ('vestimenta', 'Vestido de novia y traje verde salvia', 600, null, 'Modestos y dentro del presupuesto'),
      ('presupuesto', 'Fondo para imprevistos (10 %)', 400, null, 'Reserva de seguridad (cero deudas)');
  end if;
end $$;
