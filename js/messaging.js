// Шаблоны сообщений клиентам и отправка через WhatsApp / Telegram.
// Настоящей переписки без сервера нет: сообщение открывается в мессенджере
// с готовым текстом, а копия сохраняется в таблицу messages.
//
// На телефоне WhatsApp открывается схемой whatsapp:// — сразу в приложении, без страницы wa.me.
// Переход по схеме не считается всплывающим окном, поэтому Safari не блокирует его,
// даже если перед этим текст готовился асинхронно. Если WhatsApp не открылся за 2 секунды,
// появляется кнопка «Открыть через wa.me».

import * as data from './db.js';
import { toast } from './components/ui.js';
import { fromMin, formatDayShort } from './utils/dates.js';
import { moneyFull } from './utils/money.js';
import { fillTemplate, servicesTitle } from './utils/appt.js';
import { waPhone, whatsappUrl, telegramUrl, guessCountryCode, isMobileDevice } from './utils/phone.js';

/** Шаблоны по умолчанию. Переменные: {имя} {дата} {время} {услуга} {адрес} {цена} {окна} */
export const TEMPLATE_DEFS = [
  { key: 'reminder', title: 'Напоминание', hint: 'Напоминание за день до записи: «Напоминания на завтра» на Главной и в «Оповещениях», а также кнопка в карточке записи.',
    text: 'Здравствуйте, {имя}! Напоминаем о записи {дата} в {время}: {услуга}. Адрес: {адрес}. До встречи!' },
  { key: 'confirmation', title: 'Подтверждение', hint: 'Предлагается отправить сразу после создания записи и из карточки записи.',
    text: '{имя}, вы записаны на {услуга} {дата} в {время}. Стоимость: {цена}. Адрес: {адрес}.' },
  { key: 'reschedule', title: 'Перенос записи', hint: 'Предлагается отправить после переноса записи на другое время.',
    text: '{имя}, ваша запись перенесена: {услуга} {дата} в {время}. Адрес: {адрес}. Если время неудобно — напишите мне.' },
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

// ---------- Номер телефона ----------

/** Код страны по умолчанию: из настроек, иначе по телефону мастера в профиле */
let countryCode = '';

/** Вызывается из app.js при запуске и после изменения настроек */
export function configureMessaging(settings, profile) {
  countryCode = defaultCountryCode(settings, profile);
}

export function defaultCountryCode(settings, profile) {
  const own = String(settings?.phoneCountryCode ?? '').replace(/\D/g, '');
  return own || guessCountryCode(profile?.phone);
}

/** Номер клиента в международном формате (только цифры) */
export function clientPhone(client) {
  return waPhone(client?.phone, countryCode);
}

// ---------- Открытие мессенджеров ----------

/** Ссылка на чат WhatsApp (для кнопок в карточках клиента и записи) */
export function whatsappChatUrl(client, text = '') {
  return whatsappUrl(clientPhone(client), text, { app: isMobileDevice() });
}

/** Ссылка на мессенджер с готовым текстом */
export function messengerUrl(channel, client, text) {
  const digits = clientPhone(client);
  // У Telegram нет надёжной ссылки «написать по номеру с текстом» — открываем чат, текст копируется
  if (channel === 'telegram') return telegramUrl(digits, client?.telegram);
  return whatsappUrl(digits, text, { app: isMobileDevice() });
}

/**
 * Открыть ссылку мессенджера. Схема приложения (whatsapp://) открывается переходом,
 * https — в новой вкладке. Если приложение не открылось, предлагаем запасную ссылку.
 */
export function openExternal(url, fallbackUrl = null) {
  if (/^https?:/.test(url)) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  let left = false;
  const mark = () => { left = true; };
  const onVis = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', mark);
  window.addEventListener('pagehide', mark);
  location.href = url;
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', mark);
    window.removeEventListener('pagehide', mark);
    if (left || !fallbackUrl) return;
    toast('WhatsApp не открылся', {
      duration: 8000,
      action: { label: 'Через wa.me', onClick: () => { window.open(fallbackUrl, '_blank', 'noopener'); } },
    });
  }, 2000);
}

/** Открыть чат WhatsApp с клиентом (без сохранения в историю) */
export function openWhatsApp(client, text = '') {
  const digits = clientPhone(client);
  const url = whatsappUrl(digits, text, { app: isMobileDevice() });
  if (!url) return false;
  openExternal(url, whatsappUrl(digits, text, { app: false }));
  return true;
}

/**
 * Отправить сообщение: открыть мессенджер и сохранить копию в истории.
 * Мессенджер открывается сразу, до записи в базу, — пока действует нажатие пользователя.
 * @returns {Promise<boolean>} удалось ли открыть мессенджер
 */
export async function sendMessage({ client, text, channel = 'whatsapp', kind = 'custom', appointmentId = null }) {
  if (channel === 'telegram') {
    const url = messengerUrl('telegram', client, text);
    if (!url) return false;
    // Копируем текст до открытия: Safari разрешает запись в буфер только сразу после нажатия
    const copied = navigator.clipboard?.writeText(text).catch(() => {});
    window.open(url, '_blank', 'noopener');
    await copied;
  } else if (!openWhatsApp(client, text)) {
    return false;
  }
  await data.save('messages', { clientId: client.id, appointmentId, channel, kind, text, at: new Date().toISOString() });
  return true;
}
