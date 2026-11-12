// Карточка клиента: фото, имя, телефон, мессенджеры, ДР, заметки, теги, визиты,
// сумма трат, средний чек, последний визит, следующая запись, личная скидка.

import * as data from '../db.js';
import { el, navBar, avatar, groupedList, openSheet, field, toast, confirmAction, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { AppointmentScreen } from './appointment.js';
import { formatDayShort, formatDayLong, fromMin, diffDays, today } from '../utils/dates.js';
import { money, moneyFull } from '../utils/money.js';
import { STATUSES, servicesTitle, phoneDigits } from '../utils/appt.js';
import { clientStats } from '../utils/clients.js';
import { resizeImage, pickImageFile } from '../utils/image.js';
import { photoGrid, createUrlPool, uploadPhotos } from './gallery.js';

export function ClientScreen({ id }, nav) {
  const pool = createUrlPool();
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({
    title: 'Клиент',
    onBack: () => nav.pop(),
    right: el('button', { class: 'link-btn', type: 'button', onclick: async () => openClientForm(await data.get('clients', id)) }, 'Изменить'),
  }), body);

  async function refresh() {
    const c = await data.get('clients', id);
    if (!c) {
      body.replaceChildren(emptyState({ title: 'Клиент удалён', action: { label: 'Назад', onClick: () => nav.pop() } }));
      return;
    }
    const all = (await data.getAll('appointments')).filter((a) => a.clientId === id);
    const photos = (await data.getAll('gallery')).filter((p) => p.clientId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    pool.clear();
    const st = clientStats(id, all);
    const d = phoneDigits(c.phone);

    // Шапка: фото (нажатие — загрузить), имя, телефон, связь
    const photo = el('button', { class: 'client-photo', type: 'button', 'aria-label': 'Изменить фото', onclick: () => changePhoto(c) },
      avatar(c, { size: 84 }), el('span', { class: 'client-photo-edit' }, c.avatar ? 'Изменить' : 'Фото'));
    const contact = (ic, label, href) => href
      ? el('a', { class: 'contact-btn', href, target: ic === 'phone' ? '_self' : '_blank', rel: 'noopener' }, el('span', { html: icon(ic) }), el('span', {}, label))
      : el('button', { class: 'contact-btn', type: 'button', disabled: true }, el('span', { html: icon(ic) }), el('span', {}, label));
    const tg = c.telegram ? `https://t.me/${c.telegram.replace(/^@/, '')}` : (d ? `https://t.me/+${d}` : null);
    const head = el('div', { class: 'appt-head card' },
      photo,
      el('div', { class: 'appt-head-name' }, c.name),
      c.phone ? el('div', { class: 'appt-head-phone' }, c.phone) : null,
      c.tags?.length ? el('div', { class: 'tag-row' }, c.tags.map((t) => el('span', { class: 'tag' }, t))) : null,
      el('div', { class: 'contact-row four' },
        contact('phone', 'Позвонить', d ? `tel:+${d}` : null),
        contact('whatsapp', 'WhatsApp', d ? `https://wa.me/${d}` : null),
        contact('send', 'Telegram', tg),
        el('button', { class: 'contact-btn', type: 'button', onclick: () => openAppointmentForm({ clientId: c.id }) }, el('span', { html: icon('calendarPlus') }), el('span', {}, 'Записать'))));

    // Показатели
    const stats = el('div', { class: 'client-stats' },
      statBox(String(st.visits), 'визитов'),
      statBox(money(st.spent), 'потрачено'),
      statBox(money(st.avg), 'средний чек'));

    const info = [
      { title: 'Следующая запись', value: st.next ? `${formatDayShort(st.next.date)}, ${fromMin(st.next.start)}` : 'нет', onClick: st.next ? () => nav.push(AppointmentScreen, { id: st.next.id }) : null },
      { title: 'Последний визит', value: st.lastVisit ? (st.lastVisit === today() ? 'сегодня' : `${formatDayShort(st.lastVisit)} (${diffDays(st.lastVisit, today())} дн. назад)`) : 'ещё не было' },
      { title: 'День рождения', value: c.birthday ? formatDayLong(c.birthday).replace(/ \d{4}$/, '') : 'не указан' },
      { title: 'Личная скидка', value: c.discount ? `${c.discount}%` : 'нет' },
    ];

    const visits = st.appts.slice(0, 50).map((a) => ({
      title: `${formatDayShort(a.date)}, ${fromMin(a.start)}`,
      subtitle: `${servicesTitle(a)} · ${STATUSES[a.status]?.label || ''}`,
      value: moneyFull(a.total),
      onClick: () => nav.push(AppointmentScreen, { id: a.id }),
    }));

    body.replaceChildren(...[
      head,
      stats,
      groupedList(info),
      c.notes ? groupedList([{ title: c.notes }], { header: 'Заметки' }) : null,
      el('div', { class: 'group-header-row' }, el('span', {}, `Фото работ (${photos.length})`),
        el('button', { class: 'link-btn small', type: 'button', onclick: () => uploadPhotos({ clientId: id }) }, '+ Добавить')),
      photos.length ? el('div', { class: 'client-photos' }, photoGrid(photos.slice(0, 9), pool)) : null,
      visits.length ? groupedList(visits, { header: `Все визиты (${st.appts.length})` }) : groupedList([{ title: 'Записей пока нет' }], { header: 'Визиты' }),
      el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: () => removeClient(c, st) }, 'Удалить клиента'),
    ].filter(Boolean));
  }

  function statBox(value, label) {
    return el('div', { class: 'card client-stat' }, el('div', { class: 'client-stat-v' }, value), el('div', { class: 'client-stat-l' }, label));
  }

  async function changePhoto(c) {
    const file = await pickImageFile();
    if (!file) return;
    try {
      const url = await resizeImage(file, { max: 400, square: true });
      await data.update('clients', c.id, { avatar: url });
      toast('Фото сохранено');
    } catch (e) {
      toast(e.message);
    }
  }

  async function removeClient(c, st) {
    const ok = await confirmAction({
      title: 'Удалить клиента?',
      message: st.appts.length ? `Записи клиента (${st.appts.length}) останутся в расписании.` : '',
      okText: 'Удалить', danger: true,
    });
    if (!ok) return;
    await data.remove('clients', c.id);
    nav.pop();
    toast('Клиент удалён', { undo: () => data.restore('clients', c.id) });
  }

  refresh();
  return { el: root, refresh, destroy: () => pool.clear() };
}

