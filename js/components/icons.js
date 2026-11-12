// Иконки в виде inline SVG. Контурные иконки — из открытого набора Lucide (лицензия ISC),
// залитые иконки панели вкладок нарисованы простыми фигурами.

const stroke = (body, w = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const fill = (body) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

export const icons = {
  // --- Панель вкладок (залитые) ---
  tabHome: fill('<rect x="2" y="2" width="9" height="9" rx="2.4"/><rect x="13" y="2" width="9" height="9" rx="2.4"/><rect x="2" y="13" width="9" height="9" rx="2.4"/><rect x="13" y="13" width="9" height="9" rx="2.4"/>'),
  tabSchedule: fill('<path d="M7 1.5a1 1 0 0 1 1 1V4h8V2.5a1 1 0 1 1 2 0V4h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V2.5a1 1 0 0 1 1-1zM4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9z"/><g fill="currentColor"><circle cx="7.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="16.5" cy="12" r="1.2"/><circle cx="7.5" cy="16.2" r="1.2"/><circle cx="12" cy="16.2" r="1.2"/><circle cx="16.5" cy="16.2" r="1.2"/></g>'),
  tabChats: fill('<path d="M12 2.5c5.5 0 10 3.9 10 8.8s-4.5 8.7-10 8.7c-1.1 0-2.2-.2-3.2-.5L4 21.5l1.2-4C3.2 15.9 2 13.7 2 11.3 2 6.4 6.5 2.5 12 2.5z"/><g fill="#fff"><circle cx="7.8" cy="11.3" r="1.3"/><circle cx="12" cy="11.3" r="1.3"/><circle cx="16.2" cy="11.3" r="1.3"/></g>'),
  tabMore: stroke('<path d="M3 6h18M3 12h18M3 18h18"/>', 2.2),

  // --- Общие (Lucide) ---
  plus: stroke('<path d="M5 12h14M12 5v14"/>'),
  chevronRight: stroke('<path d="m9 18 6-6-6-6"/>'),
  chevronLeft: stroke('<path d="m15 18-6-6 6-6"/>', 2.4),
  chevronUp: stroke('<path d="m18 15-6-6-6 6"/>', 2.4),
  search: stroke('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', 2.2),
  bell: stroke('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  bellFill: fill('<path d="M12 2a6.5 6.5 0 0 0-6.5 6.5c0 5.5-2.5 8-2.5 8v1h18v-1s-2.5-2.5-2.5-8A6.5 6.5 0 0 0 12 2z"/><path d="M9.5 19.5h5a2.5 2.5 0 0 1-5 0z"/>'),
  calendar: stroke('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  calendarPlus: stroke('<path d="M21 13V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h7"/><path d="M16 2v4M8 2v4M3 10h18M19 16v6M16 19h6"/>'),
  calendarSlot: fill('<path d="M7 1.5a1 1 0 0 1 1 1V4h8V2.5a1 1 0 1 1 2 0V4h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V2.5a1 1 0 0 1 1-1z"/><rect x="12.5" y="12.5" width="5" height="5" rx="1.2" fill="#fff"/>'),
  calendarPlusFill: fill('<path d="M7 1.5a1 1 0 0 1 1 1V4h8V2.5a1 1 0 1 1 2 0V4h1a3 3 0 0 1 3 3v6.5a6 6 0 0 0-8.5 8.5H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V2.5a1 1 0 0 1 1-1z"/><path d="M18 14.5a1 1 0 0 1 1 1V17h1.5a1 1 0 1 1 0 2H19v1.5a1 1 0 1 1-2 0V19h-1.5a1 1 0 1 1 0-2H17v-1.5a1 1 0 0 1 1-1z"/>'),
  columns: stroke('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 3v18M15 3v18"/>', 1.8),
  calendarAlt: stroke('<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M8 2v4M16 2v4"/><rect x="7" y="13" width="4" height="4" rx="1"/>', 1.8),
  chat: fill('<path d="M5 3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-7l-5 4v-4H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/><g fill="#fff"><circle cx="8" cy="10.5" r="1.2"/><circle cx="12" cy="10.5" r="1.2"/><circle cx="16" cy="10.5" r="1.2"/></g>'),
  help: fill('<circle cx="12" cy="12" r="10"/><path fill="#fff" d="M12 6.5c-2 0-3.5 1.2-3.6 3h2c.1-.8.7-1.3 1.6-1.3.9 0 1.5.5 1.5 1.3 0 .7-.3 1-1.2 1.6-1 .6-1.5 1.3-1.4 2.5v.4h2v-.3c0-.7.3-1 1.2-1.6 1-.6 1.6-1.4 1.6-2.6 0-1.8-1.5-3-3.7-3zM12 15.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>'),
  user: stroke('<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'),
  userFill: fill('<circle cx="12" cy="8" r="4.5"/><path d="M3.5 21c.4-4.4 4-7 8.5-7s8.1 2.6 8.5 7z"/>'),
  users: fill('<circle cx="12" cy="8" r="3.4"/><circle cx="5.5" cy="9.5" r="2.5"/><circle cx="18.5" cy="9.5" r="2.5"/><path d="M5.5 21c0-3.8 2.9-6.5 6.5-6.5s6.5 2.7 6.5 6.5z"/><path d="M1 19.5c0-2.8 1.8-4.6 4.4-4.6.6 0 1.1.1 1.6.3a8 8 0 0 0-2.3 4.3zM23 19.5c0-2.8-1.8-4.6-4.4-4.6-.6 0-1.1.1-1.6.3a8 8 0 0 1 2.3 4.3z"/>'),
  phone: stroke('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  whatsapp: stroke('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  send: stroke('<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'),
  clock: stroke('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  coffee: stroke('<path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>'),
  check: stroke('<path d="M20 6 9 17l-5-5"/>', 2.4),
  x: stroke('<path d="M18 6 6 18M6 6l12 12"/>'),
  trash: stroke('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  edit: stroke('<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  move: stroke('<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="m10 14 2 2 4-4"/>'),
  wallet: stroke('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  scheduleSettings: stroke('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 9h18"/><circle cx="16" cy="16" r="3"/><path d="M16 14.8V16l.8.6"/>', 1.8),
  bellService: stroke('<path d="M3 20h18M4 17a8 8 0 0 1 16 0zM12 6V4M10 4h4"/>', 1.8),
  clipboardPen: stroke('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v4M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M18.4 13.6a2 2 0 1 1 3 3L17 21l-4 1 1-4z"/>'),
  globe: stroke('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>'),
  messageCircle: stroke('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  sync: stroke('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
  palette: stroke('<circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>'),
  languages: stroke('<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>'),
  usersStroke: stroke('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  camera: stroke('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>'),
  // Категории расходов
  sparkles: stroke('<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/>'),
  home: stroke('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  megaphone: stroke('<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  graduation: stroke('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'),
  wrench: stroke('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  package: stroke('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>'),
  // Разделы «Другого»
  pieChart: fill('<path d="M11 3.05A9 9 0 1 0 20.95 13H11z"/><path d="M13 2.05V11h8.95A9 9 0 0 0 13 2.05z"/>'),
  bag: fill('<path d="M6.3 2h11.4L21 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5zM5.7 6h12.6l-1.5-2H7.2z"/><path d="M8 9a4 4 0 0 0 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  imageFill: fill('<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><circle cx="9" cy="9" r="2" fill="#fff"/><path d="m5 19 5-6 3 3.5 2.5-2.5L19 19z" fill="#fff"/>'),
  thumbUp: fill('<path d="M2 10h4v12H2zM8 21V10l4.6-8a2.4 2.4 0 0 1 3.3 2.6L15 9h5.5a2 2 0 0 1 2 2.4l-1.7 8A2 2 0 0 1 18.8 21z"/>'),
  waitlist: stroke('<path d="M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="8" cy="16" r="6"/><path d="M9.5 17.5 8 16.25V14"/>'),
  star: fill('<path d="M11.5 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>'),
  database: stroke('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'),
  location: stroke('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
};

/** Вставить иконку в HTML-строку */
export function icon(name, cls = '') {
  return `<span class="ic ${cls}">${icons[name] || ''}</span>`;
}
