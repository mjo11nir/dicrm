// Вкладка «Чаты». Полноценный раздел (список клиентов, история сообщений, шаблоны) — этап 3.
// Сейчас показываем историю отправленных напоминаний, чтобы вкладка была полезной.

import * as data from '../db.js';
import { el, avatar, emptyState } from '../components/ui.js';
import { formatDayShort, ymd } from '../utils/dates.js';

export function ChatsScreen(params, nav) {
  const root = el('div', { class: 'page more' });
  const list = el('div', {});
  root.append(el('h1', { class: 'large-title' }, 'Чаты'), list);

  async function refresh() {
    const [messages, clientsMap] = await Promise.all([data.getAll('messages'), data.getClientsMap()]);
    messages.sort((a, b) => b.at.localeCompare(a.at));
    list.replaceChildren();
    if (!messages.length) {
      list.appendChild(emptyState({
        title: 'Сообщений пока нет',
        text: 'Напоминания клиентам отправляются из карточки записи через WhatsApp и появляются здесь. Шаблоны и полноценные чаты с клиентами появятся в следующем обновлении.',
      }));
      return;
    }
    for (const m of messages.slice(0, 100)) {
      const c = clientsMap.get(m.clientId);
      list.appendChild(el('div', { class: 'chat-row card' },
        avatar(c, { size: 44 }),
        el('div', { class: 'chat-text' },
          el('div', { class: 'chat-top' }, el('b', {}, c?.name || 'Клиент'), el('span', { class: 'chat-date' }, formatDayShort(ymd(new Date(m.at))))),
          el('div', { class: 'chat-msg' }, m.text))));
    }
  }

  refresh();
  return { el: root, refresh };
}
