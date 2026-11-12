// Расчёт статистики за период. Чистые функции — без обращения к базе.
// Выручка считается по завершённым записям (сумма записи), а не по платежам,
// поэтому предоплата и итоговая оплата не суммируются дважды.

import { addDays, diffDays, startOfWeek, startOfMonth, endOfMonth, addMonths } from './dates.js';

/** Границы периода: week | month | year | custom; offset — сдвиг назад/вперёд */
export function statsRange(kind, offset = 0, base, custom = null) {
  if (kind === 'week') {
    const from = addDays(startOfWeek(base), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  if (kind === 'year') {
    const y = Number(base.slice(0, 4)) + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (kind === 'custom' && custom) return custom;
  const m = addMonths(startOfMonth(base), offset);
  return { from: m, to: endOfMonth(m) };
}

/**
 * Основные показатели.
 * @returns {object} revenue, count, completed, cancelled, noshow, noshowPct, avg, newClients,
 *   returning, expenses, profit, topServices, series
 */
export function computeStats({ from, to, appointments, expenses, byMonth = false }) {
  const inRange = appointments.filter((a) => !a.deleted && a.date >= from && a.date <= to);
  const done = inRange.filter((a) => a.status === 'completed');
  const cancelled = inRange.filter((a) => a.status === 'cancelled').length;
  const noshow = inRange.filter((a) => a.status === 'noshow').length;
  const revenue = done.reduce((s, a) => s + (a.total || 0), 0);
  const exp = expenses.filter((e) => !e.deleted && e.date >= from && e.date <= to);
  const expTotal = exp.reduce((s, e) => s + e.amount, 0);

  // Новые и вернувшиеся клиенты: по первой (не отменённой) записи клиента за всё время
  const firstDate = new Map();
  for (const a of appointments) {
    if (a.deleted || a.status === 'cancelled') continue;
    if (!firstDate.has(a.clientId) || a.date < firstDate.get(a.clientId)) firstDate.set(a.clientId, a.date);
  }
  const visited = new Set(done.map((a) => a.clientId));
  let newClients = 0;
  let returning = 0;
  for (const id of visited) {
    if (firstDate.get(id) >= from) newClients++;
    else returning++;
  }

  // Топ услуг по числу завершённых записей
  const svc = new Map();
  for (const a of done) {
    for (const s of a.services || []) {
      const cur = svc.get(s.name) || { name: s.name, count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += s.price;
      svc.set(s.name, cur);
    }
  }
  const topServices = [...svc.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 6);

  // Ряд выручки: по дням или по месяцам (для года)
  const series = [];
  if (byMonth) {
    for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) {
      const key = m.slice(0, 7);
      series.push({
        key,
        revenue: done.filter((a) => a.date.startsWith(key)).reduce((s, a) => s + a.total, 0),
        expenses: exp.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0),
      });
    }
  } else {
    const days = Math.min(diffDays(from, to), 400);
    for (let i = 0; i <= days; i++) {
      const d = addDays(from, i);
      series.push({
        key: d,
        revenue: done.filter((a) => a.date === d).reduce((s, a) => s + a.total, 0),
        expenses: exp.filter((e) => e.date === d).reduce((s, e) => s + e.amount, 0),
      });
    }
  }

  const expByCat = new Map();
  for (const e of exp) expByCat.set(e.category, (expByCat.get(e.category) || 0) + e.amount);

  return {
    revenue,
    count: inRange.length,
    completed: done.length,
    cancelled,
    noshow,
    noshowPct: done.length + noshow ? Math.round((noshow / (done.length + noshow)) * 100) : 0,
    avg: done.length ? Math.round(revenue / done.length) : 0,
    newClients,
    returning,
    expenses: expTotal,
    expByCat: [...expByCat].sort((a, b) => b[1] - a[1]),
    profit: revenue - expTotal,
    topServices,
    series,
  };
}
