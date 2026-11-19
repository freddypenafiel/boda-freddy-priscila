// Datos base de la boda de Freddy & Priscila.
// Este archivo es la ÚNICA fuente de los datos iniciales:
//  - el modo demo (localStorage) los usa directamente
//  - `npm run seed` genera supabase/seed.sql a partir de aquí
// No usa APIs del navegador para poder ejecutarse también en Node.

export const ARTICLE_URL =
  'https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-diciembre-2025/C%C3%B3mo-planear-una-boda-que-honre-a-Jehov%C3%A1/';

export const WEDDING_DATE_ISO = '2027-02-26T15:00:00-05:00';

/** Enlace de búsqueda en wol.jw.org para cualquier cita bíblica. */
export const wol = (ref) => `https://wol.jw.org/es/wol/s/r4/lp-s?q=${encodeURIComponent(ref)}`;

const BIBLE = 'https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/';

/** Etapas del checklist (contadas hacia atrás desde la boda). */
export const STAGES = [
  { key: 's1', label: 'Lo primero', hint: 'Fundamento espiritual y decisiones base', daysBefore: 100 },
  { key: 's2', label: '3 meses antes', hint: 'Noviembre y diciembre de 2026', daysBefore: 70 },
  { key: 's3', label: '2 meses antes', hint: 'Enero de 2027', daysBefore: 40 },
  { key: 's4', label: '1 mes antes', hint: 'Primeras semanas de febrero', daysBefore: 18 },
  { key: 's5', label: 'Semana de la boda', hint: 'Del 19 al 25 de febrero', daysBefore: 4 },
  { key: 's6', label: 'El gran día', hint: 'Viernes 26 de febrero de 2027', daysBefore: 0 },
];

export const CATEGORIES = {
  espiritual: { label: 'Espiritual', emoji: '🕊️' },
  legal: { label: 'Legal / Civil', emoji: '📜' },
  salon: { label: 'Salón del Reino', emoji: '🏛️' },
  recepcion: { label: 'Recepción', emoji: '🍽️' },
  invitados: { label: 'Invitados', emoji: '👥' },
  vestimenta: { label: 'Vestimenta', emoji: '👗' },
  equipo: { label: 'Equipo', emoji: '🤝' },
  presupuesto: { label: 'Presupuesto', emoji: '💰' },
  musica: { label: 'Música y audio', emoji: '🎶' },
  proveedores: { label: 'Proveedores', emoji: '📦' },
};

