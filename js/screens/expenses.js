// «Расходы»: быстрый ввод (сумма, категория-плитка, дата, комментарий) и итоги по месяцам.

import * as data from '../db.js';
import { icons } from '../components/icons.js';
import { el, navBar, groupedList, openSheet, field, toast, confirmAction, emptyState, pressable } from '../components/ui.js';
import { today, MONTHS, formatDayShort } from '../utils/dates.js';
import { moneyFull, parseMoney, centsToInput, getCurrency } from '../utils/money.js';

/** Категории расходов: название, иконка (Lucide), подложка и цвет иконки */
export const EXPENSE_CATEGORIES = [
  { name: 'Материалы', icon: 'sparkles', bg: 'var(--pastel-pink)', color: 'var(--pink)' },
  { name: 'Аренда', icon: 'home', bg: 'var(--pastel-yellow)', color: 'var(--orange)' },
  { name: 'Реклама', icon: 'megaphone', bg: 'var(--pastel-lilac)', color: '#9137E8' },
  { name: 'Обучение', icon: 'graduation', bg: 'var(--pastel-green)', color: 'var(--green)' },
  { name: 'Инструменты', icon: 'wrench', bg: 'var(--pastel-gray)', color: '#636366' },
  { name: 'Другое', icon: 'package', bg: '#DDEBFA', color: '#007AFF' },
];
const catOf = (name) => EXPENSE_CATEGORIES.find((c) => c.name === name) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

export function ExpensesScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Расходы', onBack: () => nav.pop() }), body);

  // ---- Быстрый ввод ----
  let category = EXPENSE_CATEGORIES[0].name;
  const amountIn = el('input', { class: 'input amount-input', type: 'text', inputmode: 'decimal', placeholder: `${getCurrency()} 0` });
  const dateIn = el('input', { class: 'input', type: 'date', value: today() });
  const commentIn = el('input', { class: 'input', type: 'text', placeholder: 'Комментарий' });
  const tiles = el('div', { class: 'cat-tiles' });
  function renderTiles() {
    tiles.replaceChildren(...EXPENSE_CATEGORIES.map((c) => pressable(el('button', {
      class: 'cat-tile' + (c.name === category ? ' active' : ''), type: 'button',
      onclick: () => { category = c.name; renderTiles(); },
    }, el('span', { class: 'cat-emoji', style: { background: c.bg, color: c.color }, html: icons[c.icon] }), el('span', {}, c.name)))));
  }
  renderTiles();
  const quick = el('div', { class: 'form-section' },
    amountIn, tiles,
    el('div', { class: 'grid2' }, field('Дата', dateIn), field('Комментарий', commentIn)),
    el('button', { class: 'btn btn-primary', type: 'button', onclick: add }, 'Добавить расход'));
  const list = el('div', {});
  body.append(quick, list);

  async function add() {
    const amount = parseMoney(amountIn.value);
    if (amount <= 0) { toast('Введите сумму'); amountIn.focus(); return; }
    const rec = await data.save('expenses', { amount, category, date: dateIn.value || today(), comment: commentIn.value.trim() });
    amountIn.value = '';
    commentIn.value = '';
    toast(`Расход ${moneyFull(amount)} добавлен`, { undo: () => data.remove('expenses', rec.id) });
  }

  async function refresh() {
    const expenses = (await data.getAll('expenses')).sort((a, b) => b.date.localeCompare(a.date));
    list.replaceChildren();
    if (!expenses.length) {
      list.appendChild(emptyState({ title: 'Расходов пока нет', text: 'Добавьте первый расход — он попадёт в статистику и прибыль.' }));
      return;
    }
    // Группировка по месяцам с итогом и разбивкой по категориям
    const months = new Map();
    for (const e of expenses) {
      const k = e.date.slice(0, 7);
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(e);
    }
    for (const [k, items] of months) {
      const total = items.reduce((s, e) => s + e.amount, 0);
      const byCat = new Map();
      for (const e of items) byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);
      const name = `${MONTHS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
      list.appendChild(el('div', { class: 'month-head' }, el('span', {}, name), el('b', {}, moneyFull(total))));
      list.appendChild(el('div', { class: 'cat-summary' }, [...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) =>
        el('span', { class: 'cat-pill' }, `${c} ${moneyFull(v)}`))));
      list.appendChild(groupedList(items.map((e) => ({
        icon: catOf(e.category).icon,
        iconBg: catOf(e.category).color,
        title: e.category,
        subtitle: [formatDayShort(e.date), e.comment].filter(Boolean).join(' · '),
        value: moneyFull(e.amount),
        onClick: () => edit(e),
      }))));
    }
  }

  function edit(e) {
    const amountEd = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: centsToInput(e.amount) });
    const catSel = el('select', { class: 'input' }, EXPENSE_CATEGORIES.map((c) => el('option', { value: c.name }, c.name)));
    catSel.value = catOf(e.category).name;
    const dateEd = el('input', { class: 'input', type: 'date', value: e.date });
    const commentEd = el('input', { class: 'input', type: 'text', value: e.comment || '' });
    const sheet = openSheet({
      title: 'Расход',
      content: el('div', { class: 'form' },
        el('div', { class: 'form-section' },
          el('div', { class: 'grid2' }, field('Сумма', amountEd), field('Категория', catSel)),
          field('Дата', dateEd), field('Комментарий', commentEd)),
        el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
          if (!(await confirmAction({ title: 'Удалить расход?', okText: 'Удалить', danger: true }))) return;
          await data.remove('expenses', e.id);
          sheet.close();
          toast('Расход удалён', { undo: () => data.restore('expenses', e.id) });
        } }, 'Удалить')),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        const amount = parseMoney(amountEd.value);
        if (amount <= 0) { toast('Введите сумму'); return false; }
        await data.save('expenses', { ...e, amount, category: catSel.value, date: dateEd.value || e.date, comment: commentEd.value.trim() });
        toast('Сохранено');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
