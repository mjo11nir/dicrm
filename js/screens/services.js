// «Услуги и товары» — этап 1: услуги по категориям (название, длительность, цена,
// перерыв после, интервал повторного визита, активна/скрыта). Товары — в следующих этапах.

import * as data from '../db.js';
import { el, navBar, groupedList, toggle, openSheet, field, toast, confirmAction, actionSheet, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { formatDuration } from '../utils/dates.js';
import { moneyFull, parseMoney, centsToInput } from '../utils/money.js';

export function ServicesScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({
    title: 'Услуги',
    onBack: () => nav.pop(),
    right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить', html: icon('plus'), onclick: () => actionSheet({
      actions: [
        { label: 'Новая услуга', bold: true, onClick: () => editService(null) },
        { label: 'Новая категория', onClick: () => editCategory(null) },
      ],
    }) }),
  }), body);

  let categories = [];

  async function refresh() {
    const [cats, services] = await Promise.all([data.getAll('serviceCategories'), data.getAll('services')]);
    categories = cats.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    body.replaceChildren();
    if (!services.length && !categories.length) {
      body.appendChild(emptyState({ title: 'Услуг пока нет', text: 'Добавьте первую услугу — её можно будет выбрать при записи.', action: { label: 'Добавить услугу', onClick: () => editService(null) } }));
      return;
    }
    const groups = categories.map((c) => ({ c, items: services.filter((s) => s.categoryId === c.id) }));
    const orphan = services.filter((s) => !categories.some((c) => c.id === s.categoryId));
    if (orphan.length) groups.push({ c: null, items: orphan });

    for (const g of groups) {
      const rows = g.items.sort((a, b) => a.name.localeCompare(b.name, 'ru')).map((s) => ({
        title: s.name,
        subtitle: `${formatDuration(s.duration)} · ${moneyFull(s.price)}${s.repeatDays ? ` · повтор через ${s.repeatDays} дн.` : ''}`,
        badge: s.active ? null : 'скрыта',
        onClick: () => editService(s),
      }));
      rows.push({ title: '+ Добавить услугу', chevron: false, onClick: () => editService(null, g.c?.id) });
      const head = el('div', { class: 'group-header-row' },
        el('span', {}, g.c ? g.c.name : 'Без категории'),
        g.c ? el('button', { class: 'link-btn small', type: 'button', onclick: () => editCategory(g.c) }, 'Изменить') : null);
      const list = groupedList(rows);
      list.prepend(head);
      body.appendChild(list);
    }
    body.appendChild(el('button', { class: 'btn btn-outline', type: 'button', onclick: () => editCategory(null) }, 'Добавить категорию'));
  }

  function editService(s, categoryId = null) {
    const st = s ? { ...s } : { name: '', categoryId: categoryId || categories[0]?.id || null, duration: 60, price: 0, breakAfter: 0, repeatDays: 21, active: true };
    const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Название услуги', value: st.name });
    const catSel = el('select', { class: 'input' }, categories.map((c) => el('option', { value: c.id }, c.name)), el('option', { value: '' }, 'Без категории'));
    catSel.value = st.categoryId || '';
    const durIn = el('input', { class: 'input', type: 'number', min: 5, step: 5, inputmode: 'numeric', value: st.duration });
    const priceIn = el('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: '0', value: centsToInput(st.price) });
    const breakIn = el('input', { class: 'input', type: 'number', min: 0, step: 5, inputmode: 'numeric', value: st.breakAfter || 0 });
    const repeatIn = el('input', { class: 'input', type: 'number', min: 0, step: 1, inputmode: 'numeric', value: st.repeatDays || 0 });
    let active = st.active !== false;
    const content = el('div', { class: 'form' },
      el('div', { class: 'form-section' },
        field('Название', nameIn),
        field('Категория', catSel),
        el('div', { class: 'grid2' }, field('Длительность, мин', durIn), field('Цена', priceIn)),
        el('div', { class: 'grid2' }, field('Перерыв после, мин', breakIn), field('Повторный визит, дней', repeatIn))),
      groupedList([{ title: 'Показывать при записи', control: toggle(active, (v) => { active = v; }) }],
        { footer: 'Скрытые услуги остаются в старых записях, но не предлагаются в новых.' }));
    if (s) {
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Удалить услугу?', message: 'В уже созданных записях она сохранится.', okText: 'Удалить', danger: true }))) return;
        await data.remove('services', s.id);
        sheet.close();
        toast('Услуга удалена', { undo: () => data.restore('services', s.id) });
      } }, 'Удалить услугу'));
    }
    const sheet = openSheet({
      title: s ? 'Услуга' : 'Новая услуга',
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        const duration = parseInt(durIn.value, 10);
        if (!nameIn.value.trim()) { toast('Введите название'); return false; }
        if (!(duration > 0)) { toast('Укажите длительность'); return false; }
        await data.save('services', {
          ...(s || {}),
          name: nameIn.value.trim(),
          categoryId: catSel.value || null,
          duration,
          price: parseMoney(priceIn.value),
          breakAfter: Math.max(0, parseInt(breakIn.value, 10) || 0),
          repeatDays: Math.max(0, parseInt(repeatIn.value, 10) || 0),
          active,
        });
        toast(s ? 'Услуга сохранена' : 'Услуга добавлена');
        return true;
      },
    });
  }

  function editCategory(c) {
    const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Например: Маникюр', value: c?.name || '' });
    const content = el('div', { class: 'form' }, el('div', { class: 'form-section' }, field('Название категории', nameIn)));
    if (c) {
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Удалить категорию?', message: 'Услуги из неё попадут в «Без категории».', okText: 'Удалить', danger: true }))) return;
        await data.remove('serviceCategories', c.id);
        sheet.close();
        toast('Категория удалена', { undo: () => data.restore('serviceCategories', c.id) });
      } }, 'Удалить категорию'));
    }
    const sheet = openSheet({
      title: c ? 'Категория' : 'Новая категория',
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!nameIn.value.trim()) { toast('Введите название'); return false; }
        await data.save('serviceCategories', { ...(c || { sort: categories.length }), name: nameIn.value.trim() });
        toast('Сохранено');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
