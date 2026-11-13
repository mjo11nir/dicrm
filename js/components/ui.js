// Переиспользуемые компоненты интерфейса: создание элементов, Toast, BottomSheet,
// SegmentedControl, NavBar, GroupedList, EmptyState, лист действий и подтверждение.

import { icon } from './icons.js';

/** Экранирование текста для вставки в HTML */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Создать элемент из HTML-строки (первый корневой элемент) */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

/** Создать элемент: el('div', {class: 'x', onclick: fn}, ...дети) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Аватарка клиента: фото или серый силуэт; с колокольчиком, если отправлено напоминание */
export function avatar(client, { size = 44, bell = false } = {}) {
  const wrap = el('div', { class: 'avatar', style: { width: size + 'px', height: size + 'px' } });
  if (client?.avatar) {
    wrap.appendChild(el('img', { src: client.avatar, alt: '' }));
  } else {
    wrap.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#D1D1D6"/><circle cx="20" cy="15.5" r="7" fill="#fff"/><path d="M6.5 33.5c2.5-6 7.5-9 13.5-9s11 3 13.5 9A19.9 19.9 0 0 1 20 40a19.9 19.9 0 0 1-13.5-6.5z" fill="#fff"/></svg>';
  }
  if (bell) wrap.appendChild(html(`<span class="avatar-bell">${icon('bellFill')}</span>`));
  return wrap;
}

// ---------- Toast ----------

let toastTimer = null;
/**
 * Короткое уведомление снизу экрана. Опционально — кнопка «Отменить».
 * @param {string} text
 * @param {{undo?: Function, duration?: number}} opts
 */
export function toast(text, { undo = null, action = null, duration = 3500 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = el('div', { class: 'toast', role: 'status' }, el('span', {}, text));
  // undo — кнопка «Отменить»; action — своя кнопка { label, onClick }
  const btn = undo ? { label: 'Отменить', onClick: undo } : action;
  if (btn) {
    t.appendChild(el('button', {
      class: 'toast-undo',
      onclick: async () => { t.remove(); await btn.onClick(); },
    }, btn.label));
  }
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ---------- BottomSheet ----------

/**
 * Лист, выезжающий снизу. Есть «ручка», закрывается свайпом вниз, тапом по фону и кнопкой.
 * @param {{title?: string, content: Node, actionText?: string, onAction?: Function, onClose?: Function, full?: boolean}} o
 * @returns {{close: Function, el: HTMLElement, setAction: Function}}
 */
export function openSheet({ title = '', content, actionText = '', onAction = null, onClose = null, full = false, cancelText = 'Закрыть' }) {
  const backdrop = el('div', { class: 'sheet-backdrop' });
  const sheet = el('div', { class: 'sheet' + (full ? ' sheet-full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const handle = el('div', { class: 'sheet-handle' }, el('span'));
  const head = el('div', { class: 'sheet-head' },
    el('button', { class: 'link-btn', type: 'button', onclick: () => close() }, cancelText),
    el('div', { class: 'sheet-title' }, title),
    actionText
      ? el('button', { class: 'link-btn bold', type: 'button', onclick: async (e) => {
        // currentTarget обнуляется после await — запоминаем кнопку заранее
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const r = await onAction?.();
          if (r !== false) close();
        } finally { btn.disabled = false; }
      } }, actionText)
      : el('span', { class: 'link-btn-placeholder' }));
  const body = el('div', { class: 'sheet-body' }, content);
  sheet.append(handle, head, body);
  document.body.append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('show');
    sheet.classList.remove('show');
    sheet.style.transform = '';
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 320);
    onClose?.();
  }
  backdrop.addEventListener('click', close);

  // Свайп вниз за ручку или шапку
  let startY = null;
  let dy = 0;
  const onStart = (e) => { startY = (e.touches ? e.touches[0] : e).clientY; dy = 0; sheet.style.transition = 'none'; };
  const onMove = (e) => {
    if (startY === null) return;
    dy = Math.max(0, (e.touches ? e.touches[0] : e).clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (startY === null) return;
    startY = null;
    sheet.style.transition = '';
    if (dy > 90) close();
    else sheet.style.transform = '';
  };
  for (const zone of [handle, head]) {
    zone.addEventListener('touchstart', onStart, { passive: true });
    zone.addEventListener('touchmove', onMove, { passive: true });
    zone.addEventListener('touchend', onEnd);
  }
  // Свайп вниз по содержимому, когда оно прокручено до верха
  body.addEventListener('touchstart', (e) => { if (body.scrollTop <= 0) onStart(e); }, { passive: true });
  body.addEventListener('touchmove', (e) => { if (startY !== null && body.scrollTop <= 0) onMove(e); }, { passive: true });
  body.addEventListener('touchend', onEnd);

  return { close, el: sheet, body };
}

/**
 * Модальный экран на всю высоту, выезжает снизу. NavBar: слева «Закрыть», заголовок по центру.
 * @param {{title: string, content: Node, onClose?: Function}} o
 * @returns {{close: Function, el: HTMLElement, body: HTMLElement}}
 */
export function openModal({ title, content, onClose = null }) {
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const body = el('div', { class: 'modal-body' }, content);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 340);
    onClose?.();
  };
  modal.append(
    el('div', { class: 'navbar modal-nav' },
      el('div', { class: 'navbar-side' }, el('button', { class: 'link-btn', type: 'button', onclick: close }, 'Закрыть')),
      el('div', { class: 'navbar-title' }, title),
      el('div', { class: 'navbar-side right' })),
    body);
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));
  return { close, el: modal, body };
}

