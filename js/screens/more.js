// Вкладка «Другое» (docs/screenshots/03-more.jpg): крупный заголовок и отдельные карточки
// с пастельными иконками. Пункты «Статистика», «Расходы», «Галерея», «Отзывы» и
// «Резервная копия» добавятся вместе с этими разделами (этапы 3–4).

import { el, pressable } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { openReminderTemplate } from '../components/quick-sheets.js';
import { ProfileScreen } from './profile.js';
import { ClientsScreen } from './clients.js';
import { HelpScreen } from './help.js';

export function MoreScreen(params, nav) {
  const item = (ic, bg, color, label, onClick) => pressable(el('button', { class: 'more-card', type: 'button', onclick: onClick },
    el('span', { class: 'more-ic', style: { background: bg, color }, html: icons[ic] }),
    el('span', { class: 'more-label' }, label)));

  const root = el('div', { class: 'page more' },
    el('h1', { class: 'large-title' }, 'Другое'),
    item('userFill', 'var(--pastel-pink)', 'var(--pink)', 'Профиль и настройки', () => nav.push(ProfileScreen)),
    item('chat', 'var(--pastel-green)', 'var(--green)', 'Уведомления для клиентов', () => openReminderTemplate()),
    item('users', 'var(--pastel-pink)', 'var(--pink)', 'Клиенты', () => nav.push(ClientsScreen)),
    item('help', 'var(--pastel-gray)', '#8A8A8E', 'Помощь', () => nav.push(HelpScreen)));

  return { el: root };
}
