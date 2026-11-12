// «Оповещения» — напоминания для мастера: записи на сегодня и завтра (кому не напомнили),
// дни рождения на этой неделе, клиенты, которым «пора снова» по интервалу услуги.

import * as data from '../db.js';
import { el, navBar, groupedList, emptyState } from '../components/ui.js';
import { AppointmentScreen } from './appointment.js';
import { ClientScreen } from './client.js';
import { today, addDays, fromMin, formatDayShort, nowMin, diffDays } from '../utils/dates.js';
import { servicesTitle } from '../utils/appt.js';
import { isBlocking } from '../utils/slots.js';
import { clientStats, isDueAgain } from '../utils/clients.js';

export function AlertsScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Оповещения', onBack: () => nav.pop() }), body);

  async function refresh() {
    const t = today();
    const tomorrow = addDays(t, 1);
    const [allAppts, clients, services] = await Promise.all([data.getAll('appointments'), data.getAll('clients'), data.getAll('services')]);
    const clientsMap = new Map(clients.map((c) => [c.id, c]));

    // Записи на сегодня (ещё не прошедшие) и завтра
    const active = allAppts.filter((a) => (a.date === t || a.date === tomorrow) && isBlocking(a) && a.status !== 'completed' && a.status !== 'noshow')
      .sort((a, b) => a.start - b.start);
    const todayLeft = active.filter((a) => a.date === t && a.start + a.duration > nowMin());
    const tmr = active.filter((a) => a.date === tomorrow);
    const apptRow = (a) => ({
      title: `${fromMin(a.start)} · ${clientsMap.get(a.clientId)?.name || 'Клиент'}`,
      subtitle: servicesTitle(a),
      value: a.reminderSentAt ? 'напомнили' : 'не напомнили',
      onClick: () => nav.push(AppointmentScreen, { id: a.id }),
    });

    // Дни рождения в ближайшие 7 дней
    const week = [...Array(7)].map((_, i) => addDays(t, i).slice(5));
    const birthdays = clients.filter((c) => c.birthday && week.includes(c.birthday.slice(5)))
      .sort((a, b) => week.indexOf(a.birthday.slice(5)) - week.indexOf(b.birthday.slice(5)));

    // Пора записаться снова
    const byClient = new Map();
    for (const a of allAppts) {
      if (!byClient.has(a.clientId)) byClient.set(a.clientId, []);
      byClient.get(a.clientId).push(a);
    }
    const due = clients.map((c) => ({ c, st: clientStats(c.id, byClient.get(c.id) || []) }))
      .filter(({ st }) => isDueAgain(st, services))
      .sort((a, b) => a.st.lastVisit.localeCompare(b.st.lastVisit));

    body.replaceChildren();
    if (!todayLeft.length && !tmr.length && !birthdays.length && !due.length) {
      body.appendChild(emptyState({ title: 'Нет оповещений', text: 'Здесь появятся записи на завтра, дни рождения и клиенты, которым пора записаться снова.' }));
      return;
    }
    const notSent = tmr.filter((a) => !a.reminderSentAt).length;
    if (notSent) body.appendChild(el('div', { class: 'alert-banner' }, `Не отправлено напоминаний на завтра: ${notSent}`));
    if (todayLeft.length) body.appendChild(groupedList(todayLeft.map(apptRow), { header: `Сегодня, ${formatDayShort(t)}` }));
    if (tmr.length) body.appendChild(groupedList(tmr.map(apptRow), { header: `Завтра, ${formatDayShort(tomorrow)}` }));
    if (birthdays.length) {
      body.appendChild(groupedList(birthdays.map((c) => {
        const d = t.slice(0, 4) + '-' + c.birthday.slice(5);
        return { title: c.name, value: d === t ? 'сегодня 🎉' : formatDayShort(d), onClick: () => nav.push(ClientScreen, { id: c.id }) };
      }), { header: 'Дни рождения на неделе' }));
    }
    if (due.length) {
      body.appendChild(groupedList(due.slice(0, 30).map(({ c, st }) => ({
        title: c.name,
        subtitle: `последний визит ${formatDayShort(st.lastVisit)}`,
        value: `${diffDays(st.lastVisit, t)} дн.`,
        onClick: () => nav.push(ClientScreen, { id: c.id }),
      })), { header: `Пора записаться снова (${due.length})`, footer: 'По интервалу повторного визита из настроек услуги.' }));
    }
  }

  refresh();
  return { el: root, refresh };
}
