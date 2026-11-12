// Расписание → режим «Лента»: все будущие записи списком, сгруппированные по датам,
// с поиском и фильтром по статусу.

import * as data from '../db.js';
import { el, avatar, pressable, emptyState } from '../components/ui.js';
import { AppointmentScreen } from './appointment.js';
import { today, fromMin, formatDayShort } from '../utils/dates.js';
import { moneyFull } from '../utils/money.js';
import { servicesTitle, STATUSES, phoneDigits } from '../utils/appt.js';

const FILTERS = [
  { value: 'active', label: 'Активные' },
  { value: 'scheduled', label: STATUSES.scheduled.label },
  { value: 'confirmed', label: STATUSES.confirmed.label },
  { value: 'cancelled', label: STATUSES.cancelled.label },
  { value: 'all', label: 'Все' },
];

/** Сколько записей показывать за раз */
const PAGE = 150;

export function createFeedView(nav) {
  let filter = 'active';
  let limit = PAGE;
  const search = el('input', { class: 'input search-input', type: 'search', placeholder: 'Поиск по клиенту или услуге', autocomplete: 'off' });
  const chips = el('div', { class: 'feed-chips' });
  const list = el('div', { class: 'feed-list' });
  const root = el('div', { class: 'feed-view' }, search, chips, list);
  search.addEventListener('input', () => { limit = PAGE; refresh(); });

  function renderChips() {
    chips.replaceChildren(...FILTERS.map((f) => el('button', {
      class: 'chip' + (f.value === filter ? ' active-primary' : ''), type: 'button',
      onclick: () => { filter = f.value; limit = PAGE; refresh(); },
    }, f.label)));
  }

  async function refresh() {
    renderChips();
    const t = today();
    const [all, clientsMap] = await Promise.all([data.getAppointmentsBetween(t, '9999-12-31'), data.getClientsMap()]);
    const q = search.value.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const items = all.filter((a) => {
      if (filter === 'active' && (a.status === 'cancelled' || a.status === 'noshow')) return false;
      if (!['active', 'all'].includes(filter) && a.status !== filter) return false;
      if (!q) return true;
      const c = clientsMap.get(a.clientId);
      return (c?.name || '').toLowerCase().includes(q) || servicesTitle(a).toLowerCase().includes(q) ||
        (qd.length >= 3 && phoneDigits(c?.phone).includes(qd));
    }).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);

    list.replaceChildren();
    if (!items.length) {
      list.appendChild(emptyState({ title: q ? 'Ничего не найдено' : 'Будущих записей нет' }));
      return 0;
    }
    let curDate = '';
    for (const a of items.slice(0, limit)) {
      if (a.date !== curDate) {
        curDate = a.date;
        list.appendChild(el('div', { class: 'feed-date' }, (a.date === t ? 'Сегодня, ' : '') + formatDayShort(a.date)));
      }
      const c = clientsMap.get(a.clientId);
      list.appendChild(pressable(el('button', { class: 'feed-card appt' + (a.status === 'cancelled' ? ' cancelled' : ''), type: 'button', onclick: () => nav.push(AppointmentScreen, { id: a.id }) },
        el('div', { class: 'fc-times' }, el('span', { class: 'fc-start' }, fromMin(a.start)), el('span', { class: 'fc-end' }, fromMin(a.start + a.duration))),
        el('div', { class: 'fc-main' },
          el('div', { class: 'fc-name' }, c?.name || 'Клиент'),
          el('div', { class: 'fc-sub ellipsis' }, servicesTitle(a)),
          el('div', { class: 'fc-sub' }, moneyFull(a.total), el('span', { style: { color: STATUSES[a.status]?.color } }, ` · ${STATUSES[a.status]?.label || ''}`))),
        avatar(c, { size: 46, bell: !!a.reminderSentAt }))));
    }
    if (items.length > limit) {
      list.appendChild(el('button', { class: 'btn btn-outline', type: 'button', onclick: () => { limit += PAGE; refresh(); } }, `Показать ещё (${items.length - limit})`));
    }
    return items.length;
  }

  return { el: root, refresh };
}
