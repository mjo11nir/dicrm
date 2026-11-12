// Вкладка «Чаты»: клиенты, отсортированные по последнему контакту (сообщение или запись),
// с аватаркой, именем, последней записью и датой. Нажатие — экран переписки.

import * as data from '../db.js';
import { el, avatar, emptyState, pressable } from '../components/ui.js';
import { ChatScreen } from './chat.js';
import { formatDayShort, ymd, today } from '../utils/dates.js';
import { servicesTitle, phoneDigits } from '../utils/appt.js';

export function ChatsScreen(params, nav) {
  const root = el('div', { class: 'page more' });
  const search = el('input', { class: 'input search-input', type: 'search', placeholder: 'Поиск по имени или телефону', autocomplete: 'off' });
  const list = el('div', { class: 'chat-list' });
  root.append(el('h1', { class: 'large-title' }, 'Чаты'), el('div', { class: 'chat-search' }, search), list);
  search.addEventListener('input', () => render());

  let rows = [];
  async function refresh() {
    const [clients, messages, appts] = await Promise.all([data.getAll('clients'), data.getAll('messages'), data.getAll('appointments')]);
    const t = today();
    const lastMsg = new Map();
    for (const m of messages) if (!lastMsg.has(m.clientId) || lastMsg.get(m.clientId).at < m.at) lastMsg.set(m.clientId, m);
    // Последняя запись клиента, которая уже была (или ближайшая будущая, если прошлых нет)
    const lastAppt = new Map();
    for (const a of appts) {
      if (a.status === 'cancelled') continue;
      const cur = lastAppt.get(a.clientId);
      const better = !cur || (a.date <= t && (cur.date > t || a.date > cur.date)) || (a.date > t && cur.date > t && a.date < cur.date);
      if (better) lastAppt.set(a.clientId, a);
    }
    rows = clients.map((c) => {
      const m = lastMsg.get(c.id);
      const a = lastAppt.get(c.id);
      // Ключ сортировки — самый свежий контакт
      const key = [m ? m.at.slice(0, 10) : '', a && a.date <= t ? a.date : '', (c.createdAt || '').slice(0, 10)].sort().pop();
      return { c, m, a, key };
    }).sort((x, y) => y.key.localeCompare(x.key) || x.c.name.localeCompare(y.c.name, 'ru'));
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const found = rows.filter(({ c }) => !q || c.name.toLowerCase().includes(q) || (qd && phoneDigits(c.phone).includes(qd)));
    list.replaceChildren();
    if (!found.length) {
      list.appendChild(emptyState({ title: q ? 'Никого не нашли' : 'Клиентов пока нет' }));
      return;
    }
    for (const { c, m, a } of found.slice(0, 200)) {
      const sub = m ? m.text : (a ? `${servicesTitle(a)}` : 'Записей пока нет');
      const date = m ? formatDayShort(ymd(new Date(m.at))) : (a ? formatDayShort(a.date) : '');
      list.appendChild(pressable(el('button', { class: 'chat-row card', type: 'button', onclick: () => nav.push(ChatScreen, { clientId: c.id }) },
        avatar(c, { size: 48 }),
        el('div', { class: 'chat-text' },
          el('div', { class: 'chat-top' }, el('b', {}, c.name), el('span', { class: 'chat-date' }, date)),
          el('div', { class: 'chat-msg' }, sub)))));
    }
  }

  refresh();
  return { el: root, refresh };
}
