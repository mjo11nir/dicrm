// «Оповещения» — напоминания для мастера: записи на сегодня и завтра, кому ещё не отправлено напоминание.

import * as data from '../db.js';
import { el, navBar, groupedList, emptyState } from '../components/ui.js';
import { AppointmentScreen } from './appointment.js';
import { today, addDays, fromMin, formatDayShort, nowMin } from '../utils/dates.js';
import { servicesTitle } from '../utils/appt.js';
import { isBlocking } from '../utils/slots.js';

export function AlertsScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Оповещения', onBack: () => nav.pop() }), body);

  async function refresh() {
    const t = today();
    const tomorrow = addDays(t, 1);
    const [appts, clientsMap] = await Promise.all([data.getAppointmentsBetween(t, tomorrow), data.getClientsMap()]);
    const active = appts.filter((a) => isBlocking(a) && a.status !== 'completed' && a.status !== 'noshow').sort((a, b) => a.start - b.start);
    const todayLeft = active.filter((a) => a.date === t && a.start + a.duration > nowMin());
    const tmr = active.filter((a) => a.date === tomorrow);
    const row = (a) => ({
      title: `${fromMin(a.start)} · ${clientsMap.get(a.clientId)?.name || 'Клиент'}`,
      subtitle: servicesTitle(a),
      value: a.reminderSentAt ? 'напомнили' : 'не напомнили',
      onClick: () => nav.push(AppointmentScreen, { id: a.id }),
    });
    body.replaceChildren();
    if (!todayLeft.length && !tmr.length) {
      body.appendChild(emptyState({ title: 'Нет оповещений', text: 'На сегодня и завтра предстоящих записей нет.' }));
      return;
    }
    const notSent = tmr.filter((a) => !a.reminderSentAt).length;
    if (notSent) body.appendChild(el('div', { class: 'alert-banner' }, `Не отправлено напоминаний на завтра: ${notSent}`));
    if (todayLeft.length) body.appendChild(groupedList(todayLeft.map(row), { header: `Сегодня, ${formatDayShort(t)}` }));
    if (tmr.length) body.appendChild(groupedList(tmr.map(row), { header: `Завтра, ${formatDayShort(tomorrow)}` }));
  }

  refresh();
  return { el: root, refresh };
}