/** Principios del artículo de La Atalaya (diciembre 2025). */
export const PRINCIPLES = [
  { id: 1, title: 'Jehová es el Creador del matrimonio', scripture: 'Gén. 2:24', scripture_url: `${BIBLE}G%C3%A9nesis/2/#v1002024`, category: 'espiritual',
    summary: 'Él casó a Adán y Eva. Para los novios, el punto de vista de Dios debe ser lo más importante al organizar la boda.' },
  { id: 2, title: 'Honrar a nuestro Padre y mejor Amigo', scripture: 'Sal. 116:12', scripture_url: `${BIBLE}salmos/116/#v19116012`, category: 'espiritual',
    summary: 'Protejamos nuestra amistad con Jehová y evitemos que algo de ese día lo hiera u ofenda (Sal. 25:14).' },
  { id: 3, title: 'Cumplir con los requisitos legales', scripture: 'Rom. 13:1, 2', scripture_url: `${BIBLE}romanos/13/#v45013001-v45013002`, category: 'legal',
    summary: 'Respetamos las leyes locales sobre el matrimonio: trámites del Registro Civil, documentos y testigos (Mat. 22:21).' },
  { id: 4, title: 'Oración y buena comunicación', scripture: 'Filip. 4:6, 7', scripture_url: wol('Filipenses 4:6, 7'), category: 'espiritual',
    summary: 'Orar juntos antes de cada decisión y hablar con respeto, tomando decisiones de común acuerdo (Prov. 15:22).' },
  { id: 5, title: 'Sencillez y presupuesto sin deudas', scripture: '1 Juan 2:15-17', scripture_url: wol('1 Juan 2:15-17'), category: 'presupuesto',
    summary: 'Una boda bonita no tiene que ser ostentosa. Evitar competir con otros o endeudarse protege el servicio a Dios.' },
  { id: 6, title: 'Vestimenta modesta y digna', scripture: '1 Tim. 2:9', scripture_url: wol('1 Timoteo 2:9'), category: 'vestimenta',
    summary: 'Lucir elegantes pero con ropa decente y apropiada, que no atraiga atención indebida (1 Ped. 3:3, 4).' },
  { id: 7, title: 'Rechazar costumbres contrarias a la Biblia', scripture: '2 Cor. 6:14-17', scripture_url: wol('2 Corintios 6:14-17'), category: 'espiritual',
    summary: 'Investigar el origen de cada costumbre. No arrojar arroz o confeti ni lanzar el ramo o la liga.' },
  { id: 8, title: 'Un Director del Banquete maduro', scripture: 'Juan 2:8', scripture_url: wol('Juan 2:8'), category: 'equipo',
    summary: 'Un hermano espiritual de confianza supervisa el programa para que todo se haga según lo planeado.' },
  { id: 9, title: 'Moderación con el alcohol', scripture: 'Rom. 13:13', scripture_url: wol('Romanos 13:13'), category: 'recepcion',
    summary: 'Si se sirve alcohol, tomar medidas previas para que nadie beba de más y no haya fiestas descontroladas.' },
  { id: 10, title: 'Música y entretenimiento edificantes', scripture: 'Filip. 4:8', scripture_url: wol('Filipenses 4:8'), category: 'musica',
    summary: 'Revisar letras y videos. Volumen que permita conversar. Palabras limpias, sin bromas de mal gusto (Efes. 5:3).' },
  { id: 11, title: 'Bondad con familiares no Testigos', scripture: 'Col. 4:6', scripture_url: wol('Colosenses 4:6'), category: 'invitados',
    summary: 'Explicarles con tacto cómo son nuestras bodas y complacerlos en lo que no viole principios bíblicos.' },
  { id: 12, title: 'Previsión con los invitados', scripture: 'Prov. 22:3', scripture_url: wol('Proverbios 22:3'), category: 'invitados',
    summary: 'Definir con claridad la lista de invitados para evitar aglomeraciones y personas no invitadas.' },
  { id: 13, title: 'Todo de forma digna y ordenada', scripture: '1 Cor. 14:40', scripture_url: `${BIBLE}1-corintios/14/#v46014040`, category: 'equipo',
    summary: 'Ensayar, respetar el horario y coordinar con tiempo a todos los colaboradores.' },
].map((p, i) => ({ ...p, sort: i + 1 }));

/** Textos para meditar (citados en el artículo). */
export const VERSES = [
  { ref: '1 Cor. 14:40', url: `${BIBLE}1-corintios/14/#v46014040`, text: '“Háganlo todo de forma digna y ordenada.”' },
  { ref: 'Prov. 5:18', url: `${BIBLE}proverbios/5/#v20005018`, text: 'Jehová desea que disfruten mucho el día de su boda y que tengan un matrimonio muy feliz.' },
  { ref: 'Cant. 3:11', url: `${BIBLE}el-cantar-de-los-cantares/3/#v22003011`, text: 'El día de la boda es un día de gran alegría para el corazón.' },
  { ref: 'Gén. 2:24', url: `${BIBLE}G%C3%A9nesis/2/#v1002024`, text: 'Jehová es el Creador del matrimonio: su punto de vista es lo más importante.' },
  { ref: 'Heb. 12:9', url: `${BIBLE}hebreos/12/#v58012009`, text: 'Jehová es su Padre celestial. Tomar en cuenta su opinión en cada decisión lo honra.' },
  { ref: 'Sal. 25:14', url: `${BIBLE}salmos/25/#v19025014`, text: 'Protejan su amistad con Jehová: que nada de ese día lo hiera u ofenda.' },
  { ref: 'Sal. 116:12', url: `${BIBLE}salmos/116/#v19116012`, text: 'Por todo lo que Jehová ha hecho por ustedes, ¿verdad que merece que lo honren en su boda?' },
  { ref: 'Mat. 22:21', url: `${BIBLE}mateo/22/#v40022021`, text: 'Los cristianos verdaderos respetamos las leyes locales relacionadas con el matrimonio.' },
  { ref: 'Rom. 13:1, 2', url: `${BIBLE}romanos/13/#v45013001-v45013002`, text: 'Cumplir con los requisitos legales para casarse es una forma de honrar a Jehová.' },
  { ref: 'Gén. 1:28', url: `${BIBLE}G%C3%A9nesis/1/#v1001028`, text: 'El matrimonio es un regalo de Dios desde el principio de la humanidad.' },
];

