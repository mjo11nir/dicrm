// Формы, связанные с днём расписания: выбор «Запись / Перерыв» для свободного окна,
// перерыв, часы работы конкретного дня, поиск по записям и клиентам.

import * as data from '../db.js';
import { el, openSheet, toast, actionSheet, field, toggle, groupedList } from './ui.js';
import { openAppointmentForm } from './appointment-form.js';
import { getDayHours } from '../utils/slots.js';
import { toMin, fromMin, formatDayShort, formatDuration } from '../utils/dates.js';
import { servicesTitle, STATUSES } from '../utils/appt.js';
import { moneyFull } from '../utils/money.js';

/** Лист выбора «Запись / Перерыв» для свободного окна */
export function openSlotChoice({ date, start, end }) {
  actionSheet({
    title: `${formatDayShort(date)}, ${fromMin(start)}`,
    message: `Свободно: ${formatDuration(end - start)}`,
    actions: [
      { label: 'Запись', bold: true, onClick: () => openAppointmentForm({ date, start }) },
      { label: 'Перерыв', onClick: () => openBreakForm({ date, start, end: Math.min(end, start + 60) }) },
    ],
  });
}

/** Создание или изменение разового перерыва */
export function openBreakForm({ date, start, end, brk = null }) {
  const startIn = el('input', { class: 'input', type: 'time', step: 300, value: fromMin(brk?.start ?? start) });
  const endIn = el('input', { class: 'input', type: 'time', step: 300, value: fromMin(brk?.end ?? end) });
  const noteIn = el('input', { class: 'input', type: 'text', placeholder: 'Например: обед', value: brk?.note || '' });
  const content = el('div', { class: 'form' },
    el('div', { class: 'form-section' },
      el('div', { class: 'form-section-title' }, formatDayShort(brk?.date || date)),
      el('div', { class: 'grid2' }, field('Начало', startIn), field('Конец', endIn)),
      field('Заметка', noteIn)));
  if (brk) {
    content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
      await data.remove('breaks', brk.id);
      sheet.close();
      toast('Перерыв удалён', { undo: () => data.restore('breaks', brk.id) });
    } }, 'Удалить перерыв'));
  }
  const sheet = openSheet({
    title: brk ? 'Перерыв' : 'Новый перерыв',
    content,
    actionText: 'Сохранить',
    cancelText: 'Отмена',
    onAction: async () => {
      const s = toMin(startIn.value || '00:00');
      const e = toMin(endIn.value || '00:00');
      if (e <= s) { toast('Конец перерыва должен быть позже начала'); return false; }
      await data.save('breaks', { ...(brk || {}), date: brk?.date || date, start: s, end: e, note: noteIn.value.trim() });
      toast(brk ? 'Перерыв сохранён' : 'Перерыв добавлен');
      return true;
    },
  });
}

/** Часы работы только для одного дня (исключение из графика) */
export async function openDayHours(date) {
  const { schedule, exceptions } = await data.getScheduleData();
  const hours = getDayHours(date, schedule, exceptions);
  const own = hours.exception && hours.exception.dateFrom === date && (hours.exception.dateTo || date) === date ? hours.exception : null;

  let working = hours.working;
  const startIn = el('input', { class: 'input', type: 'time', step: 300, value: fromMin(hours.working ? hours.start : 540) });
  const endIn = el('input', { class: 'input', type: 'time', step: 300, value: fromMin(hours.working ? hours.end : 1140) });
  const timeRow = el('div', { class: 'grid2' }, field('Начало', startIn), field('Конец', endIn));
  timeRow.hidden = !working;

  const content = el('div', { class: 'form' },
    groupedList([{ title: 'Рабочий день', control: toggle(working, (v) => { working = v; timeRow.hidden = !v; }) }],
      { footer: 'Изменения касаются только этого дня. Общий график меняется в «Другое → Профиль и настройки → График и место работы».' }),
    el('div', { class: 'form-section' }, timeRow));
  if (hours.exception) {
    content.appendChild(el('button', { class: 'btn btn-outline', type: 'button', onclick: async () => {
      await data.remove('scheduleExceptions', hours.exception.id);
      sheet.close();
      toast('День возвращён к обычному графику');
    } }, hours.exception.kind === 'off' && hours.exception.dateFrom !== hours.exception.dateTo ? 'Убрать отпуск' : 'Вернуть обычный график'));
  }

  const sheet = openSheet({
    title: formatDayShort(date),
    content,
    actionText: 'Сохранить',
    cancelText: 'Отмена',
    onAction: async () => {
      const s = toMin(startIn.value || '09:00');
      const e = toMin(endIn.value || '19:00');
      if (working && e <= s) { toast('Конец дня должен быть позже начала'); return false; }
      const rec = working
        ? { kind: 'hours', dateFrom: date, dateTo: date, start: fromMin(s), end: fromMin(e) }
        : { kind: 'off', dateFrom: date, dateTo: date, note: 'Выходной' };
      // Если у дня уже было своё исключение — обновляем его, иначе создаём новое
      await data.save('scheduleExceptions', own ? { ...own, ...rec, start: rec.start, end: rec.end } : rec);
      toast('Часы дня сохранены');
      return true;
    },
  });
}

/** Поиск по записям и клиентам */
export async function openSearch(onOpenAppointment) {
  const [appts, clientsMap] = await Promise.all([data.getAll('appointments'), data.getClientsMap()]);
  appts.sort((a, b) => (b.date + fromMin(b.start)).localeCompare(a.date + fromMin(a.start)));
  const input = el('input', { class: 'input', type: 'search', placeholder: 'Имя, телефон или услуга', autocomplete: 'off' });
  const list = el('div', { class: 'search-results' });

  function render() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      list.replaceChildren(el('div', { class: 'pick-empty' }, 'Введите хотя бы 2 символа'));
      return;
    }
    const qd = q.replace(/\D/g, '');
    const found = appts.filter((a) => {
      const c = clientsMap.get(a.clientId);
      return (c?.name || '').toLowerCase().includes(q) ||
        (qd.length >= 3 && String(c?.phone || '').replace(/\D/g, '').includes(qd)) ||
        servicesTitle(a).toLowerCase().includes(q);
    }).slice(0, 50);
    if (!found.length) {
      list.replaceChildren(el('div', { class: 'pick-empty' }, 'Ничего не найдено'));
      return;
    }
    list.replaceChildren(...found.map((a) => el('button', { class: 'pick-row', type: 'button', onclick: () => { sheet.close(); onOpenAppointment(a.id); } },
      el('span', { class: 'pick-title' }, clientsMap.get(a.clientId)?.name || 'Клиент'),
      el('span', { class: 'pick-sub' }, `${formatDayShort(a.date)}, ${fromMin(a.start)} · ${servicesTitle(a)} · ${moneyFull(a.total)} · ${STATUSES[a.status]?.label || ''}`))));
  }
  input.addEventListener('input', render);
  render();
  const sheet = openSheet({ title: 'Поиск', content: el('div', { class: 'form' }, input, list), full: true });
  setTimeout(() => input.focus(), 300);
}
