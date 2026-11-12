// Расписание → режим «Неделя»: 7 колонок с часами по вертикали (как в Календаре iOS).
// Записи — цветные блоки высотой по длительности, нерабочие часы затемнены,
// над каждым днём — выручка. Нажатие на пустое место открывает форму записи на это время.

import * as data from '../db.js';
import { el, onSwipe } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { AppointmentScreen } from './appointment.js';
import { getDayHours } from '../utils/slots.js';
import { today, addDays, startOfWeek, parseYmd, fromMin, WEEKDAYS_LETTER, MONTHS_SHORT } from '../utils/dates.js';
import { money } from '../utils/money.js';
import { revenueOf } from '../utils/appt.js';

/** Высота одного часа в пикселях */
const HOUR = 52;

/** Цвета блоков по статусу записи */
const BLOCK = {
  scheduled: ['#EFE3FC', '#9137E8'],
  confirmed: ['#DDF1F5', '#078EA7'],
  completed: ['#DFF5E4', '#28B84A'],
  noshow: ['#FCEFD9', '#F0A626'],
  cancelled: ['#F2F2F5', '#B0B0B5'],
};

export function createWeekView(nav, getSelected, setSelected) {
  const root = el('div', { class: 'week-view' });
  const title = el('div', { class: 'wv-title' });
  const head = el('div', { class: 'wv-nav' },
    el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Предыдущая неделя', html: icon('chevronLeft'), onclick: () => shift(-7) }),
    title,
    el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Следующая неделя', html: icon('chevronRight'), onclick: () => shift(7) }));
  const days = el('div', { class: 'wv-days' });
  const grid = el('div', { class: 'wv-grid' });
  root.append(head, days, grid);
  onSwipe(grid, (dir) => shift(dir < 0 ? 7 : -7));

  function shift(n) {
    setSelected(addDays(getSelected(), n));
    refresh();
  }

  async function refresh() {
    const t = today();
    const from = startOfWeek(getSelected());
    const to = addDays(from, 6);
    const [{ schedule, exceptions }, appts, breaks, clientsMap] = await Promise.all([
      data.getScheduleData(), data.getAppointmentsBetween(from, to), data.getBreaksBetween(from, to), data.getClientsMap(),
    ]);
    const f = parseYmd(from);
    const tt = parseYmd(to);
    title.textContent = `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${tt.getDate()} ${MONTHS_SHORT[tt.getMonth()]}`;

    // Диапазон часов: рабочие часы недели и все записи, минимум 9–19
    const dates = [...Array(7)].map((_, i) => addDays(from, i));
    const hours = dates.map((d) => getDayHours(d, schedule, exceptions));
    let minH = 9;
    let maxH = 19;
    for (const h of hours) if (h.working) { minH = Math.min(minH, Math.floor(h.start / 60)); maxH = Math.max(maxH, Math.ceil(h.end / 60)); }
    for (const a of appts) { minH = Math.min(minH, Math.floor(a.start / 60)); maxH = Math.max(maxH, Math.ceil((a.start + a.duration) / 60)); }
    const top0 = minH * 60;
    const y = (min) => ((min - top0) / 60) * HOUR;

    // Шапка дней: буква, число, выручка
    days.replaceChildren(el('div', { class: 'wv-corner' }), ...dates.map((d, i) => el('button', {
      class: 'wv-day' + (d === t ? ' today' : '') + (!hours[i].working ? ' off' : ''), type: 'button',
      onclick: () => { setSelected(d); nav.openDay(d); },
    },
    el('span', { class: 'wv-letter' }, WEEKDAYS_LETTER[i]),
    el('span', { class: 'wv-num' }, String(parseYmd(d).getDate())),
    el('span', { class: 'wv-rev' }, money(revenueOf(appts.filter((a) => a.date === d)))))));

    // Сетка
    const height = (maxH - minH) * HOUR;
    const axis = el('div', { class: 'wv-axis', style: { height: height + 'px' } });
    for (let h = minH; h <= maxH; h++) axis.appendChild(el('span', { class: 'wv-hour', style: { top: (h - minH) * HOUR + 'px' } }, `${h}:00`));
    const cols = dates.map((d, i) => {
      const col = el('div', { class: 'wv-col' + (d === t ? ' today' : ''), style: { height: height + 'px' } });
      // Рабочее время — светлая подложка поверх затемнённой колонки
      if (hours[i].working) {
        col.appendChild(el('div', { class: 'wv-work', style: { top: y(hours[i].start) + 'px', height: (y(hours[i].end) - y(hours[i].start)) + 'px' } }));
        for (const b of hours[i].breaks) col.appendChild(el('div', { class: 'wv-break', style: { top: y(b.start) + 'px', height: (y(b.end) - y(b.start)) + 'px' } }));
      }
      for (const b of breaks.filter((x) => x.date === d)) {
        col.appendChild(el('div', { class: 'wv-break', style: { top: y(b.start) + 'px', height: (y(b.end) - y(b.start)) + 'px' } }));
      }
      for (let h = minH + 1; h < maxH; h++) col.appendChild(el('div', { class: 'wv-line', style: { top: (h - minH) * HOUR + 'px' } }));
      // Нажатие на пустое место — новая запись на это время (с шагом 30 минут)
      col.addEventListener('click', (e) => {
        if (e.target.closest('.wv-block')) return;
        const rect = col.getBoundingClientRect();
        const min = top0 + Math.floor(((e.clientY - rect.top) / HOUR) * 2) * 30;
        if (d < t) return;
        openAppointmentForm({ date: d, start: min });
      });
      for (const a of appts.filter((x) => x.date === d)) {
        const [bg, fg] = BLOCK[a.status] || BLOCK.scheduled;
        const hgt = Math.max(18, y(a.start + a.duration) - y(a.start) - 2);
        col.appendChild(el('button', {
          class: 'wv-block' + (a.status === 'cancelled' ? ' cancelled' : ''), type: 'button',
          style: { top: y(a.start) + 1 + 'px', height: hgt + 'px', background: bg, borderLeftColor: fg },
          onclick: () => nav.push(AppointmentScreen, { id: a.id }),
        },
        el('span', { class: 'wv-b-time', style: { color: fg } }, fromMin(a.start)),
        el('span', { class: 'wv-b-name' }, clientsMap.get(a.clientId)?.name.split(' ')[0] || 'Клиент')));
      }
      return col;
    });
    grid.replaceChildren(axis, ...cols);
    return { revenue: revenueOf(appts) };
  }

  return { el: root, refresh };
}