/** Checklist inicial: [etapa, título, categoría, principio, descripción, estado]. */
const TASKS = [
  ['s1', 'Orar juntos antes de cada decisión importante', 'espiritual', 4, 'Pedir a Jehová sabiduría, calma y paz familiar en cada paso.'],
  ['s1', 'Leer juntos el artículo “Cómo planear una boda que honre a Jehová”', 'espiritual', 1, 'La Atalaya, estudio de diciembre de 2025. Es la base de toda la organización.'],
  ['s1', 'Fijar la fecha: viernes 26 de febrero de 2027', 'salon', 13, 'Fecha confirmada por los novios.', 'hecho'],
  ['s1', 'Definir el presupuesto total sin deudas', 'presupuesto', 5, 'Acordar un monto realista e incluir un 10 % para imprevistos.'],
  ['s1', 'Conversar con los padres sobre los planes', 'invitados', 11, 'Escuchar sus ideas con cariño y explicar las decisiones con bondad.'],

  ['s2', 'Enviar la carta a los ancianos solicitando el Salón del Reino', 'salon', 2, 'Hacerlo con suficiente antelación y por escrito.'],
  ['s2', 'Pedir a un anciano que presente el discurso de boda', 'salon', 1, 'Confirmar fecha y hora con el orador.'],
  ['s2', 'Averiguar requisitos y agendar turno en el Registro Civil de Azogues', 'legal', 3, 'Revisar fechas disponibles, tasas y si será en la sede o en otro lugar.'],
  ['s2', 'Reunir los documentos para el matrimonio civil', 'legal', 3, 'Cédulas vigentes, certificados y demás requisitos.'],
  ['s2', 'Elegir a los 2 testigos legales', 'legal', 3, 'Mayores de edad y con documentos en regla.'],
  ['s2', 'Reservar el local de recepción para 100 invitados', 'recepcion', 12, 'Revisar capacidad, parqueadero, baños, acústica y clima.'],
  ['s2', 'Elegir al Director del Banquete', 'equipo', 8, 'Un hermano maduro y de confianza.'],
  ['s2', 'Confirmar las parejas de damas y caballeros', 'equipo', 13, 'Nancy y Manuel, Nuria y Darío, Lady e Isaac, Diana y Kevin.', 'hecho'],
  ['s2', 'Definir el código de vestimenta: verde salvia y beige', 'vestimenta', 6, 'Damas con vestido verde salvia; caballeros con camisa blanca, fajín y corbatín verde salvia y pantalón beige.', 'hecho'],
  ['s2', 'Elegir las canciones del mix de baile (~8 min)', 'musica', 10, 'Rock Around The Clock, Tu cariñito, Bailando bachata y Te voy a amar.', 'hecho'],
  ['s2', 'Hacer la lista preliminar de 100 invitados', 'invitados', 12, 'Agrupar por familia de Freddy, familia de Priscila, congregación y amigos.'],
  ['s2', 'Cotizar el banquete para 100 platos', 'proveedores', 5, 'Pedir al menos 3 cotizaciones.'],

  ['s3', 'Conseguir el vestido de la novia y el traje verde salvia del novio', 'vestimenta', 6, 'Elegantes, modestos y dentro del presupuesto.'],
  ['s3', 'Contratar fotografía y video', 'proveedores', 13, 'Recordar las pautas de respeto en el Salón del Reino.'],
  ['s3', 'Coordinar el sonido y la lista musical aprobada', 'musica', 10, 'Revisar letras y descargar la música para usarla sin internet.'],
  ['s3', 'Elegir los cánticos del Reino para la ceremonia', 'musica', 1, ''],
  ['s3', 'Enviar las invitaciones y pedir confirmación', 'invitados', 12, 'Con fecha límite para confirmar.'],
  ['s3', 'Encargar la torta y el postre', 'proveedores', 5, ''],
  ['s3', 'Primer ensayo del baile en casa de Prisci', 'equipo', 13, 'Viernes o sábado, según les convenga a todos.'],
  ['s3', 'Explicar con bondad a familiares no Testigos cómo será la boda', 'invitados', 11, 'Se les puede mostrar información de jw.org.'],

  ['s4', 'Cerrar la lista de confirmados y armar el plano de mesas', 'invitados', 12, '10 a 12 mesas más la mesa principal.'],
  ['s4', 'Revisar el programa de la recepción con el Director del Banquete', 'equipo', 8, 'Horarios, palabras, video y cierre puntual.'],
  ['s4', 'Definir las medidas sobre las bebidas alcohólicas', 'recepcion', 9, 'Cantidad, quién sirve y supervisión.'],
  ['s4', 'Revisar palabras, videos y entretenimiento', 'musica', 10, 'Que todo sea limpio y edificante.'],
  ['s4', 'Comprar los anillos', 'vestimenta', 5, ''],
  ['s4', 'Pagar los saldos pendientes a los proveedores', 'presupuesto', 5, ''],

  ['s5', 'Ensayo general con damas, caballeros y colaboradores', 'equipo', 13, 'Entrada, ubicación y salida.'],
  ['s5', 'Confirmar horarios con todos los proveedores', 'proveedores', 13, ''],
  ['s5', 'Entregar la lista de invitados y el plano a los acomodadores', 'invitados', 12, ''],
  ['s5', 'Preparar documentos y anillos para el Registro Civil', 'legal', 3, ''],

  ['s6', 'Damas y caballeros listos en el Salón 1 hora antes', 'equipo', 13, 'Ya cambiados y listos.'],
  ['s6', 'Discurso de boda en el Salón del Reino', 'salon', 1, 'Reverencia durante el discurso y las oraciones.'],
  ['s6', 'Fotos oficiales y traslado ordenado al local', 'equipo', 13, ''],
  ['s6', 'Recepción y cierre puntual con agradecimiento', 'recepcion', 13, 'Sin extenderse hasta altas horas.'],
];

