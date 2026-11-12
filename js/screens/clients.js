// Клиенты — базовая версия этапа 1: алфавитный список, поиск, добавление,
// быстрые действия (новая запись, звонок, WhatsApp). Полная карточка клиента — этап 2.

import * as data from '../db.js';
import { el, navBar, avatar, openSheet, field, toast, actionSheet, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { phoneDigits } from '../utils/appt.js';

export function ClientsScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const search = el('input', { class: 'input search-input', type: 'search', placeholder: 'Поиск по имени или телефону', autocomplete: 'off' });
  const list = el('div', { class: 'clients-list' });
  root.append(
    navBar({ title: 'Клиенты', onBack: () => nav.pop(), right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить клиента', html: icon('plus'), onclick: () => addClient() }) }),
    el('div', { class: 'page-body' }, search, list));
  search.addEventListener('input', () => render());

  let clients = [];
  async function refresh() {
    clients = (await data.getAll('clients')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    render();
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const found = clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && phoneDigits(c.phone).includes(qd)));
    list.replaceChildren();
    if (!found.length) {
      list.appendChild(emptyState({ title: q ? 'Никого не нашли' : 'Клиентов пока нет', action: { label: 'Добавить клиента', onClick: () => addClient(search.value.trim()) } }));
      return;
    }
    let letter = '';
    let group = null;
    for (const c of found) {
      const l = c.name[0]?.toUpperCase() || '#';
      if (l !== letter) {
        letter = l;
        list.appendChild(el('div', { class: 'group-header' }, l));
        group = el('div', { class: 'group' });
        list.appendChild(group);
      }
      group.appendChild(el('button', { class: 'row tappable', type: 'button', onclick: () => clientActions(c) },
        avatar(c, { size: 36 }),
        el('div', { class: 'row-text' }, el('div', { class: 'row-title' }, c.name), el('div', { class: 'row-sub' }, c.phone || 'без телефона'))));
    }
  }

  function clientActions(c) {
    const d = phoneDigits(c.phone);
    const actions = [{ label: 'Новая запись', bold: true, onClick: () => openAppointmentForm({ clientId: c.id }) }];
    if (d) {
      actions.push({ label: 'Позвонить', onClick: () => { window.location.href = `tel:+${d}`; } });
      actions.push({ label: 'Написать в WhatsApp', onClick: () => window.open(`https://wa.me/${d}`, '_blank', 'noopener') });
    }
    actions.push({ label: 'Изменить', onClick: () => addClient('', c) });
    actionSheet({ title: c.name, message: c.phone || '', actions });
  }

  function addClient(name = '', c = null) {
    const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Имя и фамилия', value: c?.name || name });
    const phoneIn = el('input', { class: 'input', type: 'tel', placeholder: '+7 900 000-00-00', value: c?.phone || '' });
    openSheet({
      title: c ? 'Клиент' : 'Новый клиент',
      content: el('div', { class: 'form' }, el('div', { class: 'form-section' }, field('Имя', nameIn), field('Телефон', phoneIn))),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!nameIn.value.trim()) { toast('Введите имя'); return false; }
        await data.save('clients', { ...(c || { notes: '', tags: [] }), name: nameIn.value.trim(), phone: phoneIn.value.trim() });
        toast(c ? 'Сохранено' : 'Клиент добавлен');
        return true;
      },
    });
  }

  refresh();
  return { el: root, refresh };
}
