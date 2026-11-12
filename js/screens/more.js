// Вкладка «Другое» (docs/screenshots/03-more.jpg): крупный заголовок и отдельные карточки
// с пастельными иконками. «Резервная копия» добавится в этапе 4.

import { el, pressable } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { TemplatesScreen } from './templates.js';
import { ProfileScreen } from './profile.js';
import { ClientsScreen } from './clients.js';
import { HelpScreen } from './help.js';
import { StatsScreen } from './stats.js';
import { ExpensesScreen } from './expenses.js';
import { GalleryScreen } from './gallery.js';
import { ReviewsScreen } from './reviews.js';

export function MoreScreen(params, nav) {
  const item = (ic, bg, color, label, onClick) => pressable(el('button', { class: 'more-card', type: 'button', onclick: onClick },
    el('span', { class: 'more-ic', style: { background: bg, color }, html: icons[ic] }),
    el('span', { class: 'more-label' }, label)));

  const root = el('div', { class: 'page more' },
    el('h1', { class: 'large-title' }, 'Другое'),
    item('userFill', 'var(--pastel-pink)', 'var(--pink)', 'Профиль и настройки', () => nav.push(ProfileScreen)),
    item('chat', 'var(--pastel-green)', 'var(--green)', 'Уведомления для клиентов', () => nav.push(TemplatesScreen)),
    item('pieChart', 'var(--pastel-lilac)', 'var(--primary)', 'Статистика', () => nav.push(StatsScreen)),
    item('bag', 'var(--pastel-lilac)', 'var(--primary)', 'Расходы', () => nav.push(ExpensesScreen)),
    item('users', 'var(--pastel-pink)', 'var(--pink)', 'Клиенты', () => nav.push(ClientsScreen)),
    item('imageFill', 'var(--pastel-pink)', 'var(--pink)', 'Галерея', () => nav.push(GalleryScreen)),
    item('thumbUp', 'var(--pastel-pink)', 'var(--pink)', 'Отзывы', () => nav.push(ReviewsScreen)),
    item('help', 'var(--pastel-gray)', '#8A8A8E', 'Помощь', () => nav.push(HelpScreen)));

  return { el: root };
}
