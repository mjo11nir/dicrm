// Вычисления по клиентам: визиты, траты, сегменты для фильтров, CSV.

import { today, addDays, diffDays } from './dates.js';
import { phoneDigits } from './appt.js';

/** Через сколько дней без визитов клиент считается «давно не был» */
export const LOST_AFTER_DAYS = 60;
/** С какого числа завершённых визитов клиент «постоянный» */
export const REGULAR_FROM = 3;

/**
 * Сводка по клиенту из его записей.
 * @returns {{visits:number, spent:number, avg:number, lastVisit:string|null, next:object|null, appts:object[]}}
 */
export function clientStats(clientId, appointments) {
  const t = today();
  const appts = appointments.filter((a) => a.clientId === clientId && !a.deleted)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
  const done = appts.filter((a) => a.status === 'completed');
  const spent = done.reduce((s, a) => s + (a.total || 0), 0);
  const next = appts.filter((a) => a.date >= t && (a.status === 'scheduled' || a.status === 'confirmed'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0] || null;
  return {
    visits: done.length,
    spent,
    avg: done.length ? Math.round(spent / done.length) : 0,
    lastVisit: done[0]?.date || null,
    next,
    appts,
  };
}

/** Фильтры списка клиентов */
export const CLIENT_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'regular', label: 'Постоянные' },
  { value: 'lost', label: 'Давно не были' },
  { value: 'birthday', label: 'ДР в этом месяце' },
];

/** Подходит ли клиент под фильтр */
export function matchesFilter(client, stats, filter) {
  const t = today();
  switch (filter) {
    case 'new': return !!client.createdAt && client.createdAt.slice(0, 7) === t.slice(0, 7);
    case 'regular': return stats.visits >= REGULAR_FROM;
    case 'lost': return !!stats.lastVisit && !stats.next && diffDays(stats.lastVisit, t) > LOST_AFTER_DAYS;
    case 'birthday': return !!client.birthday && client.birthday.slice(5, 7) === t.slice(5, 7);
    default: return true;
  }
}

/** Пора ли клиенту записаться снова (по интервалу повторного визита услуги) */
export function isDueAgain(stats, services) {
  if (!stats.lastVisit || stats.next) return false;
  const last = stats.appts.find((a) => a.status === 'completed');
  const days = Math.max(0, ...(last?.services || []).map((s) => services.find((x) => x.id === s.id)?.repeatDays || 0));
  return days > 0 && addDays(stats.lastVisit, days) <= today();
}

// ---------- CSV ----------

const CSV_COLUMNS = [
  ['name', 'Имя'], ['phone', 'Телефон'], ['birthday', 'День рождения'], ['telegram', 'Telegram'],
  ['discount', 'Скидка %'], ['tags', 'Теги'], ['notes', 'Заметки'],
];

function csvCell(v) {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Клиенты → CSV (разделитель «;», чтобы Excel с русской локалью открывал корректно) */
export function clientsToCsv(clients) {
  const head = CSV_COLUMNS.map(([, t]) => t).join(';');
  const rows = clients.map((c) => CSV_COLUMNS.map(([k]) => csvCell(k === 'tags' ? (c.tags || []).join(', ') : c[k])).join(';'));
  return '﻿' + [head, ...rows].join('\r\n');
}

/** Разобрать CSV (разделитель «;» или «,», кавычки по RFC 4180) в массив строк */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/**
 * CSV → объекты клиентов. Колонки узнаются по заголовку (рус./англ.),
 * без заголовка считаем: имя, телефон.
 */
export function csvToClients(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const aliases = {
    name: ['имя', 'name', 'фио', 'клиент'],
    phone: ['телефон', 'phone', 'тел', 'номер'],
    birthday: ['день рождения', 'др', 'birthday', 'дата рождения'],
    telegram: ['telegram', 'телеграм'],
    discount: ['скидка %', 'скидка', 'discount'],
    tags: ['теги', 'tags'],
    notes: ['заметки', 'notes', 'комментарий'],
  };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  for (const [k, names] of Object.entries(aliases)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) idx[k] = i;
  }
  const hasHeader = idx.name !== undefined;
  if (!hasHeader) { idx.name = 0; idx.phone = 1; }
  return rows.slice(hasHeader ? 1 : 0).map((r) => {
    const get = (k) => (idx[k] !== undefined ? (r[idx[k]] || '').trim() : '');
    return {
      name: get('name'),
      phone: get('phone'),
      birthday: /^\d{4}-\d{2}-\d{2}$/.test(get('birthday')) ? get('birthday') : '',
      telegram: get('telegram'),
      discount: Math.min(100, Math.max(0, parseFloat(get('discount')) || 0)),
      tags: get('tags') ? get('tags').split(',').map((s) => s.trim()).filter(Boolean) : [],
      notes: get('notes'),
    };
  }).filter((c) => c.name);
}

/** Группы возможных дубликатов: одинаковый телефон или одинаковое имя */
export function findDuplicates(clients) {
  const groups = [];
  const used = new Set();
  const norm = (s) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  for (const c of clients) {
    if (used.has(c.id)) continue;
    const d = phoneDigits(c.phone).slice(-10);
    const same = clients.filter((x) => x.id !== c.id && !used.has(x.id) &&
      ((d.length >= 7 && phoneDigits(x.phone).slice(-10) === d) || norm(x.name) === norm(c.name)));
    if (same.length) {
      const g = [c, ...same];
      g.forEach((x) => used.add(x.id));
      groups.push(g);
    }
  }
  return groups;
}
