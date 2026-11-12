// «Лист ожидания»: клиенты, которые ждут окно (желаемые даты, время, услуга).
// Когда появляется подходящее свободное окно, клиент подсвечивается —
// можно сразу записать его или отправить сообщение по шаблону «Свободные окна».

import * as data from '../db.js';
import { el, navBar, groupedList, toggle, openSheet, field, toast, emptyState, confirmAction } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { renderTemplate, templateVars, sendMessage } from '../messaging.js';
import { matchWaitlist, isWaiting } from '../utils/waitlist.js';
import { today, addDays, formatDayShort, fromMinShort } from '../utils/dates.js';

/** Загрузить всё, что нужно для поиска окон */
export async function loadWaitlistContext() {
  const t = today();
  const [{ schedule, exceptions }, appointments, breaks, services, entries] = await Promise.all([
    data.getScheduleData(), data.getAppointmentsBetween(t, addDays(t, 120)), data.getBreaksBetween(t, addDays(t, 120)),
    data.getAll('services'), data.getAll('waitlist'),
  ]);
  return { schedule, exceptions, appointments, breaks, services, entries };
}

export function WaitlistScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({
    title: 'Лист ожидания',
    onBack: () => nav.pop(),
    right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить', html: icon('plus'), onclick: () => editEntry(null) }),
  }), body);

  async function refresh() {
    const [ctx, clientsMap, settings] = await Promise.all([loadWaitlistContext(), data.getClientsMap(), data.getSettings()]);
    const enabled = settings.waitlistEnabled !== false;
    const head = groupedList([{ title: 'Лист ожидания', control: toggle(enabled, (v) => data.setSetting('waitlistEnabled', v)) }],
      { footer: 'Когда включено, клиенты с подходящим свободным окном подсвечиваются здесь и в «Оповещениях».' });
    const waiting = ctx.entries.filter(isWaiting).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
    const other = ctx.entries.filter((e) => !isWaiting(e)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const list = el('div', {});
    if (!waiting.length) list.appendChild(emptyState({ title: 'Никто не ждёт', text: 'Добавьте клиента, которому не нашлось удобного времени.', action: { label: 'Добавить в лист ожидания', onClick: () => editEntry(null) } }));
    for (const e of waiting) {
      const client = clientsMap.get(e.clientId);
      const svc = ctx.services.find((s) => s.id === e.serviceId);
      const matches = enabled ? matchWaitlist(e, ctx) : [];
      const first = matches[0];
      const card = el('div', { class: 'card wl-card' + (first ? ' match' : '') },
        el('div', { class: 'wl-top' },
          el('b', {}, client?.name || 'Клиент удалён'),
          el('button', { class: 'link-btn small', type: 'button', onclick: () => editEntry(e) }, 'Изменить')),
        el('div', { class: 'wl-sub' }, [svc?.name || 'Любая услуга', `${formatDayShort(e.dateFrom)} – ${formatDayShort(e.dateTo || e.dateFrom)}`, `${e.timeFrom || '00:00'}–${e.timeTo || '24:00'}`].join(' · ')),
        e.note ? el('div', { class: 'wl-sub' }, e.note) : null);
      if (first) {
        const total = matches.reduce((s, d) => s + d.slots.length, 0);
        card.append(
          el('div', { class: 'wl-match' }, `Есть окно: ${formatDayShort(first.date)}, ${fromMinShort(first.slots[0])}${total > 1 ? ` (и ещё ${total - 1})` : ''}`),
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn btn-primary small', type: 'button', onclick: () => book(e, first) }, 'Записать'),
            el('button', { class: 'btn btn-outline small', type: 'button', disabled: !client, onclick: () => notify(e, client, matches) }, 'Написать')));
      } else if (enabled) {
        card.appendChild(el('div', { class: 'wl-sub muted' }, 'Подходящих окон пока нет'));
      }
      if (e.notifiedAt) card.appendChild(el('div', { class: 'wl-sub muted' }, `Сообщение отправлено ${formatDayShort(e.notifiedAt.slice(0, 10))}`));
      list.appendChild(card);
    }

    body.replaceChildren(head, list);
    if (other.length) {
      body.appendChild(groupedList(other.slice(0, 30).map((e) => ({
        title: clientsMap.get(e.clientId)?.name || 'Клиент удалён',
        subtitle: e.status === 'booked' ? 'записан(а)' : (e.status === 'closed' ? 'закрыто' : 'период истёк'),
        onClick: () => editEntry(e),
      })), { header: 'Архив' }));
    }
  }

  function book(e, match) {
    openAppointmentForm({
      date: match.date, start: match.slots[0], clientId: e.clientId, serviceIds: e.serviceId ? [e.serviceId] : [],
      onSaved: async () => { await data.update('waitlist', e.id, { status: 'booked' }); },
    });
  }

  async function notify(e, client, matches) {
    const slotsText = matches.slice(0, 5).map((d) => `${formatDayShort(d.date, true)} ${d.slots.slice(0, 4).map(fromMinShort).join(', ')}`).join('; ');
    const [profile, locations] = await Promise.all([data.getProfile(), data.getAll('locations')]);
    const text = await renderTemplate('freeSlots', templateVars({ client, profile, location: locations[0], slotsText }));
    const ok = await sendMessage({ client, text, channel: 'whatsapp', kind: 'freeSlots' });
    if (!ok) { toast('У клиента нет телефона'); return; }
    await data.update('waitlist', e.id, { notifiedAt: new Date().toISOString() });
    toast('Сообщение отправлено');
  }

  async function editEntry(e) {
    const [clients, services] = await Promise.all([data.getAll('clients'), data.getAll('services')]);
    clients.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (!clients.length) { toast('Сначала добавьте клиента'); return; }
    const clientSel = el('select', { class: 'input' }, clients.map((c) => el('option', { value: c.id }, c.name)));
    clientSel.value = e?.clientId || clients[0].id;
    const svcSel = el('select', { class: 'input' }, el('option', { value: '' }, 'Любая услуга'),
      services.filter((s) => s.active || s.id === e?.serviceId).map((s) => el('option', { value: s.id }, s.name)));
    svcSel.value = e?.serviceId || '';
    const fromIn = el('input', { class: 'input', type: 'date', value: e?.dateFrom || today() });
    const toIn = el('input', { class: 'input', type: 'date', value: e?.dateTo || addDays(today(), 14) });
    const tFromIn = el('input', { class: 'input', type: 'time', step: 900, value: e?.timeFrom || '09:00' });
    const tToIn = el('input', { class: 'input', type: 'time', step: 900, value: e?.timeTo || '19:00' });
    const noteIn = el('input', { class: 'input', type: 'text', placeholder: 'Например: только после работы', value: e?.note || '' });
    const content = el('div', { class: 'form' }, el('div', { class: 'form-section' },
      field('Клиент', clientSel), field('Услуга', svcSel),
      el('div', { class: 'grid2' }, field('Даты с', fromIn), field('по', toIn)),
      el('div', { class: 'grid2' }, field('Время с', tFromIn), field('до', tToIn)),
      field('Заметка', noteIn)));
    if (e) {
      if (e.status !== 'waiting') {
        content.appendChild(el('button', { class: 'btn btn-outline', type: 'button', onclick: async () => {
          await data.update('waitlist', e.id, { status: 'waiting' });
          sheet.close();
          toast('Клиент снова в листе ожидания');
        } }, 'Вернуть в лист ожидания'));
      }
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Убрать из листа ожидания?', okText: 'Убрать', danger: true }))) return;
        await data.remove('waitlist', e.id);
        sheet.close();
        toast('Удалено', { undo: () => data.restore('waitlist', e.id) });
      } }, 'Удалить'));
    }
    const sheet = openSheet({
      title: e ? 'Лист ожидания' : 'Добавить в лист ожидания',
      full: true,
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!fromIn.value || !toIn.value || toIn.value < fromIn.value) { toast('Проверьте даты'); return false; }
        if (tToIn.value <= tFromIn.value) { toast('Проверьте время'); return false; }
        await data.save('waitlist', {
          ...(e || { status: 'waiting' }),
          clientId: clientSel.value, serviceId: svcSel.value || null,
          dateFrom: fromIn.value, dateTo: toIn.value, timeFrom: tFromIn.value, timeTo: tToIn.value, note: noteIn.value.trim(),
        });
        toast(e ? 'Сохранено' : 'Клиент добавлен в лист ожидания');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