/** Форма создания/редактирования клиента */
export function openClientForm(c = null, { name = '', onSaved = null } = {}) {
  const nameIn = el('input', { class: 'input', type: 'text', placeholder: 'Имя и фамилия', value: c?.name || name });
  const phoneIn = el('input', { class: 'input', type: 'tel', placeholder: '+7 900 000-00-00', value: c?.phone || '' });
  const tgIn = el('input', { class: 'input', type: 'text', placeholder: '@username', value: c?.telegram || '' });
  const bdIn = el('input', { class: 'input', type: 'date', value: c?.birthday || '' });
  const discIn = el('input', { class: 'input', type: 'number', min: 0, max: 100, inputmode: 'numeric', placeholder: '0', value: c?.discount || '' });
  const tagsIn = el('input', { class: 'input', type: 'text', placeholder: 'VIP, аллергия на…', value: (c?.tags || []).join(', ') });
  const notesIn = el('textarea', { class: 'input', rows: 3, placeholder: 'Заметки' });
  notesIn.value = c?.notes || '';
  openSheet({
    title: c ? 'Клиент' : 'Новый клиент',
    full: true,
    content: el('div', { class: 'form' },
      el('div', { class: 'form-section' }, field('Имя', nameIn), field('Телефон', phoneIn), field('Telegram', tgIn, 'Если не указан — ссылка строится по телефону')),
      el('div', { class: 'form-section' },
        el('div', { class: 'grid2' }, field('День рождения', bdIn), field('Личная скидка, %', discIn)),
        field('Теги', tagsIn, 'Через запятую'),
        field('Заметки', notesIn))),
    actionText: 'Сохранить',
    cancelText: 'Отмена',
    onAction: async () => {
      if (!nameIn.value.trim()) { toast('Введите имя'); return false; }
      const saved = await data.save('clients', {
        ...(c || {}),
        name: nameIn.value.trim(),
        phone: phoneIn.value.trim(),
        telegram: tgIn.value.trim(),
        birthday: bdIn.value || '',
        discount: Math.min(100, Math.max(0, parseFloat(discIn.value) || 0)),
        tags: tagsIn.value.split(',').map((s) => s.trim()).filter(Boolean),
        notes: notesIn.value.trim(),
      });
      toast(c ? 'Сохранено' : 'Клиент добавлен');
      onSaved?.(saved);
      return true;
    },
  });
}
