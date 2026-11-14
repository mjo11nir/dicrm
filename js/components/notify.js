// Уведомления клиентам и мастеру без сервера:
//  • offerClientMessage — лист после создания или переноса записи: отправить клиенту
//    подтверждение в WhatsApp (текст можно поправить);
//  • openTomorrowReminders — «Напоминания на завтра»: все записи на завтра, по кнопке
//    WhatsApp открывается с готовым напоминанием, запись помечается «напомнили»;
//  • openDailyReminderSetup — один раз добавить в Календарь iPhone повторяющееся
//    напоминание мастеру «Напомнить клиентам о завтрашних записях» (вечером перед рабочими днями).
//
// Само сообщение отправляет мастер — одним нажатием «Отправить» в WhatsApp.
// Отправка без участия человека требует сервера и WhatsApp Business API.

import * as data from '../db.js';
import { el, openSheet, toast, downloadFile, field } from './ui.js';
import { renderTemplate, templateVars, sendMessage, clientPhone } from '../messaging.js';
import { buildDailyReminderIcs } from '../utils/ics.js';
import { today, addDays, fromMin, formatDayShort, weekdayIndex } from '../utils/dates.js';
import { servicesTitle } from '../utils/appt.js';
import { isBlocking } from '../utils/slots.js';

/** Записи на завтра, о которых стоит напомнить клиенту */
export function tomorrowAppointments(appts, t = today()) {
  const tomorrow = addDays(t, 1);
  return appts.filter((a) => a.date === tomorrow && !a.deleted && isBlocking(a) && a.status !== 'completed' && a.status !== 'noshow')
    .sort((a, b) => a.start - b.start);
}

/** Данные для подстановки в шаблон по записи */
async function varsFor(a, client) {
  const [profile, locations] = await Promise.all([data.getProfile(), data.getAll('locations')]);
  const location = locations.find((l) => l.id === a.locationId) || locations[0];
  return templateVars({ client, appointment: a, profile, location });
}

/**
 * Лист после сохранения записи: отправить клиенту сообщение в WhatsApp.
 * @param {object} a — запись
 * @param {'confirmation'|'reschedule'} kind — шаблон
 */
export async function offerClientMessage(a, kind = 'confirmation') {
  const settings = await data.getSettings();
  if (settings.offerClientMessage === false) return;
  const client = await data.get('clients', a.clientId);
  const hasPhone = !!clientPhone(client);
  if (!client || (!hasPhone && !client.telegram)) return;

  const ta = el('textarea', { class: 'input', rows: 5 });
  ta.value = await renderTemplate(kind, await varsFor(a, client));
  const status = el('div', { class: 'hint center' });

  const send = async (channel) => {
    const text = ta.value.trim();
    if (!text) { toast('Текст не может быть пустым'); return; }
    const ok = await sendMessage({ client, text, channel, kind, appointmentId: a.id });
    if (!ok) { toast('У клиента нет телефона'); return; }
    // Подтверждение отправлено — запись считается подтверждённой
    const cur = await data.get('appointments', a.id);
    if (cur && cur.status === 'scheduled') await data.update('appointments', a.id, { status: 'confirmed' });
    status.textContent = channel === 'telegram' ? 'Текст скопирован — вставьте его в чат Telegram' : 'Сообщение открыто в WhatsApp ✓';
  };

  const buttons = el('div', { class: 'appt-actions' },
    hasPhone ? el('button', { class: 'btn btn-primary', type: 'button', onclick: () => send('whatsapp') }, 'Отправить в WhatsApp') : null,
    el('button', { class: 'btn btn-outline', type: 'button', onclick: () => send('telegram') }, 'Отправить в Telegram'),
    status);

  const sheet = openSheet({
    title: kind === 'reschedule' ? 'Сообщить о переносе' : 'Сообщить клиенту',
    cancelText: 'Не сейчас',
    content: el('div', { class: 'form' },
      el('div', { class: 'hint' }, `${client.name} · ${formatDayShort(a.date)}, ${fromMin(a.start)} · ${servicesTitle(a)}`),
      ta,
      buttons,
      el('button', { class: 'link-btn center', type: 'button', onclick: async () => {
        await data.setSetting('offerClientMessage', false);
        sheet.close();
        toast('Больше не спрашиваем. Включить: Уведомления для клиентов');
      } }, 'Больше не предлагать')),
  });
}

