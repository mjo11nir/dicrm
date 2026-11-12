// «Клиенты»: алфавитный список с буквенными разделами, поиск, фильтры
// (новые, постоянные, давно не были, с ДР в этом месяце). Нажатие — карточка клиента.

import * as data from '../db.js';
import { el, navBar, avatar, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { ClientScreen, openClientForm } from './client.js';
import { formatDayShort } from '../utils/dates.js';
import { phoneDigits } from '../utils/appt.js';
import { clientStats, CLIENT_FILTERS, matchesFilter } from '../utils/clients.js';

export function ClientsScreen(params, nav) {
  let filter = params.filter || 'all';
  const root = el('div', { class: 'page' });
  const search = el('input', { class: 'input search-input', type: 'search', placeholder: 'Поиск по имени или телефону', autocomplete: 'off' });
  const chips = el('div', { class: 'feed-chips' });
  const count = el('div', { class: 'list-count' });
  const list = el('div', { class: 'clients-list' });
  root.append(
    navBar({ title: 'Клиенты', onBack: () => nav.pop(), right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить клиента', html: icon('plus'), onclick: () => openClientForm(null, { onSaved: (c) => nav.push(ClientScreen, { id: c.id }) }) }) }),
    el('div', { class: 'page-body' }, search, chips, count, list));
  search.addEventListener('input', () => render());

  let rows = [];
  async function refresh() {
    const [clients, appts] = await Promise.all([data.getAll('clients'), data.getAll('appointments')]);
    clients.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    // Записи группируем по клиенту один раз, чтобы не перебирать их для каждого
    const byClient = new Map();
    for (const a of appts) {
      if (!byClient.has(a.clientId)) byClient.set(a.clientId, []);
      byClient.get(a.clientId).push(a);
    }
    rows = clients.map((c) => ({ c, st: clientStats(c.id, byClient.get(c.id) || []) }));
    render();
  }

  function render() {
    chips.replaceChildren(...CLIENT_FILTERS.map((f) => el('button', {
      class: 'chip' + (f.value === filter ? ' active-primary' : ''), type: 'button',
      onclick: () => { filter = f.value; render(); },
    }, f.label)));
    const q = search.value.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const found = rows.filter(({ c, st }) => matchesFilter(c, st, filter) &&
      (!q || c.name.toLowerCase().includes(q) || (qd && phoneDigits(c.phone).includes(qd))));
    count.textContent = `Клиентов: ${found.length}`;
    list.replaceChildren();
    if (!found.length) {
      list.appendChild(emptyState({
        title: q || filter !== 'all' ? 'Никого не нашли' : 'Клиентов пока нет',
        action: { label: 'Добавить клиента', onClick: () => openClientForm(null, { name: search.value.trim() }) },
      }));
      return;
    }
    let letter = '';
    let group = null;
    for (const { c, st } of found) {
      const l = (c.name[0] || '#').toUpperCase();
      if (l !== letter) {
        letter = l;
        list.appendChild(el('div', { class: 'group-header' }, l));
        group = el('div', { class: 'group' });
        list.appendChild(group);
      }
      const sub = st.next ? `запись ${formatDayShort(st.next.date)}` : (st.lastVisit ? `был(а) ${formatDayShort(st.lastVisit)}` : (c.phone || 'без телефона'));
      group.appendChild(el('button', { class: 'row tappable', type: 'button', onclick: () => nav.push(ClientScreen, { id: c.id }) },
        avatar(c, { size: 36 }),
        el('div', { class: 'row-text' }, el('div', { class: 'row-title' }, c.name), el('div', { class: 'row-sub' }, sub)),
        el('span', { class: 'row-chevron', html: icon('chevronRight') })));
    }
  }

  refresh();
  return { el: root, refresh };
}
