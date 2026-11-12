// Вкладка «Другое» (docs/screenshots/03-more.jpg).
// В этапе 1 здесь разделы, которые уже работают; остальные пункты
// («Профиль и настройки», «Статистика», «Расходы», «Галерея», «Отзывы»…) добавятся в этапах 2–3.

import { el, pressable } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { openReminderTemplate } from '../components/quick-sheets.js';
import { ScheduleSettingsScreen } from './schedule-settings.js';
import { ServicesScreen } from './services.js';
import { ClientsScreen } from './clients.js';
import { HelpScreen } from './help.js';

export function MoreScreen(params, nav) {
  const item = (ic, bg, color, label, onClick) => pressable(el('button', { class: 'more-card', type: 'button', onclick: onClick },
    el('span', { class: 'more-ic', style: { background: bg, color }, html: icons[ic] }),
    el('span', { class: 'more-label' }, label)));

  const root = el('div', { class: 'page more' },
    el('h1', { class: 'large-title' }, 'Другое'),
    item('scheduleSettings', 'var(--pastel-yellow)', 'var(--orange)', 'График и место работы', () => nav.push(ScheduleSettingsScreen)),
    item('bellService', 'var(--pastel-lilac)', 'var(--primary)', 'Услуги', () => nav.push(ServicesScreen)),
    item('chat', 'var(--pastel-green)', 'var(--green)', 'Уведомления для клиентов', () => openReminderTemplate()),
    item('users', 'var(--pastel-pink)', 'var(--pink)', 'Клиенты', () => nav.push(ClientsScreen)),
    item('help', 'var(--pastel-gray)', '#8A8A8E', 'Помощь', () => nav.push(HelpScreen)));

  return { el: root };
}