/** Сохранить файл на устройство (Blob или строка) */
export function downloadFile(name, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Однократная загрузка внешнего скрипта (библиотеки по CDN подключаются по требованию) */
const scriptCache = new Map();
export function loadScript(src) {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { scriptCache.delete(src); reject(new Error('Не удалось загрузить ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scriptCache.get(src);
}

/**
 * Лист выбора действия (как iOS action sheet).
 * @param {{title?: string, actions: {label: string, onClick: Function, danger?: boolean, icon?: string}[]}} o
 */
export function actionSheet({ title = '', message = '', actions }) {
  const backdrop = el('div', { class: 'sheet-backdrop as-backdrop' });
  const box = el('div', { class: 'action-sheet' });
  const group = el('div', { class: 'action-group' });
  if (title || message) {
    group.appendChild(el('div', { class: 'action-title' }, title && el('b', {}, title), message && el('div', {}, message)));
  }
  const close = () => {
    backdrop.classList.remove('show');
    box.classList.remove('show');
    setTimeout(() => { backdrop.remove(); box.remove(); }, 300);
  };
  for (const a of actions) {
    group.appendChild(el('button', {
      class: 'action-btn' + (a.danger ? ' danger' : '') + (a.bold ? ' bold' : ''),
      type: 'button',
      onclick: () => { close(); a.onClick?.(); },
    }, a.label));
  }
  box.append(group, el('button', { class: 'action-btn action-cancel', type: 'button', onclick: close }, 'Отмена'));
  backdrop.addEventListener('click', close);
  document.body.append(backdrop, box);
  requestAnimationFrame(() => { backdrop.classList.add('show'); box.classList.add('show'); });
}

/** Подтверждение действия. Возвращает Promise<boolean>. */
export function confirmAction({ title, message = '', okText = 'Да', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    actionSheet({
      title,
      message,
      actions: [{ label: okText, danger, bold: !danger, onClick: () => { answered = true; resolve(true); } }],
    });
    // Если лист закрыли без выбора — false
    const obs = new MutationObserver(() => {
      if (!document.querySelector('.action-sheet')) { obs.disconnect(); if (!answered) resolve(false); }
    });
    obs.observe(document.body, { childList: true });
  });
}

// ---------- SegmentedControl ----------

/**
 * Переключатель сегментов iOS.
 * @param {{options: {value: string, label: string}[], value: string, onChange: Function, full?: boolean}} o
 */
export function segmented({ options, value, onChange, full = false }) {
  const root = el('div', { class: 'segmented' + (full ? ' full' : ''), role: 'tablist' });
  const thumb = el('div', { class: 'seg-thumb' });
  root.appendChild(thumb);
  const buttons = options.map((o, i) => {
    const b = el('button', { class: 'seg-btn', type: 'button', role: 'tab', onclick: () => {
      if (o.value === value) return;
      const res = onChange(o.value);
      if (res === false) return;
      setValue(o.value);
    } }, o.label);
    b.dataset.index = i;
    root.appendChild(b);
    return b;
  });
  function setValue(v) {
    value = v;
    const i = options.findIndex((o) => o.value === v);
    buttons.forEach((b, j) => b.classList.toggle('active', j === i));
    thumb.style.width = `calc((100% - 4px) / ${options.length})`;
    thumb.style.transform = `translateX(${i * 100}%)`;
  }
  setValue(value);
  root.setValue = setValue;
  return root;
}

// ---------- NavBar ----------

/** Навигационная панель: фиолетовая стрелка «назад», заголовок по центру, правая кнопка */
export function navBar({ title = '', onBack = null, backText = '', right = null }) {
  return el('div', { class: 'navbar' },
    el('div', { class: 'navbar-side' },
      onBack ? el('button', { class: 'nav-back', type: 'button', 'aria-label': 'Назад', onclick: onBack, html: icon('chevronLeft') + (backText ? `<span>${esc(backText)}</span>` : '') }) : null),
    el('div', { class: 'navbar-title' }, title),
    el('div', { class: 'navbar-side right' }, right));
}

// ---------- GroupedList ----------

/**
 * Группа строк iOS.
 * rows: [{icon, iconBg, title, subtitle, value, chevron, onClick, badge, danger, control}]
 */
export function groupedList(rows, { header = '', footer = '' } = {}) {
  const wrap = el('div', { class: 'group-wrap' });
  if (header) wrap.appendChild(el('div', { class: 'group-header' }, header));
  const g = el('div', { class: 'group' });
  for (const r of rows) {
    // Строку с переключателем делаем div (кнопка внутри кнопки недопустима)
    const asButton = r.onClick && !r.control;
    const row = el(asButton ? 'button' : 'div', {
      class: 'row' + (r.onClick ? ' tappable' : '') + (r.danger ? ' danger' : ''),
      type: asButton ? 'button' : null,
      role: r.onClick && !asButton ? 'button' : null,
      tabindex: r.onClick && !asButton ? '0' : null,
      onclick: r.onClick || null,
    });
    if (r.icon) row.appendChild(el('span', { class: 'row-icon', style: { background: r.iconBg || 'var(--primary)' }, html: icon(r.icon) }));
    const text = el('div', { class: 'row-text' }, el('div', { class: 'row-title' }, r.title));
    if (r.subtitle) text.appendChild(el('div', { class: 'row-sub' }, r.subtitle));
    row.appendChild(text);
    if (r.badge) row.appendChild(el('span', { class: 'badge-soon' }, r.badge));
    if (r.value !== undefined && r.value !== null && r.value !== '') row.appendChild(el('span', { class: 'row-value' }, r.value));
    if (r.control) row.appendChild(r.control);
    if (r.chevron !== false && r.onClick) row.appendChild(el('span', { class: 'row-chevron', html: icon('chevronRight') }));
    g.appendChild(row);
  }
  wrap.appendChild(g);
  if (footer) wrap.appendChild(el('div', { class: 'group-footer' }, footer));
  return wrap;
}

/** Переключатель iOS (switch) */
export function toggle(checked, onChange) {
  const input = el('input', { type: 'checkbox', class: 'switch', role: 'switch' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  input.addEventListener('click', (e) => e.stopPropagation());
  return input;
}

/** Пустое состояние */
export function emptyState({ title, text = '', action = null }) {
  return el('div', { class: 'empty' },
    el('div', { class: 'empty-title' }, title),
    text ? el('div', { class: 'empty-text' }, text) : null,
    action ? el('button', { class: 'link-btn', type: 'button', onclick: action.onClick }, action.label) : null);
}

/** Поле формы с подписью */
export function field(label, input, hint = '') {
  return el('label', { class: 'field' },
    el('span', { class: 'field-label' }, label),
    input,
    hint ? el('span', { class: 'field-hint' }, hint) : null);
}

/** Добавить «пружинящую» реакцию на нажатие (scale .97) */
export function pressable(node) {
  node.classList.add('pressable');
  return node;
}

/** Свайп влево/вправо по элементу. dir: -1 (влево → следующий), 1 (вправо → предыдущий) */
export function onSwipe(node, handler) {
  let x0 = null;
  let y0 = null;
  node.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) handler(dx < 0 ? -1 : 1);
  });
}
