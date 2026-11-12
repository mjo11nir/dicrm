// «Отзывы»: добавление вручную (клиент, оценка 1–5 звёзд, текст, дата), средняя оценка сверху.

import * as data from '../db.js';
import { el, navBar, openSheet, field, toast, confirmAction, emptyState } from '../components/ui.js';
import { icon, icons } from '../components/icons.js';
import { today, formatDayShort } from '../utils/dates.js';

/** Ряд звёзд (только просмотр) */
function stars(rating, size = 16) {
  return el('span', { class: 'stars', style: `--star:${size}px` },
    [1, 2, 3, 4, 5].map((i) => el('span', { class: 'star' + (i <= Math.round(rating) ? ' on' : ''), html: icons.star })));
}

export function ReviewsScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({
    title: 'Отзывы',
    onBack: () => nav.pop(),
    right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить отзыв', html: icon('plus'), onclick: () => edit(null) }),
  }), body);

  async function refresh() {
    const [reviews, clientsMap] = await Promise.all([data.getAll('reviews'), data.getClientsMap()]);
    reviews.sort((a, b) => b.date.localeCompare(a.date));
    body.replaceChildren();
    if (!reviews.length) {
      body.appendChild(emptyState({ title: 'Отзывов пока нет', text: 'Сохраняйте здесь отзывы клиентов из мессенджеров и соцсетей.', action: { label: 'Добавить отзыв', onClick: () => edit(null) } }));
      return;
    }
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
    body.appendChild(el('div', { class: 'card rv-summary' },
      el('div', { class: 'rv-avg' }, avg.toFixed(1).replace('.', ',')),
      el('div', { class: 'rv-avg-side' },
        stars(avg, 22),
        el('div', { class: 'hint' }, `${reviews.length} ${plural(reviews.length, 'отзыв', 'отзыва', 'отзывов')}`),
        el('div', { class: 'rv-dist' }, dist.map((d) => el('div', { class: 'rv-dist-row' },
          el('span', {}, String(d.n)),
          el('span', { class: 'rv-bar' }, el('span', { style: { width: (d.count / reviews.length) * 100 + '%' } })),
          el('span', {}, String(d.count))))))));
    for (const r of reviews) {
      const name = r.clientId ? clientsMap.get(r.clientId)?.name : r.author;
      body.appendChild(el('button', { class: 'card rv-card', type: 'button', onclick: () => edit(r) },
        el('div', { class: 'rv-top' }, el('b', {}, name || 'Клиент'), el('span', { class: 'chat-date' }, formatDayShort(r.date))),
        stars(r.rating),
        r.text ? el('div', { class: 'rv-text' }, r.text) : null));
    }
  }

  async function edit(r) {
    const clients = (await data.getAll('clients')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    let rating = r?.rating || 5;
    const starRow = el('div', { class: 'stars big' });
    const renderStars = () => starRow.replaceChildren(...[1, 2, 3, 4, 5].map((i) => el('button', {
      class: 'star' + (i <= rating ? ' on' : ''), type: 'button', 'aria-label': `${i} из 5`, html: icons.star,
      onclick: () => { rating = i; renderStars(); },
    })));
    renderStars();
    const clientSel = el('select', { class: 'input' }, el('option', { value: '' }, 'Другой человек'), clients.map((c) => el('option', { value: c.id }, c.name)));
    clientSel.value = r?.clientId || '';
    const authorIn = el('input', { class: 'input', type: 'text', placeholder: 'Имя автора', value: r?.author || '' });
    const authorField = field('Имя', authorIn);
    authorField.hidden = !!clientSel.value;
    clientSel.addEventListener('change', () => { authorField.hidden = !!clientSel.value; });
    const textIn = el('textarea', { class: 'input', rows: 4, placeholder: 'Текст отзыва' });
    textIn.value = r?.text || '';
    const dateIn = el('input', { class: 'input', type: 'date', value: r?.date || today() });
    const content = el('div', { class: 'form' },
      el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Оценка'), starRow),
      el('div', { class: 'form-section' }, field('Клиент', clientSel), authorField, field('Дата', dateIn), field('Отзыв', textIn)));
    if (r) {
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Удалить отзыв?', okText: 'Удалить', danger: true }))) return;
        await data.remove('reviews', r.id);
        sheet.close();
        toast('Отзыв удалён', { undo: () => data.restore('reviews', r.id) });
      } }, 'Удалить отзыв'));
    }
    const sheet = openSheet({
      title: r ? 'Отзыв' : 'Новый отзыв',
      full: true,
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!clientSel.value && !authorIn.value.trim()) { toast('Выберите клиента или укажите имя'); return false; }
        await data.save('reviews', {
          ...(r || {}), rating, clientId: clientSel.value || null, author: clientSel.value ? '' : authorIn.value.trim(),
          text: textIn.value.trim(), date: dateIn.value || today(),
        });
        toast(r ? 'Сохранено' : 'Отзыв добавлен');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}

/** Склонение: 1 отзыв, 2 отзыва, 5 отзывов */
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
