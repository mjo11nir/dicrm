// Экран переписки с клиентом: история отправленных сообщений (хранится локально),
// быстрые шаблоны и отправка через WhatsApp / Telegram.

import * as data from '../db.js';
import { el, navBar, emptyState, toast } from '../components/ui.js';
import { ClientScreen } from './client.js';
import { TEMPLATE_DEFS, renderTemplate, templateVars, sendMessage } from '../messaging.js';
import { getFreeSlotsRange } from '../utils/slots.js';
import { today, addDays, ymd, formatDayShort, fromMinShort } from '../utils/dates.js';
import { phoneDigits } from '../utils/appt.js';

const CHANNEL = { whatsapp: 'WhatsApp', telegram: 'Telegram' };

/** Свободные окна на ближайшую неделю одной строкой — для шаблона «Свободные окна» */
export async function freeSlotsText(days = 7) {
  const from = today();
  const to = addDays(from, days - 1);
  const [{ schedule, exceptions }, appointments, breaks, settings] = await Promise.all([
    data.getScheduleData(), data.getAppointmentsBetween(from, to), data.getBreaksBetween(from, to), data.getSettings(),
  ]);
  const res = getFreeSlotsRange({ from, to, schedule, exceptions, appointments, breaks, slotDuration: settings.slotDuration });
  return res.map((d) => `${formatDayShort(d.date, true)} ${d.slots.map(fromMinShort).join(', ')}`).join('; ') || 'пока нет свободного времени';
}

export function ChatScreen({ clientId }, nav) {
  const root = el('div', { class: 'page chat-page' });
  const title = el('span', {});
  const history = el('div', { class: 'chat-history' });
  const ta = el('textarea', { class: 'input chat-input', rows: 3, placeholder: 'Сообщение или выберите шаблон' });
  const chips = el('div', { class: 'feed-chips chat-templates' });
  const sendRow = el('div', { class: 'btn-row' },
    el('button', { class: 'btn btn-primary', type: 'button', onclick: () => send('whatsapp') }, 'WhatsApp'),
    el('button', { class: 'btn btn-outline', type: 'button', onclick: () => send('telegram') }, 'Telegram'));
  const compose = el('div', { class: 'chat-compose' }, chips, ta, sendRow);
  root.append(
    navBar({ title, onBack: () => nav.pop(), right: el('button', { class: 'link-btn', type: 'button', onclick: () => nav.push(ClientScreen, { id: clientId }) }, 'Карточка') }),
    history, compose);

  let client = null;
  let lastKind = 'custom';

  async function refresh() {
    client = await data.get('clients', clientId);
    if (!client) {
      history.replaceChildren(emptyState({ title: 'Клиент удалён' }));
      compose.hidden = true;
      return;
    }
    title.textContent = client.name;
    const messages = (await data.getAll('messages')).filter((m) => m.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at));
    history.replaceChildren();
    if (!messages.length) {
      history.appendChild(emptyState({ title: 'Сообщений пока нет', text: 'Выберите шаблон или напишите текст. Сообщение откроется в WhatsApp или Telegram, а копия сохранится здесь.' }));
    }
    let day = '';
    for (const m of messages) {
      const d = ymd(new Date(m.at));
      if (d !== day) {
        day = d;
        history.appendChild(el('div', { class: 'chat-day' }, d === today() ? 'Сегодня' : formatDayShort(d)));
      }
      const time = new Date(m.at).toTimeString().slice(0, 5);
      history.appendChild(el('div', { class: 'bubble' },
        el('div', { class: 'bubble-text' }, m.text),
        el('div', { class: 'bubble-meta' }, `${CHANNEL[m.channel] || m.channel} · ${time}`)));
    }
    renderChips();
    if (!phoneDigits(client.phone) && !client.telegram) sendRow.replaceChildren(el('div', { class: 'hint' }, 'У клиента не указан телефон — добавьте его в карточке.'));
    requestAnimationFrame(() => root.closest('.screen')?.scrollTo(0, 1e6));
  }

  function renderChips() {
    chips.replaceChildren(...TEMPLATE_DEFS.map((t) => el('button', { class: 'chip', type: 'button', onclick: () => useTemplate(t.key) }, t.title)));
  }

  /** Подставить шаблон: данные берутся из ближайшей будущей записи (или последней) */
  async function useTemplate(key) {
    const [appts, profile, locations] = await Promise.all([data.getAll('appointments'), data.getProfile(), data.getAll('locations')]);
    const t = today();
    const mine = appts.filter((a) => a.clientId === clientId && a.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    const appointment = mine.find((a) => a.date >= t) || mine[mine.length - 1] || null;
    const slotsText = key === 'freeSlots' ? await freeSlotsText() : '';
    ta.value = await renderTemplate(key, templateVars({ client, appointment, profile, location: locations.find((l) => l.id === appointment?.locationId) || locations[0], slotsText }));
    lastKind = key;
    ta.focus();
  }

  async function send(channel) {
    const text = ta.value.trim();
    if (!text) { toast('Напишите сообщение или выберите шаблон'); return; }
    const ok = await sendMessage({ client, text, channel, kind: lastKind });
    if (!ok) { toast('У клиента нет телефона'); return; }
    ta.value = '';
    lastKind = 'custom';
    toast(channel === 'telegram' ? 'Текст скопирован — вставьте его в чат Telegram' : 'Открыт WhatsApp, сообщение сохранено', { duration: 4000 });
  }

  ta.addEventListener('input', () => { if (!ta.value) lastKind = 'custom'; });
  refresh();
  return { el: root, refresh };
}

