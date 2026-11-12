// Карточка записи: клиент и связь с ним, услуги, время, цена, оплата, статусы и действия.

import * as data from '../db.js';
import { el, navBar, avatar, groupedList, actionSheet, toast, confirmAction, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { fromMin, formatDayShort, formatDuration } from '../utils/dates.js';
import { moneyFull } from '../utils/money.js';
import { STATUSES, PAYMENT_METHODS, phoneDigits, fillTemplate, servicesTitle } from '../utils/appt.js';

export function AppointmentScreen({ id }, nav) {
  const root = el('div', { class: 'page page-white-top' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Запись', onBack: () => nav.pop() }), body);

  async function refresh() {
    const a = await data.get('appointments', id);
    if (!a) {
      body.replaceChildren(emptyState({ title: 'Запись удалена', action: { label: 'Назад', onClick: () => nav.pop() } }));
      return;
    }
    const [client, payments, settings, profile, locations] = await Promise.all([
      data.get('clients', a.clientId), data.getPaymentsFor(a.id), data.getSettings(), data.getProfile(), data.getAll('locations'),
    ]);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const rest = Math.max(0, a.total - paid);
    const digits = phoneDigits(client?.phone);
    const location = locations.find((l) => l.id === a.locationId) || locations[0];

    // --- Клиент ---
    const head = el('div', { class: 'appt-head card' },
      avatar(client, { size: 64, bell: !!a.reminderSentAt }),
      el('div', { class: 'appt-head-name' }, client?.name || 'Клиент удалён'),
      client?.phone ? el('div', { class: 'appt-head-phone' }, client.phone) : null,
      el('div', { class: 'contact-row' },
        contactBtn('phone', 'Позвонить', digits ? `tel:+${digits}` : null),
        contactBtn('whatsapp', 'WhatsApp', digits ? `https://wa.me/${digits}` : null),
        contactBtn('send', 'Telegram', digits ? `https://t.me/+${digits}` : null)));

    // --- Статус ---
    const statusRow = el('div', { class: 'status-chips' });
    for (const [key, s] of Object.entries(STATUSES)) {
      statusRow.appendChild(el('button', {
        class: 'chip' + (a.status === key ? ' active' : ''), type: 'button',
        style: a.status === key ? { background: s.color, borderColor: s.color } : null,
        onclick: () => setStatus(a, key),
      }, s.label));
    }

    // --- Детали ---
    const discount = a.price - a.total;
    const rows = [
      { title: 'Дата', value: formatDayShort(a.date) },
      { title: 'Время', value: `${fromMin(a.start)} – ${fromMin(a.start + a.duration)} (${formatDuration(a.duration)})` },
      ...a.services.map((s) => ({ title: s.name, value: moneyFull(s.price) })),
    ];
    if (!a.services.length) rows.push({ title: 'Услуги', value: 'не выбраны' });
    if (discount > 0) rows.push({ title: 'Скидка', value: `−${moneyFull(discount)}` });
    rows.push({ title: 'Итого', value: moneyFull(a.total) });
    const payRows = [
      { title: 'Оплачено', value: moneyFull(paid) },
      { title: 'Остаток', value: moneyFull(rest) },
      ...payments.map((p) => ({ title: p.kind === 'prepay' ? 'Предоплата' : `Оплата: ${PAYMENT_METHODS[p.method] || ''}`, subtitle: formatDayShort(p.date), value: moneyFull(p.amount) })),
    ];

    // --- Действия ---
    const actions = el('div', { class: 'appt-actions' });
    if (a.status !== 'completed' && a.status !== 'cancelled') {
      actions.appendChild(el('button', { class: 'btn btn-primary', type: 'button', onclick: () => completeAndPay(a, rest) }, 'Завершить и принять оплату'));
    } else if (a.status === 'completed' && rest > 0) {
      actions.appendChild(el('button', { class: 'btn btn-primary', type: 'button', onclick: () => completeAndPay(a, rest) }, `Принять оплату ${moneyFull(rest)}`));
    }
    actions.appendChild(el('button', { class: 'btn btn-outline', type: 'button', disabled: !digits, onclick: () => sendReminder(a, client, settings, profile, location) },
      a.reminderSentAt ? 'Отправить напоминание ещё раз' : 'Отправить напоминание'));
    actions.appendChild(el('div', { class: 'btn-row' },
      el('button', { class: 'btn btn-outline', type: 'button', onclick: () => openAppointmentForm({ appointment: a, focus: 'time' }) }, 'Перенести'),
      el('button', { class: 'btn btn-outline', type: 'button', onclick: () => openAppointmentForm({ appointment: a }) }, 'Изменить')));
    if (a.status !== 'cancelled') {
      actions.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: () => cancel(a) }, 'Отменить запись'));
    }
    actions.appendChild(el('button', { class: 'link-btn danger center', type: 'button', onclick: () => removeAppt(a) }, 'Удалить запись'));

    body.replaceChildren(...[
      head,
      el('div', { class: 'section-label' }, 'Статус'),
      statusRow,
      groupedList(rows, { header: 'Услуги и время' }),
      groupedList(payRows, { header: 'Оплата' }),
      a.comment ? groupedList([{ title: a.comment }], { header: 'Комментарий' }) : null,
      a.seriesId ? el('div', { class: 'group-footer' }, 'Запись из повторяющейся серии') : null,
      actions,
    ].filter(Boolean));
  }

  function contactBtn(ic, label, href) {
    if (!href) return el('button', { class: 'contact-btn', type: 'button', disabled: true, onclick: () => toast('У клиента нет телефона') }, el('span', { html: icon(ic) }), el('span', {}, label));
    return el('a', { class: 'contact-btn', href, target: ic === 'phone' ? '_self' : '_blank', rel: 'noopener' }, el('span', { html: icon(ic) }), el('span', {}, label));
  }

  async function setStatus(a, status) {
    if (status === a.status) return;
    if (status === 'completed') return completeAndPay(a, Math.max(0, a.total - (await data.getPaymentsFor(a.id)).reduce((s, p) => s + p.amount, 0)));
    const prev = a.status;
    await data.update('appointments', a.id, { status });
    toast(`Статус: ${STATUSES[status].label}`, { undo: () => data.update('appointments', a.id, { status: prev }) });
  }

  function completeAndPay(a, rest) {
    if (rest <= 0) {
      data.update('appointments', a.id, { status: 'completed' }).then(() => toast('Запись завершена'));
      return;
    }
    actionSheet({
      title: 'Принять оплату',
      message: `К оплате: ${moneyFull(rest)}`,
      actions: [
        ...Object.entries(PAYMENT_METHODS).map(([method, label]) => ({
          label, onClick: async () => {
            const prev = a.status;
            const pay = await data.save('payments', { appointmentId: a.id, amount: rest, method, kind: 'final', date: a.date });
            await data.update('appointments', a.id, { status: 'completed' });
            toast(`Оплачено ${moneyFull(rest)} (${label.toLowerCase()})`, {
              undo: async () => { await data.remove('payments', pay.id); await data.update('appointments', a.id, { status: prev }); },
            });
          },
        })),
        { label: 'Завершить без оплаты', onClick: () => data.update('appointments', a.id, { status: 'completed' }).then(() => toast('Запись завершена')) },
      ],
    });
  }

  async function cancel(a) {
    const ok = await confirmAction({ title: 'Отменить запись?', message: 'Время освободится в расписании.', okText: 'Отменить запись', danger: true });
    if (!ok) return;
    const prev = a.status;
    await data.update('appointments', a.id, { status: 'cancelled' });
    toast('Запись отменена', { undo: () => data.update('appointments', a.id, { status: prev }) });
  }

  async function removeAppt(a) {
    const ok = await confirmAction({ title: 'Удалить запись?', message: 'Запись исчезнет из расписания и статистики.', okText: 'Удалить', danger: true });
    if (!ok) return;
    await data.remove('appointments', a.id);
    nav.pop();
    toast('Запись удалена', { undo: () => data.restore('appointments', a.id) });
  }

  async function sendReminder(a, client, settings, profile, location) {
    const text = fillTemplate(settings.reminderTemplate, {
      имя: (client?.name || '').split(' ')[0],
      дата: formatDayShort(a.date),
      время: fromMin(a.start),
      услуга: servicesTitle(a),
      адрес: location?.address || profile.address || '',
      цена: moneyFull(a.total),
    });
    window.open(`https://wa.me/${phoneDigits(client.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    await data.update('appointments', a.id, { reminderSentAt: new Date().toISOString() });
    // История сообщений (пригодится для вкладки «Чаты»)
    await data.save('messages', { clientId: client.id, appointmentId: a.id, channel: 'whatsapp', kind: 'reminder', text, at: new Date().toISOString() });
    toast('Напоминание отправлено');
  }

  refresh();
  return { el: root, refresh };
}
