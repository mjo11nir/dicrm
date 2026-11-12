// Шаблоны сообщений клиентам и отправка через WhatsApp / Telegram.
// Настоящей переписки без сервера нет: сообщение открывается в мессенджере
// с готовым текстом (wa.me / t.me), а копия сохраняется в таблицу messages.

import * as data from './db.js';
import { fromMin, formatDayShort } from './utils/dates.js';
import { moneyFull } from './utils/money.js';
import { fillTemplate, phoneDigits, servicesTitle } from './utils/appt.js';

/** Шаблоны по умолчанию. Переменные: {имя} {дата} {время} {услуга} {адрес} {цена} {окна} */
export const TEMPLATE_DEFS = [
  { key: 'reminder', title: 'Напоминание', hint: 'Отправляется из карточки записи кнопкой «Отправить напоминание».',
    text: 'Здравствуйте, {имя}! Напоминаем о записи {дата} в {время}: {услуга}. Адрес: {адрес}. До встречи!' },
  { key: 'confirmation', title: 'Подтверждение', hint: 'Подтверждение новой записи.',
    text: '{имя}, вы записаны на {услуга} {дата} в {время}. Стоимость: {цена}. Адрес: {адрес}.' },
  { key: 'freeSlots', title: 'Свободные окна', hint: 'Предложение свободного времени (в том числе для листа ожидания).',
    text: '{имя}, здравствуйте! Появилось свободное время для записи: {окна}. Хотите записаться?' },
  { key: 'birthday', title: 'Поздравление с ДР', hint: 'Поздравление с днём рождения.',
    text: '{имя}, с днём рождения! 🎉 Желаем красоты и прекрасного настроения. Дарим скидку на следующий визит!' },
  { key: 'comeBack', title: 'Пора записаться снова', hint: 'Клиентам, у которых подошёл срок повторного визита.',
    text: '{имя}, здравствуйте! Прошло уже немало времени с прошлого визита — пора обновить {услуга}. Записать вас?' },
];

export const TEMPLATE_VARS = ['{имя}', '{дата}', '{время}', '{услуга}', '{адрес}', '{цена}', '{окна}'];

/** Все шаблоны: сохранённые пользователем поверх стандартных. Map key → текст */
export async function getTemplates() {
  const [rows, settings] = await Promise.all([data.getAll('templates'), data.getSettings()]);
  const map = new Map(TEMPLATE_DEFS.map((t) => [t.key, t.text]));
  // Совместимость с этапом 1: напоминание хранилось в настройках
  if (settings.reminderTemplate && settings.reminderTemplate !== data.DEFAULT_SETTINGS.reminderTemplate) {
    map.set('reminder', settings.reminderTemplate);
  }
  for (const r of rows) map.set(r.key, r.text);
  return map;
}

/** Сохранить текст шаблона (null — вернуть стандартный) */
export async function saveTemplate(key, text) {
  const existing = (await data.getAll('templates')).find((t) => t.key === key);
  if (text === null) {
    if (existing) await data.remove('templates', existing.id);
    if (key === 'reminder') await data.setSetting('reminderTemplate', data.DEFAULT_SETTINGS.reminderTemplate);
    return;
  }
  await data.save('templates', { ...(existing || {}), key, text });
}

/** Переменные для подстановки из записи, клиента и профиля */
export function templateVars({ client = null, appointment = null, profile = null, location = null, slotsText = '' }) {
  return {
    имя: (client?.name || '').split(' ')[0],
    дата: appointment ? formatDayShort(appointment.date) : '',
    время: appointment ? fromMin(appointment.start) : '',
    услуга: appointment ? servicesTitle(appointment) : '',
    адрес: location?.address || profile?.address || '',
    цена: appointment ? moneyFull(appointment.total) : '',
    окна: slotsText,
  };
}

/** Подставить переменные в шаблон по ключу */
export async function renderTemplate(key, vars) {
  const templates = await getTemplates();
  return fillTemplate(templates.get(key) || '', vars);
}

/** Ссылка на мессенджер с готовым текстом */
export function messengerUrl(channel, client, text) {
  const digits = phoneDigits(client?.phone);
  if (channel === 'telegram') {
    // У Telegram нет надёжной ссылки «написать по номеру с текстом» — открываем чат, текст копируется
    if (client?.telegram) return `https://t.me/${client.telegram.replace(/^@/, '')}`;
    return digits ? `https://t.me/+${digits}` : null;
  }
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

/**
 * Отправить сообщение: открыть мессенджер и сохранить копию в истории.
 * @returns {Promise<boolean>} удалось ли открыть мессенджер
 */
export async function sendMessage({ client, text, channel = 'whatsapp', kind = 'custom', appointmentId = null }) {
  const url = messengerUrl(channel, client, text);
  if (!url) return false;
  if (channel === 'telegram') {
    try { await navigator.clipboard.writeText(text); } catch { /* буфер может быть недоступен */ }
  }
  window.open(url, '_blank', 'noopener');
  await data.save('messages', { clientId: client.id, appointmentId, channel, kind, text, at: new Date().toISOString() });
  return true;
}
