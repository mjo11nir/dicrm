// Небольшие листы для быстрых действий Главной:
// ближайшие свободные окна, шаблон напоминания, финансы месяца.

import * as data from '../db.js';
import { el, openSheet, toast, groupedList, emptyState } from './ui.js';
import { openAppointmentForm } from './appointment-form.js';
import { getFreeSlotsRange } from '../utils/slots.js';
import { today, addDays, fromMinShort, formatDayShort, MONTHS, startOfMonth, endOfMonth } from '../utils/dates.js';
import { moneyFull } from '../utils/money.js';
import { countsInRevenue } from '../utils/appt.js';

/** Ближайшие свободные окна на 14 дней — нажатие на время открывает форму записи */
export async function openNearestSlots() {
  const from = today();
  const to = addDays(from, 13);
  const [{ schedule, exceptions }, appointments, breaks, settings] = await Promise.all([
    data.getScheduleData(), data.getAppointmentsBetween(from, to), data.getBreaksBetween(from, to), data.getSettings(),
  ]);
  const days = getFreeSlotsRange({ from, to, schedule, exceptions, appointments, breaks, slotDuration: settings.slotDuration });
  const content = el('div', { class: 'form' });
  content.appendChild(el('div', { class: 'hint' }, `Свободное время на ближайшие 2 недели (окна по ${settings.slotDuration} мин). Нажмите на время, чтобы записать клиента.`));
  if (!days.length) content.appendChild(emptyState({ title: 'Свободных окон нет', text: 'Все рабочие часы на 2 недели заняты.' }));
  const sheetRef = {};
  for (const d of days) {
    content.appendChild(el('div', { class: 'slot-day' },
      el('div', { class: 'slot-day-title' }, formatDayShort(d.date, true)),
      el('div', { class: 'slot-times' }, d.slots.map((s) => el('button', {
        class: 'slot-time', type: 'button',
        onclick: () => { sheetRef.s.close(); openAppointmentForm({ date: d.date, start: s }); },
      }, fromMinShort(s))))));
  }
  sheetRef.s = openSheet({ title: 'Свободные окна', content, full: true });
}

/** Редактор шаблона напоминания клиенту */
export async function openReminderTemplate() {
  const settings = await data.getSettings();
  const ta = el('textarea', { class: 'input', rows: 5 });
  ta.value = settings.reminderTemplate;
  const vars = ['{имя}', '{дата}', '{время}', '{услуга}', '{адрес}', '{цена}'];
  const content = el('div', { class: 'form' },
    el('div', { class: 'hint' }, 'Этот текст подставляется в WhatsApp, когда вы нажимаете «Отправить напоминание» в карточке записи.'),
    ta,
    el('div', { class: 'var-chips' }, vars.map((v) => el('button', { class: 'chip', type: 'button', onclick: () => {
      const pos = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, pos) + v + ta.value.slice(ta.selectionEnd ?? pos);
      ta.focus();
    } }, v))),
    el('button', { class: 'link-btn', type: 'button', onclick: () => { ta.value = data.DEFAULT_SETTINGS.reminderTemplate; } }, 'Вернуть текст по умолчанию'));
  openSheet({
    title: 'Напоминание клиенту',
    content,
    actionText: 'Сохранить',
    cancelText: 'Отмена',
    onAction: async () => {
      if (!ta.value.trim()) { toast('Текст не может быть пустым'); return false; }
      await data.setSetting('reminderTemplate', ta.value.trim());
      toast('Шаблон сохранён');
      return true;
    },
  });
}

/** Финансы текущего месяца: получено, запланировано, отмены */
export async function openMonthFinance() {
  const t = today();
  const from = startOfMonth(t);
  const to = endOfMonth(t);
  const appts = await data.getAppointmentsBetween(from, to);
  const done = appts.filter((a) => a.status === 'completed');
  const planned = appts.filter((a) => countsInRevenue(a) && a.status !== 'completed');
  const sum = (arr) => arr.reduce((s, a) => s + (a.total || 0), 0);
  const content = el('div', { class: 'form' },
    groupedList([
      { title: 'Получено', subtitle: `Завершённых записей: ${done.length}`, value: moneyFull(sum(done)) },
      { title: 'Запланировано', subtitle: `Предстоящих записей: ${planned.length}`, value: moneyFull(sum(planned)) },
      { title: 'Всего за месяц', value: moneyFull(sum(done) + sum(planned)) },
      { title: 'Отмены и неявки', value: String(appts.filter((a) => a.status === 'cancelled' || a.status === 'noshow').length) },
    ], { footer: 'Подробная статистика с графиками появится в разделе «Статистика».' }));
  openSheet({ title: `Финансы · ${MONTHS[Number(t.slice(5, 7)) - 1]}`, content });
}
