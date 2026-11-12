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
  location: stroke('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
};

/** Вставить иконку в HTML-строку */
export function icon(name, cls = '') {
  return `<span class="ic ${cls}">${icons[name] || ''}</span>`;
}
