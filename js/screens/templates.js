// «Уведомления для клиентов»: шаблоны сообщений с переменными
// {имя} {дата} {время} {услуга} {адрес} {цена} {окна}.

import { el, navBar, groupedList, openSheet, toast } from '../components/ui.js';
import { TEMPLATE_DEFS, TEMPLATE_VARS, getTemplates, saveTemplate } from '../messaging.js';

export function TemplatesScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Уведомления для клиентов', onBack: () => nav.pop() }), body);

  async function refresh() {
    const templates = await getTemplates();
    body.replaceChildren(
      el('div', { class: 'hint pad' }, 'Шаблоны подставляются в WhatsApp или Telegram из карточки записи, чатов и листа ожидания. Переменные в фигурных скобках заменяются данными клиента и записи.'),
      groupedList(TEMPLATE_DEFS.map((t) => ({
        title: t.title,
        subtitle: templates.get(t.key),
        onClick: () => edit(t, templates.get(t.key)),
      }))));
  }

  function edit(def, text) {
    const ta = el('textarea', { class: 'input', rows: 6 });
    ta.value = text;
    openSheet({
      title: def.title,
      content: el('div', { class: 'form' },
        el('div', { class: 'hint' }, def.hint),
        ta,
        el('div', { class: 'var-chips' }, TEMPLATE_VARS.map((v) => el('button', { class: 'chip', type: 'button', onclick: () => {
          const pos = ta.selectionStart ?? ta.value.length;
          ta.value = ta.value.slice(0, pos) + v + ta.value.slice(ta.selectionEnd ?? pos);
          ta.focus();
        } }, v))),
        el('button', { class: 'link-btn', type: 'button', onclick: () => { ta.value = def.text; } }, 'Вернуть текст по умолчанию')),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        const v = ta.value.trim();
        if (!v) { toast('Текст не может быть пустым'); return false; }
        await saveTemplate(def.key, v === def.text ? null : v);
        toast('Шаблон сохранён');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
