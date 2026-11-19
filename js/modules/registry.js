// Registro completo de los 9 módulos de la aplicación.
import { renderPanel } from './panel.js';
import { renderPrincipios } from './principios.js';
import { renderTareas } from './tareas.js';
import { renderInvitados } from './invitados.js';
import { renderMesas } from './mesas.js';
import { renderPresupuesto } from './presupuesto.js';
import { renderProveedores } from './proveedores.js';
import { renderEquipo } from './equipo.js';
import { renderWebBoda } from './web.js';

export const ROUTES = [
  { key: 'panel', label: 'Mi boda', icon: 'home', render: renderPanel },
  { key: 'principios', label: 'Principios', icon: 'book', render: renderPrincipios },
  { key: 'tareas', label: 'Tareas', icon: 'clipboard', render: renderTareas },
  { key: 'invitados', label: 'Invitados', icon: 'users', render: renderInvitados },
  { key: 'mesas', label: 'Mesas', icon: 'tables', render: renderMesas },
  { key: 'presupuesto', label: 'Presupuesto', icon: 'wallet', render: renderPresupuesto },
  { key: 'proveedores', label: 'Proveedores', icon: 'briefcase', render: renderProveedores },
  { key: 'equipo', label: 'Equipo', icon: 'star', render: renderEquipo },
  { key: 'web', label: 'Web de boda', icon: 'globe', render: renderWebBoda },
];

export function renderComingSoon() {}
