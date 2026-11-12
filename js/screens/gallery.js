// «Галерея»: загрузка фото с телефона (сжимаются до 1600px и хранятся в IndexedDB как Blob),
// сетка в 3 колонки, подписи, теги «до/после», привязка к клиенту и услуге.

import * as data from '../db.js';
import { el, navBar, openSheet, field, toast, confirmAction, emptyState, segmented } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { resizeToBlob, pickImageFiles } from '../utils/image.js';
import { today, formatDayShort } from '../utils/dates.js';

const TAGS = { '': 'Без тега', before: 'До', after: 'После' };

/** Object URL для Blob — освобождается при следующей перерисовке */
function createUrlPool() {
  let urls = [];
  return {
    url(blob) {
      const u = URL.createObjectURL(blob);
      urls.push(u);
      return u;
    },
    clear() {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls = [];
    },
  };
}

/** Загрузить выбранные фото в галерею (можно сразу привязать к клиенту) */
export async function uploadPhotos(defaults = {}) {
  const files = await pickImageFiles(true);
  if (!files.length) return 0;
  toast(`Загружаем фото: ${files.length}…`);
  let n = 0;
  for (const f of files) {
    try {
      const blob = await resizeToBlob(f, { max: 1600 });
      await data.save('gallery', { blob, caption: '', tag: '', clientId: null, serviceId: null, date: today(), ...defaults });
      n++;
    } catch (e) {
      console.warn('Фото не загружено:', e);
    }
  }
  toast(n ? `Добавлено фото: ${n}` : 'Не удалось загрузить фото');
  return n;
}

/** Просмотр и редактирование фото */
export async function openPhoto(photo) {
  const [clients, services] = await Promise.all([data.getAll('clients'), data.getAll('services')]);
  clients.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const url = URL.createObjectURL(photo.blob);
  let tag = photo.tag || '';
  const captionIn = el('input', { class: 'input', type: 'text', placeholder: 'Подпись', value: photo.caption || '' });
  const clientSel = el('select', { class: 'input' }, el('option', { value: '' }, 'Не выбран'), clients.map((c) => el('option', { value: c.id }, c.name)));
  clientSel.value = photo.clientId || '';
  const svcSel = el('select', { class: 'input' }, el('option', { value: '' }, 'Не выбрана'), services.map((s) => el('option', { value: s.id }, s.name)));
  svcSel.value = photo.serviceId || '';
  const tagSeg = segmented({ options: Object.entries(TAGS).map(([value, label]) => ({ value, label })), value: tag, full: true, onChange: (v) => { tag = v; } });
  const sheet = openSheet({
    title: formatDayShort(photo.date || today()),
    full: true,
    content: el('div', { class: 'form' },
      el('img', { class: 'photo-full', src: url, alt: photo.caption || 'Фото работы' }),
      tagSeg,
      el('div', { class: 'form-section' }, field('Подпись', captionIn), field('Клиент', clientSel), field('Услуга', svcSel)),
      el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        if (!(await confirmAction({ title: 'Удалить фото?', okText: 'Удалить', danger: true }))) return;
        await data.remove('gallery', photo.id);
        sheet.close();
        toast('Фото удалено', { undo: () => data.restore('gallery', photo.id) });
      } }, 'Удалить фото')),
    actionText: 'Сохранить',
    cancelText: 'Закрыть',
    onAction: async () => {
      await data.save('gallery', { ...photo, caption: captionIn.value.trim(), tag, clientId: clientSel.value || null, serviceId: svcSel.value || null });
      toast('Сохранено');
      return true;
    },
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 400),
  });
}

/** Сетка миниатюр (используется и в карточке клиента) */
export function photoGrid(photos, pool) {
  return el('div', { class: 'photo-grid' }, photos.map((p) => el('button', { class: 'photo-cell', type: 'button', onclick: () => openPhoto(p) },
    el('img', { src: pool.url(p.blob), alt: p.caption || 'Фото работы', loading: 'lazy' }),
    p.tag ? el('span', { class: 'photo-tag' }, TAGS[p.tag]) : null)));
}

export { createUrlPool };

export function GalleryScreen(params, nav) {
  let filter = 'all';
  const pool = createUrlPool();
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  const chips = el('div', { class: 'feed-chips' });
  const grid = el('div', {});
  body.append(chips, grid);
  root.append(navBar({
    title: 'Галерея',
    onBack: () => nav.pop(),
    right: el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Добавить фото', html: icon('plus'), onclick: () => uploadPhotos() }),
  }), body);

  async function refresh() {
    const [photos, clientsMap] = await Promise.all([data.getAll('gallery'), data.getClientsMap()]);
    photos.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
    chips.replaceChildren(...[['all', 'Все'], ['before', 'До'], ['after', 'После'], ['client', 'С клиентом']].map(([v, l]) => el('button', {
      class: 'chip' + (filter === v ? ' active-primary' : ''), type: 'button', onclick: () => { filter = v; refresh(); },
    }, l)));
    const shown = photos.filter((p) => filter === 'all' || (filter === 'client' ? p.clientId && clientsMap.has(p.clientId) : p.tag === filter));
    pool.clear();
    if (!shown.length) {
      grid.replaceChildren(emptyState({
        title: photos.length ? 'Нет фото по фильтру' : 'Фото пока нет',
        text: 'Добавляйте фото работ с телефона — они хранятся только на этом устройстве.',
        action: { label: 'Добавить фото', onClick: () => uploadPhotos() },
      }));
      return;
    }
    grid.replaceChildren(el('div', { class: 'list-count' }, `Фото: ${shown.length}`), photoGrid(shown, pool));
  }

  refresh();
  return { el: root, refresh, destroy: () => pool.clear() };
}
