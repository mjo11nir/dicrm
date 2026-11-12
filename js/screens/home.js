// Экран «Главная» (docs/screenshots/01-home.jpg).

import * as data from '../db.js';
import { el, html, esc, pressable, onSwipe } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { StatsScreen } from './stats.js';
import { TemplatesScreen } from './templates.js';
import { openFreeSlots } from './free-slots.js';
import { AppointmentScreen } from './appointment.js';
import { AlertsScreen } from './alerts.js';
import { HelpScreen } from './help.js';
import { ClientsScreen } from './clients.js';
import { BackupScreen, backupDue } from './backup.js';
import { getDayHours } from '../utils/slots.js';
import {
  today, addDays, startOfWeek, startOfMonth, endOfMonth, fromMin, formatDayShort,
  WEEKDAYS_LETTER, MONTHS, MONTHS_IN, parseYmd,
} from '../utils/dates.js';
import { money } from '../utils/money.js';
import { revenueOf, servicesTitle, countsInRevenue } from '../utils/appt.js';

export function HomeScreen(params, nav) {
  let selected = today();
  let weekStart = startOfWeek(selected);

  const root = el('div', { class: 'page home' });

  // ---- Шапка-карточка ----
  const avatarEl = el('div', { class: 'home-avatar' });
  const nameEl = el('div', { class: 'home-name' });
  const badgeEl = el('span', { class: 'home-badge' });
  const dateEl = el('div', { class: 'home-date' });
  const header = el('div', { class: 'home-head' },
    avatarEl,
    el('div', { class: 'home-id' }, el('div', { class: 'home-id-top' }, nameEl, dateEl), badgeEl),
    el('div', { class: 'home-head-icons' },
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Вид недели', html: icons.columns, onclick: () => nav.switchTab('schedule', { date: selected, mode: 'week' }) }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Календарь', html: icons.calendarAlt, onclick: () => nav.switchTab('schedule', { date: selected, mode: 'day' }) }),
      el('button', { class: 'icon-btn bell', type: 'button', 'aria-label': 'Оповещения', html: icons.bellFill, onclick: () => nav.push(AlertsScreen) })));

  // ---- Полоса недели и записи дня ----
  const week = el('div', { class: 'week-strip' });
  onSwipe(week, (dir) => { weekStart = addDays(weekStart, dir < 0 ? 7 : -7); selected = addDays(weekStart, 0); if (weekStart <= today() && today() < addDays(weekStart, 7)) selected = today(); refresh(); });
  const dayList = el('div', { class: 'day-list' });
  const revenueEl = el('div', { class: 'day-revenue' });
  const dayCard = el('div', { class: 'card home-day' }, header, week, dayList, revenueEl);

  // ---- Кнопка «Создать запись» ----
  const createCard = pressable(el('button', { class: 'card create-card', type: 'button', onclick: () => openAppointmentForm({ date: selected >= today() ? selected : today() }) },
    el('span', { class: 'plus-circle', html: icons.plus }), el('span', {}, 'Создать запись')));

  // ---- Клиенты и Финансы ----
  const clientsCard = pressable(el('button', { class: 'card stat-card', type: 'button', onclick: () => nav.push(ClientsScreen) }));
  const financeCard = pressable(el('button', { class: 'card stat-card', type: 'button', onclick: () => nav.push(StatsScreen) }));

  // ---- Быстрые действия ----
  const tile = (ic, bg, color, label, onClick) => pressable(el('button', { class: 'qa', type: 'button', onclick: onClick },
    el('span', { class: 'qa-ic', style: { background: bg, color }, html: icons[ic] }), el('span', { class: 'qa-label' }, label)));
  const quick = el('div', { class: 'card quick' },
    tile('calendarPlusFill', 'var(--pastel-yellow)', 'var(--orange)', 'Создать запись', () => openAppointmentForm({ date: selected >= today() ? selected : today() })),
    tile('calendarSlot', 'var(--pastel-yellow)', 'var(--orange)', 'Свободные окна', () => openFreeSlots()),
    tile('chat', 'var(--pastel-green)', 'var(--green)', 'Уведомления', () => nav.push(TemplatesScreen)),
    tile('help', 'var(--pastel-gray)', '#8A8A8E', 'Помощь', () => nav.push(HelpScreen)));

  // Напоминание о резервной копии (раз в 7 дней)
  const backupCard = el('div', { class: 'card backup-card', hidden: true },
    el('button', { class: 'backup-main', type: 'button', onclick: () => nav.push(BackupScreen) },
      el('b', {}, 'Пора сделать резервную копию'),
      el('span', {}, 'Данные хранятся только на этом телефоне — сохраните копию в «Файлы».')),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Напомнить завтра', html: icons.x, onclick: () => {
      // «Позже» — следующее напоминание через сутки
      const s0 = nav.app.settings || {};
      const base = new Date(Date.now() - (7 - 1) * 86400000).toISOString();
      if (!s0.lastBackupAt || s0.lastBackupAt < base) data.setSetting('lastBackupAt', base);
      backupCard.hidden = true;
    } }));

  root.append(dayCard, backupCard, createCard, el('div', { class: 'two-cards' }, clientsCard, financeCard), quick);

  // Сжатие шапки при прокрутке: имя уходит, появляется дата выбранного дня
  requestAnimationFrame(() => {
    const scroller = root.closest('.screen');
    scroller?.addEventListener('scroll', () => header.classList.toggle('compact', scroller.scrollTop > 30), { passive: true });
  });

  async function refresh() {
    const t = today();
    const [profile, { schedule, exceptions }, dayAppts, clientsMap, monthAppts] = await Promise.all([
      data.getProfile(), data.getScheduleData(), data.getAppointmentsByDate(selected),
      data.getClientsMap(), data.getAppointmentsBetween(startOfMonth(t), endOfMonth(t)),
    ]);

    // Фон Главной можно выключить в настройках
    root.classList.toggle('no-bg', nav.app.settings?.homeBackground === false);
    backupCard.hidden = !backupDue(nav.app.settings || {});

    // Шапка
    avatarEl.replaceChildren(profile.avatar ? el('img', { src: profile.avatar, alt: '' }) : html(`<span class="home-logo">${logoSvg()}</span>`));
    nameEl.textContent = profile.name;
    badgeEl.textContent = profile.badge || 'PRO';
    dateEl.textContent = formatDayShort(selected);

    // Неделя
    week.replaceChildren();
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const off = !getDayHours(d, schedule, exceptions).working;
      week.appendChild(el('button', {
        class: 'wd' + (off ? ' off' : '') + (d === selected ? ' selected' : '') + (d === t ? ' today' : ''),
        type: 'button', onclick: () => { selected = d; refresh(); },
      }, el('span', { class: 'wd-letter' }, WEEKDAYS_LETTER[i]), el('span', { class: 'wd-num' }, String(parseYmd(d).getDate()))));
    }

    // Записи дня
    const list = dayAppts.filter((a) => a.status !== 'cancelled').sort((a, b) => a.start - b.start);
    dayList.replaceChildren();
    if (!list.length) {
      dayList.appendChild(el('div', { class: 'day-empty' }, el('span', {}, 'Нет записей'), ' ',
        el('button', { class: 'link-btn', type: 'button', onclick: () => openAppointmentForm({ date: selected }) }, 'Создать')));
    }
    for (const a of list) {
      dayList.appendChild(pressable(el('button', { class: 'home-appt', type: 'button', onclick: () => nav.push(AppointmentScreen, { id: a.id }) },
        el('div', { class: 'ha-times' }, el('span', { class: 'ha-start' }, fromMin(a.start)), el('span', { class: 'ha-end' }, fromMin(a.start + a.duration))),
        el('div', { class: 'ha-text' },
          el('span', { class: 'ha-name' }, clientsMap.get(a.clientId)?.name || 'Клиент'),
          el('span', { class: 'ha-svc' }, servicesTitle(a))))));
    }
    revenueEl.textContent = `Выручка: ${money(revenueOf(list))}`;

    // Клиенты
    const clients = [...clientsMap.values()];
    const monthStart = startOfMonth(t);
    const newCount = clients.filter((c) => c.createdAt && new Date(c.createdAt) >= parseYmd(monthStart)).length;
    const monthIdx = Number(t.slice(5, 7)) - 1;
    clientsCard.innerHTML = `<div class="stat-title">Клиенты</div><div class="stat-big">${clients.length}</div>
      <div class="stat-sub">Всего в базе</div><div class="stat-growth"><b>+${newCount}</b> в ${esc(MONTHS_IN[monthIdx])}</div>`;

    // Финансы: зелёное — получено (завершённые), фиолетовое — запланировано
    const counted = monthAppts.filter(countsInRevenue);
    const done = counted.filter((a) => a.status === 'completed').reduce((s, a) => s + a.total, 0);
    const planned = counted.filter((a) => a.status !== 'completed').reduce((s, a) => s + a.total, 0);
    const total = done + planned;
    const donePct = total ? Math.round((done / total) * 100) : 0;
    financeCard.innerHTML = `<div class="stat-title">Финансы</div><div class="stat-sub top">${esc(MONTHS[monthIdx])}</div>
      <div class="stat-big">${esc(money(total))}</div>
      <div class="fin-bar" aria-label="Получено ${donePct}%"><span class="fin-done" style="width:${donePct}%"></span><span class="fin-plan" style="width:${total ? 100 - donePct : 0}%"></span></div>`;
  }

  /** Снаружи можно попросить показать конкретную дату */
  function setParams(p) {
    if (p?.date) { selected = p.date; weekStart = startOfWeek(selected); refresh(); }
  }

  refresh();
  return { el: root, refresh, setParams, onShow: () => {} };
}

/** Простой логотип приложения: буква «B» и капля лака */
let logoSeq = 0;
export function logoSvg() {
  // Уникальный id градиента: одинаковые id ломают отрисовку, если первый логотип в скрытой вкладке
  const id = `logo-grad-${++logoSeq}`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B57BF5"/><stop offset="1" stop-color="#9137E8"/></linearGradient></defs>
    <path d="M24 6c6 8 12 14.5 12 22a12 12 0 0 1-24 0C12 20.5 18 14 24 6z" fill="url(#${id})"/>
    <path d="M19 28c0 3.5 2.3 6 5.5 6.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".85"/></svg>`;
}
