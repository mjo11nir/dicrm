// «График и место работы»: рабочие дни и часы, перерывы, шаг слотов,
// отпуска и выходные по датам, места работы.

import * as data from '../db.js';
import { el, navBar, groupedList, toggle, openSheet, field, toast, actionSheet, confirmAction } from '../components/ui.js';
import { toMin, fromMin, formatDayShort, today, WEEKDAYS_FULL, formatDuration } from '../utils/dates.js';

const SLOT_OPTIONS = [15, 30, 60, 120];

export function ScheduleSettingsScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'График и место работы', onBack: () => nav.pop() }), body);

  async function refresh() {
    const [{ schedule, exceptions }, settings, locations] = await Promise.all([
      data.getScheduleData(), data.getSettings(), data.getAll('locations'),
    ]);

    // --- Рабочие дни ---
    const dayRows = schedule.map((r) => ({
      title: WEEKDAYS_FULL[r.weekday],
      subtitle: r.isWorking
        ? `${r.start}–${r.end}${r.breaks?.length ? ' · перерыв ' + r.breaks.map((b) => `${b.start}–${b.end}`).join(', ') : ''}`
        : 'Выходной',
      onClick: r.isWorking ? () => editWeekday(r) : null,
      control: toggle(r.isWorking, async (v) => {
        await data.update('schedule', r.id, { isWorking: v });
        toast(v ? `${WEEKDAYS_FULL[r.weekday]} — рабочий день` : `${WEEKDAYS_FULL[r.weekday]} — выходной`);
      }),
    }));

    // --- Отпуска и выходные по датам (только текущие и будущие) ---
    const t = today();
    const future = exceptions.filter((e) => (e.dateTo || e.dateFrom) >= t).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
    const exRows = future.map((e) => ({
      title: e.dateFrom === (e.dateTo || e.dateFrom) ? formatDayShort(e.dateFrom) : `${formatDayShort(e.dateFrom)} – ${formatDayShort(e.dateTo)}`,
      subtitle: e.kind === 'off' ? (e.note || 'Выходной') : `Особые часы: ${e.start}–${e.end}`,
      onClick: () => actionSheet({
        title: 'Исключение из графика',
        actions: [{ label: 'Удалить', danger: true, onClick: async () => {
          await data.remove('scheduleExceptions', e.id);
          toast('Удалено', { undo: () => data.restore('scheduleExceptions', e.id) });
        } }],
      }),
    }));
    exRows.push({ title: '+ Добавить отпуск или выходной', onClick: addVacation, chevron: false });

    // --- Места работы ---
    const locRows = locations.map((l) => ({ title: l.name, subtitle: l.address, onClick: () => editLocation(l) }));
    locRows.push({ title: '+ Добавить место работы', onClick: () => editLocation(null), chevron: false });

    body.replaceChildren(
      groupedList(dayRows, { header: 'Рабочие дни', footer: 'Нажмите на рабочий день, чтобы изменить часы и перерывы.' }),
      groupedList([{
        title: 'Шаг слотов',
        value: formatDuration(settings.slotDuration),
        onClick: () => actionSheet({
          title: 'Длительность свободного окна',
          message: 'По ней рассчитываются свободные окна: 9:00, 11:00, 13:00…',
          actions: SLOT_OPTIONS.map((m) => ({ label: formatDuration(m) + (m === settings.slotDuration ? ' ✓' : ''), onClick: () => data.setSetting('slotDuration', m) })),
        }),
      }], { header: 'Свободные окна' }),
      groupedList(exRows, { header: 'Отпуска и выходные' }),
      groupedList(locRows, { header: 'Места работы' }),
    );
  }

  /** Часы и перерывы дня недели */
  function editWeekday(r) {
    const startIn = el('input', { class: 'input', type: 'time', step: 300, value: r.start });
    const endIn = el('input', { class: 'input', type: 'time', step: 300, value: r.end });
    const breaksBox = el('div', { class: 'breaks-box' });
    let breaks = (r.breaks || []).map((b) => ({ ...b }));
    function renderBreaks() {
      breaksBox.replaceChildren(...breaks.map((b, i) => {
        const s = el('input', { class: 'input', type: 'time', step: 300, value: b.start });
        const e = el('input', { class: 'input', type: 'time', step: 300, value: b.end });
        s.addEventListener('change', () => { b.start = s.value; });
        e.addEventListener('change', () => { b.end = e.value; });
        return el('div', { class: 'break-row' }, s, el('span', {}, '–'), e,
          el('button', { class: 'link-btn danger', type: 'button', onclick: () => { breaks.splice(i, 1); renderBreaks(); } }, 'Удалить'));
      }), el('button', { class: 'link-btn', type: 'button', onclick: () => { breaks.push({ start: '13:00', end: '14:00' }); renderBreaks(); } }, '+ Добавить перерыв'));
    }
    renderBreaks();
    openSheet({
      title: WEEKDAYS_FULL[r.weekday],
      content: el('div', { class: 'form' },
        el('div', { class: 'form-section' }, el('div', { class: 'grid2' }, field('Начало', startIn), field('Конец', endIn))),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Перерывы'), breaksBox)),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        const s = toMin(startIn.value || '09:00');
        const e = toMin(endIn.value || '19:00');
        if (e <= s) { toast('Конец дня должен быть позже начала'); return false; }
        for (const b of breaks) {
          if (toMin(b.end) <= toMin(b.start) || toMin(b.start) < s || toMin(b.end) > e) { toast('Перерыв должен быть внутри рабочего дня'); return false; }
        }
        await data.update('schedule', r.id, { start: fromMin(s), end: fromMin(e), breaks });
        toast('График сохранён');
        return true;
      },
    });
  }

  /** Отпуск или выходной на период */
  function addVacation() {
    const fromIn = el('input', { class: 'input', type: 'date', value: today() });
    const toIn = el('input', { class: 'input', type: 'date', value: today() });
    const noteIn = el('input', { class: 'input', type: 'text', placeholder: 'Отпуск', value: '' });
    openSheet({
      title: 'Отпуск или выходной',
      content: el('div', { class: 'form' }, el('div', { class: 'form-section' },
        el('div', { class: 'grid2' }, field('С', fromIn), field('По', toIn)), field('Заметка', noteIn))),
      actionText: 'Добавить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!fromIn.value || !toIn.value || toIn.value < fromIn.value) { toast('Проверьте даты'); return false; }
        const conflicts = (await data.getAppointmentsBetween(fromIn.value, toIn.value)).filter((a) => a.status !== 'cancelled').length;
        await data.save('scheduleExceptions', { kind: 'off', dateFrom: fromIn.value, dateTo: toIn.value, note: noteIn.value.trim() || 'Отпуск' });
        toast(conflicts ? `Добавлено. Внимание: на эти даты есть записи (${conflicts})` : 'Добавлено', { duration: conflicts ? 6000 : 3500 });
        return true;
      },
    });
  }

  /** Место работы: название и адрес */
  function editLocation(l) {
    const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Например: Студия', value: l?.name || '' });
    const addrIn = el('input', { class: 'input', type: 'text', placeholder: 'Адрес', value: l?.address || '' });
    const content = el('div', { class: 'form' }, el('div', { class: 'form-section' }, field('Название', nameIn), field('Адрес', addrIn)));
    if (l) {
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Удалить место работы?', okText: 'Удалить', danger: true }))) return;
        await data.remove('locations', l.id);
        sheet.close();
        toast('Место удалено', { undo: () => data.restore('locations', l.id) });
      } }, 'Удалить'));
    }
    const sheet = openSheet({
      title: l ? 'Место работы' : 'Новое место',
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!nameIn.value.trim()) { toast('Введите название'); return false; }
        await data.save('locations', { ...(l || {}), name: nameIn.value.trim(), address: addrIn.value.trim() });
        toast('Сохранено');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