function isoDateMinus(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export const TEAM_ROLES = [
  { role: 'Damas y caballeros', person: 'Manuel', partner: 'Nancy', notes: 'Pareja 1' },
  { role: 'Damas y caballeros', person: 'Darío', partner: 'Nuria', notes: 'Pareja 2' },
  { role: 'Damas y caballeros', person: 'Isaac', partner: 'Lady', notes: 'Pareja 3' },
  { role: 'Damas y caballeros', person: 'Kevin', partner: 'Diana', notes: 'Pareja 4' },
  { role: 'Director del Banquete', person: null, partner: null, notes: 'Hermano maduro (Juan 2:8)' },
  { role: 'Orador del discurso', person: null, partner: null, notes: 'Anciano de congregación' },
  { role: 'Audio y música', person: null, partner: null, notes: '' },
  { role: 'Fotografía y video', person: null, partner: null, notes: '' },
  { role: 'Acomodadores', person: null, partner: null, notes: 'Recepción de los 100 invitados' },
].map((r, i) => ({ ...r, sort: i + 1 }));

export const SONGS = [
  { title: 'Rock Around The Clock', artist: 'Bill Haley & His Comets', url: 'https://youtu.be/6HZRldnM-Cs', purpose: 'Mix de baile' },
  { title: 'Tu cariñito (salsa bailable)', artist: 'DJ Papu GT Música Mix', url: 'https://youtu.be/MCg2a3wG-dg', purpose: 'Mix de baile' },
  { title: 'Bailando bachata', artist: 'Chayanne', url: 'https://youtu.be/dsLjyLn859g', purpose: 'Mix de baile' },
  { title: 'Te voy a amar', artist: 'Axel', url: 'https://youtu.be/KZh60U1PqSE', purpose: 'Mix de baile' },
].map((s, i) => ({ ...s, sort: i + 1 }));

export const GUEST_GROUPS = [
  { id: 1, name: 'Familia de Freddy', color: '#4A6B53' },
  { id: 2, name: 'Familia de Priscila', color: '#B6863A' },
  { id: 3, name: 'Congregación', color: '#688B70' },
  { id: 4, name: 'Amigos', color: '#8B5E3C' },
];

export const SEATING_TABLES = [
  { name: 'Mesa Principal (Novios y Padres)', capacity: 8, sort: 1 },
  ...Array.from({ length: 10 }, (_, i) => ({ name: `Mesa ${i + 1}`, capacity: 10, sort: i + 2 })),
];

export const BUDGET_ITEMS = [
  { category: 'recepcion', concept: 'Banquete (100 platos + bebidas sin alcohol)', estimated: 1800, actual: null, notes: 'Plato servido a la mesa' },
  { category: 'recepcion', concept: 'Alquiler de local y mobiliario', estimated: 700, actual: null, notes: 'Mesas, sillas vestidas y mantelería' },
  { category: 'legal', concept: 'Registro Civil (tasas y trámites)', estimated: 100, actual: null, notes: 'Registro Civil de Azogues' },
  { category: 'proveedores', concept: 'Torta y postre para 100 invitados', estimated: 250, actual: null, notes: '' },
  { category: 'musica', concept: 'Fotografía, video y equipo de sonido', estimated: 550, actual: null, notes: 'Micrófonos y cobertura' },
  { category: 'vestimenta', concept: 'Vestido de novia y traje verde salvia', estimated: 600, actual: null, notes: 'Modestos y dentro del presupuesto' },
  { category: 'presupuesto', concept: 'Fondo para imprevistos (10 %)', estimated: 400, actual: null, notes: 'Reserva de seguridad (cero deudas)' },
];

export const SAMPLE_GUESTS = [
  { full_name: 'Lucrecia (Mamá de Priscila)', group_id: 2, side: 'novia', companions: 0, companions_confirmed: 0, is_witness: true, rsvp: 'si', rsvp_code: 'LUCRECIA01', notes: 'Mesa principal' },
  { full_name: 'María Peñafiel', group_id: 1, side: 'novio', companions: 0, companions_confirmed: 0, is_witness: true, rsvp: 'si', rsvp_code: 'MARIAP0002', notes: 'Mesa principal' },
  { full_name: 'Manuel Pérez y Nancy', group_id: 3, side: 'ambos', companions: 1, companions_confirmed: 1, is_witness: true, rsvp: 'si', rsvp_code: 'MANUEL0003', notes: 'Damas y caballeros · Pareja 1' },
  { full_name: 'Darío Barzallo y Nuria', group_id: 3, side: 'ambos', companions: 1, companions_confirmed: 1, is_witness: true, rsvp: 'si', rsvp_code: 'DARIO00004', notes: 'Damas y caballeros · Pareja 2' },
  { full_name: 'Isaac y Lady', group_id: 3, side: 'ambos', companions: 1, companions_confirmed: 1, is_witness: true, rsvp: 'si', rsvp_code: 'ISAAC00005', notes: 'Damas y caballeros · Pareja 3' },
  { full_name: 'Kevin y Diana', group_id: 3, side: 'ambos', companions: 1, companions_confirmed: 1, is_witness: true, rsvp: 'si', rsvp_code: 'KEVIN00006', notes: 'Damas y caballeros · Pareja 4' },
  { full_name: 'Jenny Dumancela y Ronald', group_id: 2, side: 'novia', companions: 1, companions_confirmed: 0, is_witness: true, rsvp: 'pendiente', rsvp_code: 'JENNY00007', notes: 'Hermana de Priscila' },
  { full_name: 'Luis Carangui y Katy', group_id: 3, side: 'ambos', companions: 1, companions_confirmed: 1, is_witness: true, rsvp: 'si', rsvp_code: 'LUISKATY08', notes: '' },
];

export const WEDDING = {
  id: 1,
  couple_names: 'Freddy & Priscila',
  groom_name: 'Freddy Peñafiel',
  bride_name: 'Priscila Dumancela',
  wedding_date: WEDDING_DATE_ISO,
  time_confirmed: false,
  city: 'Azogues, Cañar',
  kingdom_hall: null,
  kingdom_hall_address: null,
  reception_venue: null,
  reception_address: null,
  civil_date: null,
  civil_place: null,
  speaker: null,
  banquet_director: null,
  guest_target: 100,
  budget_target: 4400,
  dress_colors: 'Verde salvia y beige',
  notes: null,
};

/** Construye todo el conjunto de datos iniciales. */
export function buildSeed() {
  return {
    wedding: { ...WEDDING },
    principles: PRINCIPLES.map((p) => ({ ...p })),
    tasks: TASKS.map(([stage, title, category, principle_id, description, status], i) => {
      const st = STAGES.find((s) => s.key === stage);
      return {
        title, description: description || null, stage, category, principle_id,
        assignee: null,
        due_date: isoDateMinus(WEDDING_DATE_ISO, st.daysBefore),
        status: status || 'pendiente',
        sort: i + 1,
      };
    }),
    team_roles: TEAM_ROLES.map((r) => ({ ...r })),
    songs: SONGS.map((s) => ({ ...s })),
    guest_groups: GUEST_GROUPS.map((g) => ({ ...g })),
    guests: SAMPLE_GUESTS.map((g) => ({ ...g, children: 0, invitation_sent: false, diet: null, table_id: null, phone: null, email: null, rsvp_message: null })),
    seating_tables: SEATING_TABLES.map((t) => ({ ...t })),
    vendors: [],
    budget_items: BUDGET_ITEMS.map((b) => ({ ...b, vendor_id: null })),
    payments: [],
  };
}
