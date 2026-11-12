// «Web-страница»: редактор визитки (описание, услуги с ценами, фото из Галереи, контакты, цвет)
// → предпросмотр и кнопка «Скачать HTML». Настройки страницы хранятся в settings.webPage.

import * as data from '../db.js';
import { el, navBar, field, toast, openModal, downloadFile } from '../components/ui.js';
import { icons } from '../components/icons.js';
import { THEMES } from './free-slots.js';
import { buildWebPage } from '../utils/webpage.js';
import { moneyFull } from '../utils/money.js';
import { formatDuration } from '../utils/dates.js';

/** Сколько фото можно поставить на страницу */
const MAX_PHOTOS = 9;

/** Blob → уменьшенный data URL (фото на странице не должны весить много) */
function blobToSmallDataUrl(blob, max = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Фото не открылось')); };
    img.src = url;
  });
}

export function WebPageScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Web-страница', onBack: () => nav.pop() }), body);
  const urls = [];

  let cfg = null;
  let services = [];
  let photos = [];
  let profile = null;

  async function load() {
    const [settings, prof, svc, gallery, locations] = await Promise.all([
      data.getSettings(), data.getProfile(), data.getAll('services'), data.getAll('gallery'), data.getAll('locations'),
    ]);
    profile = prof;
    services = svc.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    photos = gallery.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // Значения по умолчанию берутся из профиля
    cfg = {
      title: prof.name,
      description: 'Маникюр и педикюр с любовью к деталям. Стерильные инструменты, качественные материалы и уютная атмосфера.',
      phone: prof.phone,
      address: [locations[0]?.name, locations[0]?.address || prof.address].filter(Boolean).join(', '),
      instagram: '',
      telegram: '',
      theme: 'violet',
      serviceIds: services.map((s) => s.id),
      photoIds: photos.slice(0, 6).map((p) => p.id),
      ...(settings.webPage || {}),
    };
    render();
  }

  /** Сохранять изменения сразу (без кнопки «Сохранить») */
  let saveTimer = null;
  let selfSaved = false;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      selfSaved = true;
      data.setSetting('webPage', cfg);
    }, 400);
  }

  function input(key, attrs = {}) {
    const tag = attrs.textarea ? 'textarea' : 'input';
    const node = el(tag, { class: 'input', ...(attrs.textarea ? { rows: 4 } : { type: attrs.type || 'text' }), placeholder: attrs.placeholder || '' });
    node.value = cfg[key] || '';
    node.addEventListener('input', () => { cfg[key] = node.value; persist(); });
    return node;
  }

  function render() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const svcRows = services.map((s) => {
      const on = cfg.serviceIds.includes(s.id);
      return el('button', { class: 'svc-row' + (on ? ' on' : ''), type: 'button', onclick: () => {
        cfg.serviceIds = on ? cfg.serviceIds.filter((x) => x !== s.id) : [...cfg.serviceIds, s.id];
        persist();
        render();
      } }, el('span', { class: 'svc-check', html: on ? icons.check : '' }), el('span', { class: 'svc-name' }, s.name), el('span', { class: 'svc-meta' }, moneyFull(s.price)));
    });
    const photoCells = photos.map((p) => {
      const on = cfg.photoIds.includes(p.id);
      const u = URL.createObjectURL(p.blob);
      urls.push(u);
      return el('button', { class: 'photo-cell pick' + (on ? ' on' : ''), type: 'button', onclick: () => {
        if (!on && cfg.photoIds.length >= MAX_PHOTOS) { toast(`Не больше ${MAX_PHOTOS} фото`); return; }
        cfg.photoIds = on ? cfg.photoIds.filter((x) => x !== p.id) : [...cfg.photoIds, p.id];
        persist();
        render();
      } }, el('img', { src: u, alt: '' }), on ? el('span', { class: 'photo-check', html: icons.check }) : null);
    });
    const themes = el('div', { class: 'accent-row' }, Object.entries(THEMES).map(([k, t]) => el('button', {
      class: 'accent-sw' + (cfg.theme === k ? ' active' : ''), type: 'button', 'aria-label': t.label,
      style: { background: `linear-gradient(160deg, ${t.from}, ${t.to})` },
      onclick: () => { cfg.theme = k; persist(); render(); },
    })));

    body.replaceChildren(
      el('div', { class: 'hint pad' }, 'Страница-визитка для клиентов: услуги с ценами, ваши работы и кнопки для связи. Скачайте HTML-файл и выложите его на любой хостинг (например, GitHub Pages) или отправьте клиенту.'),
      el('div', { class: 'form' },
        el('div', { class: 'form-section' }, field('Заголовок', input('title')), field('Описание', input('description', { textarea: true }))),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, `Услуги (${cfg.serviceIds.length})`),
          svcRows.length ? svcRows : el('div', { class: 'pick-empty' }, 'Нет активных услуг')),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, `Фото из Галереи (${cfg.photoIds.length} из ${MAX_PHOTOS})`),
          photoCells.length ? el('div', { class: 'photo-grid' }, photoCells) : el('div', { class: 'pick-empty' }, 'В Галерее пока нет фото')),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Контакты'),
          field('Телефон', input('phone', { type: 'tel' })), field('Адрес', input('address')),
          el('div', { class: 'grid2' }, field('Instagram', input('instagram', { placeholder: '@username' })), field('Telegram', input('telegram', { placeholder: '@username' })))),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Цвет'), themes),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn btn-outline', type: 'button', onclick: preview }, 'Предпросмотр'),
          el('button', { class: 'btn btn-primary', type: 'button', onclick: download }, 'Скачать HTML'))));
  }

  /** Собрать HTML с текущими настройками */
  async function build() {
    const chosen = cfg.photoIds.map((id) => photos.find((p) => p.id === id)).filter(Boolean);
    const photoUrls = [];
    for (const p of chosen) {
      try { photoUrls.push(await blobToSmallDataUrl(p.blob)); } catch { /* пропускаем битое фото */ }
    }
    const settings = await data.getSettings();
    return buildWebPage(
      { ...cfg, theme: THEMES[cfg.theme] || THEMES.violet, appName: settings.appName },
      {
        services: services.filter((s) => cfg.serviceIds.includes(s.id)),
        photos: photoUrls,
        avatar: profile.avatar,
        money: moneyFull,
        duration: formatDuration,
      });
  }

  async function preview() {
    const htmlText = await build();
    const frame = el('iframe', { class: 'web-preview', title: 'Предпросмотр страницы', sandbox: '' });
    frame.srcdoc = htmlText;
    openModal({ title: 'Предпросмотр', content: frame });
  }

  async function download() {
    if (!cfg.title?.trim()) { toast('Укажите заголовок'); return; }
    const htmlText = await build();
    downloadFile('index.html', htmlText, 'text/html');
    toast('Файл index.html сохранён');
  }

  load();
  return {
    el: root,
    // Изменения в базе (например, новые фото) подхватываем, не теряя введённое
    // (своё автосохранение пропускаем, иначе поле ввода потеряет фокус)
    refresh: () => {
      if (selfSaved) { selfSaved = false; return; }
      if (cfg) load();
    },
    destroy: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}

