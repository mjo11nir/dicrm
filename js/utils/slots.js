// Расчёт рабочих часов, свободного времени и свободных окон.
// ЕДИНСТВЕННОЕ место в приложении, где считаются свободные окна:
// его используют Главная, Расписание и (в этапе 2) экран «Свободные окна».
// Все функции чистые — без обращения к базе, поэтому их легко тестировать
// (см. /tests/slots.test.html).
//
// Форматы данных:
//   schedule   — [{ weekday: 0..6 (0 = пн), isWorking, start: '09:00', end: '19:00', breaks: [{start, end}] }]
//   exceptions — [{ kind: 'hours' | 'off', dateFrom, dateTo, start?, end?, updatedAt?, deleted? }]
//   appointments — [{ id, date, start: минуты, duration: минуты, breakAfter?: минуты, status, deleted? }]
//   breaks     — [{ id, date, start: минуты, end: минуты, deleted? }]

import { toMin, ymd, weekdayIndex, addDays, nowMin, roundUp } from './dates.js';

/** Статусы, которые НЕ занимают время в расписании */
export const FREEING_STATUSES = ['cancelled'];

/** Шаг округления текущего времени для сегодняшнего дня, минут */
export const NOW_ROUND = 15;

/** Минимальный показываемый промежуток свободного времени, минут */
export const MIN_GAP = 15;

/**
 * Рабочие часы конкретного дня с учётом графика, исключений и отпусков.
 * @returns {{working: boolean, start: number, end: number, breaks: {start:number,end:number}[], exception: object|null}}
 */
export function getDayHours(date, schedule, exceptions = []) {
  // Исключения, которые покрывают дату. Если их несколько — побеждает самое свежее.
  const ex = exceptions
    .filter((e) => !e.deleted && e.dateFrom <= date && date <= (e.dateTo || e.dateFrom))
    .sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')))
    .pop() || null;

  const rule = schedule.find((r) => r.weekday === weekdayIndex(date));
  const ruleBreaks = (rule?.breaks || []).map((b) => ({ start: toMin(b.start), end: toMin(b.end) }));

  if (ex) {
    if (ex.kind === 'off') return { working: false, start: 0, end: 0, breaks: [], exception: ex };
    const start = toMin(ex.start);
    const end = toMin(ex.end);
    // Перерывы из графика оставляем, если они помещаются в новые часы
    const breaks = ruleBreaks.filter((b) => b.start >= start && b.end <= end);
    return { working: true, start, end, breaks, exception: ex };
  }

  if (!rule || !rule.isWorking) return { working: false, start: 0, end: 0, breaks: [], exception: null };
  return { working: true, start: toMin(rule.start), end: toMin(rule.end), breaks: ruleBreaks, exception: null };
}

/** Занимает ли запись время (не удалена и не отменена) */
export function isBlocking(appt) {
  return !appt.deleted && !FREEING_STATUSES.includes(appt.status);
}

/**
 * Занятые интервалы дня: записи (+ перерыв после услуги), разовые перерывы
 * и перерывы из графика. Возвращает отсортированный список {start, end}.
 */
export function getBusyIntervals(date, hours, appointments = [], breaks = []) {
  const busy = [];
  for (const a of appointments) {
    if (a.date !== date || !isBlocking(a)) continue;
    busy.push({ start: a.start, end: a.start + a.duration + (a.breakAfter || 0) });
  }
  for (const b of breaks) {
    if (b.date !== date || b.deleted) continue;
    busy.push({ start: b.start, end: b.end });
  }
  for (const b of hours.breaks || []) busy.push({ start: b.start, end: b.end });
  return busy.sort((x, y) => x.start - y.start);
}

/**
 * Свободные промежутки внутри рабочих часов дня.
 * Прошедшие дни дают пустой список, у сегодняшнего прошедшее время отрезается
 * (текущее время округляется вверх до 15 минут).
 * @param {Date} now — текущий момент (передаётся явно, чтобы функцию можно было тестировать)
 */
export function getFreeIntervals({ date, hours, appointments = [], breaks = [], now = new Date(), minGap = MIN_GAP }) {
  if (!hours.working) return [];
  const todayStr = ymd(now);
  if (date < todayStr) return [];

  let from = hours.start;
  if (date === todayStr) from = Math.max(from, roundUp(nowMin(now), NOW_ROUND));
  const to = hours.end;
  if (from >= to) return [];

  const result = [];
  let cur = from;
  for (const b of getBusyIntervals(date, hours, appointments, breaks)) {
    if (b.end <= cur) continue;
    if (b.start >= to) break;
    if (b.start > cur) result.push({ start: cur, end: Math.min(b.start, to) });
    cur = Math.max(cur, b.end);
    if (cur >= to) break;
  }
  if (cur < to) result.push({ start: cur, end: to });
  return result.filter((i) => i.end - i.start >= minGap);
}

/**
 * Свободные окна дня — времена начала слотов стандартной длительности.
 * Каждый свободный промежуток режется на слоты от его начала: 9:00, 11:00, 13:00…
 * @param {number} [step] — шаг между началами слотов (по умолчанию равен длительности слота,
 *   меньший шаг даёт больше вариантов начала — используется в «Найти и записать»)
 * @returns {number[]} минуты начала слотов
 */
export function getFreeSlots({ date, hours, appointments = [], breaks = [], now = new Date(), slotDuration = 120, step = 0 }) {
  const slots = [];
  const inc = step > 0 ? step : slotDuration;
  for (const i of getFreeIntervals({ date, hours, appointments, breaks, now, minGap: 1 })) {
    for (let s = i.start; s + slotDuration <= i.end; s += inc) slots.push(s);
  }
  return slots;
}

/**
 * Свободные окна за период (включительно). Нерабочие дни и дни без окон пропускаются.
 * @returns {{date: string, slots: number[]}[]}
 */
export function getFreeSlotsRange({ from, to, schedule, exceptions = [], appointments = [], breaks = [], now = new Date(), slotDuration = 120, step = 0 }) {
  const result = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const hours = getDayHours(d, schedule, exceptions);
    if (!hours.working) continue;
    const slots = getFreeSlots({ date: d, hours, appointments, breaks, now, slotDuration, step });
    if (slots.length) result.push({ date: d, slots });
  }
  return result;
}

/**
 * Проверка новой/изменённой записи на пересечения и выход за рабочий график.
 * @returns {{dayOff: boolean, outsideHours: boolean, overlaps: object[], breakOverlap: boolean, ok: boolean}}
 */
export function findConflicts({ date, start, duration, excludeId = null }, { hours, appointments = [], breaks = [] }) {
  const end = start + duration;
  const cross = (s, e) => start < e && s < end;

  const overlaps = appointments.filter((a) =>
    a.id !== excludeId && a.date === date && isBlocking(a) &&
    cross(a.start, a.start + a.duration + (a.breakAfter || 0)));

  const breakOverlap =
    breaks.some((b) => !b.deleted && b.date === date && cross(b.start, b.end)) ||
    (hours.breaks || []).some((b) => cross(b.start, b.end));

  const dayOff = !hours.working;
  const outsideHours = !dayOff && (start < hours.start || end > hours.end);

  return { dayOff, outsideHours, overlaps, breakOverlap, ok: !dayOff && !outsideHours && !overlaps.length && !breakOverlap };
}
