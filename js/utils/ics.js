// Экспорт записей в формат iCalendar (.ics) для Календаря iPhone.
// Время записывается «плавающим» (без часового пояса) — событие встанет на то же
// время по часам телефона, как и в приложении.
// К событиям добавляются напоминания (VALARM): Календарь iPhone покажет уведомление
// за день до записи, даже если приложение закрыто.

import { servicesTitle } from './appt.js';

/** Экранирование текста по RFC 5545 */
function esc(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Перенос длинных строк (не длиннее 75 октетов) */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (curLen + len > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** «2026-11-16» + 540 → «20261116T090000» */
function dt(date, min) {
  const d = new Date(`${date}T00:00:00`);
  d.setMinutes(min);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** Варианты напоминаний в Календаре (значение настройки calendarAlarms) */
export const CALENDAR_ALARMS = {
  none: { label: 'Без напоминаний', triggers: [] },
  day: { label: 'За день', triggers: ['-P1D'] },
  dayHour: { label: 'За день и за час', triggers: ['-P1D', '-PT1H'] },
};

/** 540 → «09:00» */
function hm(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * Собрать .ics из записей.
 * @param {object[]} appointments
 * @param {Map} clientsMap
 * @param {{name?: string, location?: object, alarms?: string}} o — alarms: ключ CALENDAR_ALARMS
 */
export function buildIcs(appointments, clientsMap, { name = 'Beauty CRM', location = null, alarms = 'day' } = {}) {
  const triggers = (CALENDAR_ALARMS[alarms] || CALENDAR_ALARMS.day).triggers;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Beauty CRM//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
  ];
  for (const a of appointments) {
    if (a.deleted || a.status === 'cancelled') continue;
    const c = clientsMap.get(a.clientId);
    const summary = `${c?.name || 'Клиент'} — ${servicesTitle(a)}`;
    const desc = [c?.phone ? `Телефон: ${c.phone}` : '', `Цена: ${(a.total / 100).toFixed(2)}`, a.comment || ''].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}@beauty-crm`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dt(a.date, a.start)}`,
      `DTEND:${dt(a.date, a.start + a.duration)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      location ? `LOCATION:${esc([location.name, location.address].filter(Boolean).join(', '))}` : null,
      `STATUS:${a.status === 'confirmed' || a.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
    );
    for (const tr of triggers) {
      const text = tr === '-P1D'
        ? `Завтра в ${hm(a.start)}: ${summary}. Напомните клиенту о записи.`
        : `Через час: ${summary}`;
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${tr}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).map(fold).join('\r\n') + '\r\n';
}
