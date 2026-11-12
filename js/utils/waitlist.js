// Лист ожидания: поиск свободных окон, подходящих клиенту из списка.
// Сами окна считает только slots.js — здесь лишь фильтр по желаемым датам и времени.

import { getFreeSlotsRange } from './slots.js';
import { toMin, today } from './dates.js';

/** Шаг перебора времени начала для листа ожидания, минут */
const STEP = 30;

/**
 * Подходящие окна для записи листа ожидания.
 * @param {object} entry — { dateFrom, dateTo, timeFrom, timeTo, serviceId }
 * @param {{schedule, exceptions, appointments, breaks, services, now?}} ctx
 * @returns {{date: string, slots: number[]}[]}
 */
export function matchWaitlist(entry, { schedule, exceptions, appointments, breaks, services, now = new Date() }) {
  const t = today();
  const from = entry.dateFrom > t ? entry.dateFrom : t;
  const to = entry.dateTo || entry.dateFrom;
  if (to < from) return [];
  const svc = services.find((s) => s.id === entry.serviceId);
  const duration = svc ? svc.duration + (svc.breakAfter || 0) : 60;
  const tFrom = entry.timeFrom ? toMin(entry.timeFrom) : 0;
  const tTo = entry.timeTo ? toMin(entry.timeTo) : 24 * 60;
  return getFreeSlotsRange({ from, to, schedule, exceptions, appointments, breaks, now, slotDuration: duration, step: STEP })
    .map((d) => ({ date: d.date, slots: d.slots.filter((s) => s >= tFrom && s + duration <= tTo) }))
    .filter((d) => d.slots.length);
}

/** Активна ли запись листа ожидания (ждёт и период ещё не прошёл) */
export function isWaiting(entry) {
  return !entry.deleted && entry.status === 'waiting' && (entry.dateTo || entry.dateFrom) >= today();
}
