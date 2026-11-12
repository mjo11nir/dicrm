// Вкладка «Расписание» (docs/screenshots/02-schedule-month.jpg).
// Режимы: «День» (здесь), «Неделя» (schedule-week.js), «Лента» (schedule-feed.js).

import * as data from '../db.js';
import { el, segmented, pressable, onSwipe, avatar } from '../components/ui.js';
import { createWeekView } from './schedule-week.js';
import { createFeedView } from './schedule-feed.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { openSlotChoice, openBreakForm, openDayHours, openSearch } from '../components/day-forms.js';
import { AppointmentScreen } from './appointment.js';
import { ScheduleSettingsScreen } from './schedule-settings.js';
import { getDayHours, getFreeIntervals, getFreeSlots, isBlocking } from '../utils/slots.js';
import {
  today, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, fromMin, formatDayShort, formatDuration,
  MONTHS, parseYmd,
} from '../utils/dates.js';
import { moneyFull } from '../utils/money.js';
import { revenueOf, servicesTitle, STATUSES } from '../utils/appt.js';

const LETTERS = ['п', 'в', 'с', 'ч', 'п', 'с', 'в'];

export function ScheduleScreen(params, nav) {
  let selected = params.date || today();
  let viewMonth = startOfMonth(selected);
  let collapsed = false;
  let mode = params.mode || 'day';

  const root = el('div', { class: 'page schedule' });

  // ---- Верх: переключатель режимов ----
  const seg = segmented({
    options: [{ value: 'day', label: 'День' }, { value: 'week', label: 'Неделя' }, { value: 'feed', label: 'Лента' }],
    value: mode,
    onChange: (v) => { mode = v; refresh(); root.closest('.screen')?.scrollTo(0, 0); },
  });
  const top = el('div', { class: 'sched-top' }, el('div', { class: 'seg-wrap' }, seg));

  // Неделя и Лента. Нажатие на день в неделе открывает этот день в режиме «День».
  const weekView = createWeekView(
    { ...nav, openDay: (d) => { selected = d; viewMonth = startOfMonth(d); mode = 'day'; seg.setValue('day'); refresh(); } },
    () => selected,
    (d) => { selected = d; viewMonth = startOfMonth(d); },
  );
  const feedView = createFeedView(nav);

  // ---- Месячный календарь ----
  const monthBtn = el('button', { class: 'month-title', type: 'button', onclick: () => { collapsed = !collapsed; refresh(); } });
  const grid = el('div', { class: 'month-grid' });
  const letters = el('div', { class: 'month-letters' }, LETTERS.map((l) => el('span', {}, l)));
  const infoLeft = el('div', { class: 'day-info-date' });
  const infoRight = el('button', { class: 'day-info-hours', type: 'button', onclick: () => openDayHours(selected) });
  const calendar = el('div', { class: 'cal-block' },
    monthBtn, letters, grid,
    el('div', { class: 'day-info' }, infoLeft, infoRight));
  onSwipe(grid, (dir) => {
    if (collapsed) {
      selected = addDays(selected, dir < 0 ? 7 : -7);
      viewMonth = startOfMonth(selected);
    } else {
      viewMonth = addMonths(viewMonth, dir < 0 ? 1 : -1);
    }
    refresh();
  });

  // ---- Лента дня ----
  const feed = el('div', { class: 'day-feed' });

  // ---- Нижняя панель ----
  const revenueVal = el('div', { class: 'sb-value' });
  const revenueLabel = el('div', { class: 'sb-label' }, 'Выручка за день');
  const bottom = el('div', { class: 'schedule-bottom' },
    el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Поиск', html: icon('search'), onclick: () => openSearch((id) => nav.push(AppointmentScreen, { id })) }),
    el('div', { class: 'sb-center' }, revenueLabel, revenueVal),
    el('button', { class: 'link-btn', type: 'button', onclick: () => { selected = today(); viewMonth = startOfMonth(selected); refresh(); } }, 'Сегодня'));

  root.append(top, calendar, feed, weekView.el, feedView.el, bottom);

  /** Перерисовать текущий режим */
  async function refresh() {
    calendar.hidden = mode !== 'day';
    feed.hidden = mode !== 'day';
    weekView.el.hidden = mode !== 'week';
    feedView.el.hidden = mode !== 'feed';
    root.dataset.mode = mode;
    if (mode === 'week') {
      const r = await weekView.refresh();
      revenueLabel.textContent = 'Выручка за неделю';
      revenueVal.textContent = moneyFull(r.revenue);
    } else if (mode === 'feed') {
      const n = await feedView.refresh();
      revenueLabel.textContent = 'Будущих записей';
      revenueVal.textContent = String(n);
    } else {
      revenueLabel.textContent = 'Выручка за день';
      await refreshDay();
    }
  }

  async function refreshDay() {
    const t = today();
    // Диапазон сетки: от понедельника первой недели месяца до воскресенья последней
    const gridFrom = collapsed ? startOfWeek(selected) : startOfWeek(viewMonth);
    const gridTo = collapsed ? addDays(gridFrom, 6) : addDays(startOfWeek(endOfMonth(viewMonth)), 6);
    // Выбранный день может быть вне показанного месяца (после свайпа) — его данные тоже нужны
    const qFrom = selected < gridFrom ? selected : gridFrom;
    const qTo = selected > gridTo ? selected : gridTo;
    const [{ schedule, exceptions }, appts, breaks, clientsMap, settings] = await Promise.all([
      data.getScheduleData(), data.getAppointmentsBetween(qFrom, qTo),
      data.getBreaksBetween(qFrom, qTo), data.getClientsMap(), data.getSettings(),
    ]);
    const shownMonth = collapsed ? startOfMonth(selected) : viewMonth;
    monthBtn.innerHTML = `${MONTHS[Number(shownMonth.slice(5, 7)) - 1]}${shownMonth.slice(0, 4) !== t.slice(0, 4) ? ' ' + shownMonth.slice(0, 4) : ''} <span class="chev${collapsed ? ' down' : ''}">${icon('chevronUp')}</span>`;

    // Сетка
    grid.replaceChildren();
    const now = new Date();
    for (let d = gridFrom; d <= gridTo; d = addDays(d, 1)) {
      const hours = getDayHours(d, schedule, exceptions);
      const hasAppts = appts.some((a) => a.date === d && isBlocking(a));
      const hasFree = hours.working && getFreeSlots({ date: d, hours, appointments: appts, breaks, now, slotDuration: settings.slotDuration }).length > 0;
      const other = !collapsed && d.slice(0, 7) !== viewMonth.slice(0, 7);
      const cls = ['md'];
      if (other) cls.push('other');
      if (!hours.working) cls.push('off');
      if (d === t) cls.push('today');
      else if (d === selected) cls.push('selected');
      const day = d;
      grid.appendChild(el('button', {
        class: cls.join(' '), type: 'button',
        onclick: () => { selected = day; if (!collapsed) viewMonth = startOfMonth(day); refresh(); },
      },
      el('span', { class: 'md-num' }, String(parseYmd(d).getDate())),
      el('span', { class: 'md-dots' }, hasAppts ? el('i', { class: 'dot gray' }) : null, hasFree ? el('i', { class: 'dot green' }) : null)));
    }

    // Строка с датой и часами
    const hours = getDayHours(selected, schedule, exceptions);
    infoLeft.textContent = selected === t ? `Сегодня ${formatDayShort(selected)}` : formatDayShort(selected);
    infoRight.innerHTML = `${hours.working ? `${fromMin(hours.start)} - ${fromMin(hours.end)}` : 'Выходной'} ${icon('chevronRight')}`;

    // Лента дня: записи, перерывы, свободные окна — строго по времени
    const dayAppts = appts.filter((a) => a.date === selected);
    const dayBreaks = breaks.filter((b) => b.date === selected);
    const items = [];
    for (const a of dayAppts) items.push({ t: a.start, kind: 'appt', a });
    for (const b of dayBreaks) items.push({ t: b.start, kind: 'break', b });
    for (const b of hours.breaks) items.push({ t: b.start, kind: 'sbreak', b });
    for (const f of getFreeIntervals({ date: selected, hours, appointments: dayAppts, breaks: dayBreaks, now })) items.push({ t: f.start, kind: 'free', f });
    items.sort((x, y) => x.t - y.t || (x.kind === 'free' ? 1 : -1));

    feed.replaceChildren();
    if (!items.length) {
      feed.appendChild(el('div', { class: 'feed-empty' },
        el('div', {}, hours.working ? (selected < t ? 'В этот день записей не было' : 'Нет записей') : 'Выходной день'),
        selected >= t ? el('button', { class: 'link-btn', type: 'button', onclick: () => openAppointmentForm({ date: selected }) }, 'Создать запись') : null));
    }
    for (const it of items) {
      if (it.kind === 'appt') feed.appendChild(apptCard(it.a, clientsMap.get(it.a.clientId)));
      else if (it.kind === 'break') {
        feed.appendChild(pressable(el('button', { class: 'feed-card break', type: 'button', onclick: () => openBreakForm({ brk: it.b }) },
          el('span', { class: 'break-ic', html: icon('coffee') }),
          el('span', {}, `Перерыв ${fromMin(it.b.start)}–${fromMin(it.b.end)}`), it.b.note ? el('span', { class: 'break-note' }, it.b.note) : null)));
      } else if (it.kind === 'sbreak') {
        feed.appendChild(pressable(el('button', { class: 'feed-card break', type: 'button', onclick: () => nav.push(ScheduleSettingsScreen) },
          el('span', { class: 'break-ic', html: icon('coffee') }),
          el('span', {}, `Перерыв ${fromMin(it.b.start)}–${fromMin(it.b.end)}`), el('span', { class: 'break-note' }, 'по графику'))));
      } else {
        const f = it.f;
        feed.appendChild(pressable(el('button', { class: 'feed-card free', type: 'button', onclick: () => openSlotChoice({ date: selected, start: f.start, end: f.end }) },
          el('div', { class: 'fc-times' }, el('span', { class: 'free-start' }, fromMin(f.start))),
          el('div', { class: 'fc-main' }, el('div', { class: 'free-title' }, 'создать запись или перерыв'), el('div', { class: 'fc-sub' }, `свободно: ${formatDuration(f.end - f.start)}`)))));
      }
    }

    revenueVal.textContent = moneyFull(revenueOf(dayAppts));
  }

  function apptCard(a, client) {
    const st = a.status === 'cancelled' || a.status === 'noshow' ? STATUSES[a.status].label : '';
    return pressable(el('button', { class: 'feed-card appt' + (a.status === 'cancelled' ? ' cancelled' : ''), type: 'button', onclick: () => nav.push(AppointmentScreen, { id: a.id }) },
      el('div', { class: 'fc-times' }, el('span', { class: 'fc-start' }, fromMin(a.start)), el('span', { class: 'fc-end' }, fromMin(a.start + a.duration))),
      el('div', { class: 'fc-main' },
        el('div', { class: 'fc-name' }, client?.name || 'Клиент'),
        el('div', { class: 'fc-sub ellipsis' }, servicesTitle(a)),
        el('div', { class: 'fc-sub' }, moneyFull(a.total), st ? el('span', { class: 'fc-status' }, ` · ${st}`) : null,
          a.status === 'completed' ? el('span', { class: 'fc-done' }, ' · завершена') : null)),
      avatar(client, { size: 46, bell: !!a.reminderSentAt })));
  }

  /** Снаружи (с Главной) можно открыть нужный день и режим */
  function setParams(p) {
    if (p?.date) {
      selected = p.date;
      viewMonth = startOfMonth(selected);
    }
    if (p?.mode) {
      mode = p.mode;
      seg.setValue(mode);
    }
    refresh();
  }

  refresh();
  return { el: root, refresh, setParams };
}