/** «Напоминания на завтра»: список записей с кнопкой отправки напоминания каждому клиенту */
export async function openTomorrowReminders() {
  const t = today();
  const [appts, clientsMap] = await Promise.all([data.getAppointmentsBetween(addDays(t, 1), addDays(t, 1)), data.getClientsMap()]);
  const list = tomorrowAppointments(appts, t);
  const body = el('div', { class: 'form' });

  if (!list.length) {
    body.appendChild(el('div', { class: 'hint center' }, 'На завтра записей нет.'));
  } else {
    body.appendChild(el('div', { class: 'hint' }, 'Нажмите «Напомнить» — откроется WhatsApp с готовым текстом, останется нажать «Отправить». Вернитесь в приложение и переходите к следующему клиенту.'));
    const group = el('div', { class: 'group' });
    for (const a of list) {
      const client = clientsMap.get(a.clientId);
      // Текст готовим заранее, чтобы по нажатию WhatsApp открылся сразу
      const text = client ? await renderTemplate('reminder', await varsFor(a, client)) : '';
      const mark = el('span', { class: 'row-value' });
      const btn = el('button', { class: 'btn small ' + (a.reminderSentAt ? 'btn-outline' : 'btn-primary'), type: 'button' });
      const setSent = (sent) => {
        btn.textContent = sent ? 'Ещё раз' : 'Напомнить';
        btn.className = 'btn small ' + (sent ? 'btn-outline' : 'btn-primary');
        mark.textContent = sent ? '✓' : '';
      };
      setSent(!!a.reminderSentAt);
      if (!clientPhone(client)) {
        btn.disabled = true;
        btn.textContent = 'Нет телефона';
      }
      btn.onclick = async () => {
        const ok = await sendMessage({ client, text, channel: 'whatsapp', kind: 'reminder', appointmentId: a.id });
        if (!ok) { toast('У клиента нет телефона'); return; }
        await data.update('appointments', a.id, { reminderSentAt: new Date().toISOString() });
        setSent(true);
      };
      group.appendChild(el('div', { class: 'row' },
        el('div', { class: 'row-text' },
          el('div', { class: 'row-title' }, `${fromMin(a.start)} · ${client?.name || 'Клиент'}`),
          el('div', { class: 'row-sub' }, servicesTitle(a))),
        mark, btn));
    }
    body.appendChild(el('div', { class: 'group-wrap' }, group));
  }

  openSheet({ title: 'Напоминания на завтра', content: body, full: list.length > 4 });
}

/** Дни недели (0 = пн), вечером которых напоминать: накануне каждого рабочего дня */
export function reminderWeekdays(schedule) {
  return schedule.filter((d) => d.isWorking).map((d) => (d.weekday + 6) % 7);
}

/** Настройка ежедневного напоминания мастеру через Календарь iPhone (делается один раз) */
export async function openDailyReminderSetup() {
  const [settings, { schedule }] = await Promise.all([data.getSettings(), data.getScheduleData()]);
  const timeIn = el('input', { class: 'input', type: 'time', step: 300, value: fromMin(settings.dailyReminderTime ?? 1080) });
  const days = reminderWeekdays(schedule);
  const names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  openSheet({
    title: 'Напоминание мне',
    content: el('div', { class: 'form' },
      el('div', { class: 'hint' }, 'Настраивается один раз. В Календаре iPhone появится повторяющееся событие «Напомнить клиентам о завтрашних записях» — каждый вечер перед рабочим днём придёт уведомление, даже если приложение закрыто. Откройте приложение и разошлите напоминания с Главной.'),
      el('div', { class: 'form-section' }, field('Во сколько напоминать', timeIn,
        days.length ? `Дни: ${days.sort().map((i) => names[i]).join(', ')} — накануне рабочих дней по графику` : 'В графике нет рабочих дней')),
      el('div', { class: 'hint' }, 'После нажатия откройте скачанный файл и нажмите «Добавить». Если поменяете время или график — добавьте ещё раз, событие обновится, а не продублируется.')),
    actionText: 'Добавить',
    cancelText: 'Отмена',
    onAction: async () => {
      if (!days.length) { toast('Сначала задайте рабочие дни в графике'); return false; }
      const [h, m] = (timeIn.value || '18:00').split(':').map(Number);
      const time = h * 60 + m;
      await data.setSetting('dailyReminderTime', time);
      await data.setSetting('dailyReminderAddedAt', new Date().toISOString());
      const url = location.href.split('#')[0].split('?')[0];
      // Первое событие — в ближайший день из правила (Календарь показывает и сам DTSTART)
      let from = today();
      while (!days.includes(weekdayIndex(from))) from = addDays(from, 1);
      downloadFile('napominanie.ics', buildDailyReminderIcs({ time, weekdays: days, from, url }), 'text/calendar');
      toast('Откройте файл — Календарь предложит добавить напоминание', { duration: 4500 });
      return true;
    },
  });
}
