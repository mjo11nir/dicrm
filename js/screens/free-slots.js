// «Свободные окна» (docs/screenshots/05-free-slots.jpg, 06-free-slots-share.jpg).
// Модальный экран с двумя вкладками:
//  • «Поделиться» — карточка со свободным временем → PNG (html2canvas) или текст → меню «Поделиться»;
//  • «Найти и записать» — услуга + период → ближайшие слоты → форма записи.
// Сами окна считает только js/utils/slots.js.

import * as data from '../db.js';
import { el, html, esc, openModal, segmented, groupedList, actionSheet, openSheet, field, toast, emptyState, loadScript } from '../components/ui.js';
import { openAppointmentForm } from '../components/appointment-form.js';
import { getFreeSlotsRange } from '../utils/slots.js';
import {
  today, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, parseYmd,
  fromMinShort, formatDayShort, formatDuration, MONTHS_SHORT,
} from '../utils/dates.js';
import { moneyFull } from '../utils/money.js';
import { logoSvg } from './home.js';

const HTML2CANVAS = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

/** Цветовые темы карточки: градиент шапки */
export const THEMES = {
  violet: { label: 'Фиолетовая', from: '#8A2BE2', to: '#B57BF5' },
  pink: { label: 'Розовая', from: '#E0287D', to: '#F57AB3' },
  teal: { label: 'Бирюзовая', from: '#078EA7', to: '#4FC3D6' },
  green: { label: 'Зелёная', from: '#1E9E3E', to: '#6FD48A' },
  orange: { label: 'Оранжевая', from: '#E8890C', to: '#F7BE5C' },
  graphite: { label: 'Графит', from: '#2C2C2E', to: '#6B6B70' },
};

const PERIODS = {
  next4w: 'Ближайшие 4 недели',
  thisWeek: 'Эта неделя',
  nextWeek: 'Следующая неделя',
  thisMonth: 'Этот месяц',
  nextMonth: 'Следующий месяц',
  custom: 'Свой период',
};

/** Даты начала и конца периода (прошедшие дни отрезаются) */
export function periodRange(kind, custom = null) {
  const t = today();
  let from;
  let to;
  switch (kind) {
    case 'thisWeek': from = t; to = addDays(startOfWeek(t), 6); break;
    case 'nextWeek': from = addDays(startOfWeek(t), 7); to = addDays(from, 6); break;
    case 'thisMonth': from = t; to = endOfMonth(t); break;
    case 'nextMonth': from = addMonths(t, 1); to = endOfMonth(from); break;
    case 'custom': from = custom?.from || t; to = custom?.to || addDays(t, 27); break;
    default: from = t; to = addDays(t, 27);
  }
  if (from < t) from = t;
  return { from, to };
}

/** «1 дек. - 28 дек.» */
function periodLabel({ from, to }) {
  const f = parseYmd(from);
  const tt = parseYmd(to);
  return `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} - ${tt.getDate()} ${MONTHS_SHORT[tt.getMonth()]}`;
}

/** Выбор периода (лист действий + свои даты). onPick(kind, custom) */
function pickPeriod(current, onPick) {
  actionSheet({
    title: 'Период',
    actions: Object.entries(PERIODS).map(([k, label]) => ({
      label: label + (k === current ? ' ✓' : ''),
      onClick: () => {
        if (k !== 'custom') return onPick(k, null);
        const fromIn = el('input', { class: 'input', type: 'date', value: today() });
        const toIn = el('input', { class: 'input', type: 'date', value: addDays(today(), 13) });
        openSheet({
          title: 'Свой период',
          content: el('div', { class: 'form' }, el('div', { class: 'form-section' }, el('div', { class: 'grid2' }, field('С', fromIn), field('По', toIn)))),
          actionText: 'Готово',
          cancelText: 'Отмена',
          onAction: () => {
            if (!fromIn.value || !toIn.value || toIn.value < fromIn.value) { toast('Проверьте даты'); return false; }
            if (toIn.value < today()) { toast('Период уже прошёл'); return false; }
            onPick('custom', { from: fromIn.value, to: toIn.value });
            return true;
          },
        });
      },
    })),
  });
}

/** Загрузить всё нужное и посчитать окна за период */
async function computeSlots(range, slotDuration, step = 0) {
  const [{ schedule, exceptions }, appointments, breaks] = await Promise.all([
    data.getScheduleData(), data.getAppointmentsBetween(range.from, range.to), data.getBreaksBetween(range.from, range.to),
  ]);
  return getFreeSlotsRange({ ...range, schedule, exceptions, appointments, breaks, slotDuration, step });
}

/** Открыть экран «Свободные окна» */
export async function openFreeSlots(initialTab = 'share') {
  const st = {
    tab: initialTab,
    // Настройки «Поделиться» запоминаются
    period: 'next4w',
    custom: null,
    view: 'image',
    theme: 'violet',
    locationId: null,
    // «Найти и записать»
    serviceId: null,
    findPeriod: 'nextWeek',
    findCustom: null,
  };
  const s0 = await data.getSettings();
  Object.assign(st, {
    period: s0.freeSlotsPeriod || st.period,
    view: s0.freeSlotsView || st.view,
    theme: THEMES[s0.freeSlotsTheme] ? s0.freeSlotsTheme : st.theme,
  });

  const content = el('div', { class: 'fs' });
  const segBox = el('div', { class: 'fs-seg' }, segmented({
    options: [{ value: 'share', label: 'Поделиться' }, { value: 'find', label: 'Найти и записать' }],
    value: st.tab,
    full: true,
    onChange: (v) => { st.tab = v; render(); },
  }));
  const pane = el('div', {});
  content.append(segBox, pane);
  const modal = openModal({ title: 'Свободные окна', content, onClose: () => window.removeEventListener('db:change', render) });
  // Пока экран открыт, обновляем его после изменений (например, создали запись из слота)
  window.addEventListener('db:change', render);

  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    const node = st.tab === 'share' ? await renderShare() : await renderFind();
    if (seq === renderSeq) pane.replaceChildren(node);
  }

  // ---------- Вкладка «Поделиться» ----------
  async function renderShare() {
    const [settings, profile, locations] = await Promise.all([data.getSettings(), data.getProfile(), data.getAll('locations')]);
    const location = locations.find((l) => l.id === st.locationId) || locations[0] || null;
    const range = periodRange(st.period, st.custom);
    const days = await computeSlots(range, settings.slotDuration);
    const theme = THEMES[st.theme];

    const swatch = el('span', { class: 'theme-swatch', style: { background: `linear-gradient(160deg, ${theme.from}, ${theme.to})` } });
    const rows = groupedList([
      location
        ? { title: location.name, subtitle: location.address, onClick: () => pickLocation(locations) }
        : { title: 'Место работы не указано', subtitle: 'Добавьте в «График и место работы»' },
      { title: 'Период', value: periodLabel(range), onClick: () => pickPeriod(st.period, (k, c) => { st.period = k; st.custom = c; if (k !== 'custom') data.setSetting('freeSlotsPeriod', k); render(); }) },
      { title: 'Вид', value: st.view === 'image' ? 'Изображение (соцсети)' : 'Текст', onClick: () => actionSheet({
        title: 'Вид',
        actions: [
          { label: 'Изображение (соцсети)', onClick: () => { st.view = 'image'; data.setSetting('freeSlotsView', 'image'); render(); } },
          { label: 'Текст', onClick: () => { st.view = 'text'; data.setSetting('freeSlotsView', 'text'); render(); } },
        ],
      }) },
      { title: 'Цветовая тема', control: swatch, onClick: () => pickTheme() },
    ]);

    const text = buildText(days, profile, location);
    const preview = st.view === 'image'
      ? buildCard(days, profile, location, theme)
      : el('div', { class: 'fs-text-preview' }, text);

    const sendBtn = el('button', { class: 'btn btn-primary fs-send', type: 'button' }, 'Отправить');
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      try {
        if (st.view === 'image') await shareImage(preview);
        else await shareText(text);
      } finally {
        sendBtn.disabled = false;
      }
    });

    return el('div', {},
      el('div', { class: 'fs-hint' }, 'Укажите, когда у вас есть свободное для записи время. Для этого выберите нужный временной период. Интервалы отображаются с учётом записей, перерывов и графика работы, без учёта длительности услуг.'),
      rows,
      el('div', { class: 'fs-section' }, 'Свободные окна по дням'),
      el('div', { class: 'fs-preview-wrap' }, preview),
      el('div', { class: 'fs-send-wrap' }, sendBtn));
  }

  function pickLocation(locations) {
    if (locations.length < 2) { toast('Другие места работы добавляются в «График и место работы»'); return; }
    actionSheet({
      title: 'Место работы',
      actions: locations.map((l) => ({ label: l.name, onClick: () => { st.locationId = l.id; render(); } })),
    });
  }

  function pickTheme() {
    const grid = el('div', { class: 'theme-grid' }, Object.entries(THEMES).map(([k, t]) => el('button', {
      class: 'theme-opt' + (k === st.theme ? ' active' : ''), type: 'button',
      onclick: () => { st.theme = k; data.setSetting('freeSlotsTheme', k); sheet.close(); render(); },
    }, el('span', { class: 'theme-swatch big', style: { background: `linear-gradient(160deg, ${t.from}, ${t.to})` } }), el('span', {}, t.label))));
    const sheet = openSheet({ title: 'Цветовая тема', content: grid });
  }

  // ---------- Вкладка «Найти и записать» ----------
  async function renderFind() {
    const services = (await data.getAll('services')).filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (!services.length) return emptyState({ title: 'Нет услуг', text: 'Добавьте услуги в «Другое → Профиль и настройки → Услуги и товары».' });
    const svc = services.find((s) => s.id === st.serviceId) || services[0];
    st.serviceId = svc.id;
    const range = periodRange(st.findPeriod, st.findCustom);
    const duration = svc.duration + (svc.breakAfter || 0);
    const days = await computeSlots(range, duration, 30);

    const rows = groupedList([
      { title: 'Услуга', value: svc.name, subtitle: `${formatDuration(svc.duration)} · ${moneyFull(svc.price)}`, onClick: () => actionSheet({
        title: 'Услуга',
        actions: services.map((s) => ({ label: s.name, onClick: () => { st.serviceId = s.id; render(); } })),
      }) },
      { title: 'Период', value: periodLabel(range), onClick: () => pickPeriod(st.findPeriod, (k, c) => { st.findPeriod = k; st.findCustom = c; render(); }) },
    ]);
    const list = el('div', { class: 'fs-find-list' });
    if (!days.length) list.appendChild(emptyState({ title: 'Свободного времени нет', text: 'Попробуйте другой период или услугу покороче.' }));
    for (const d of days) {
      list.appendChild(el('div', { class: 'slot-day' },
        el('div', { class: 'slot-day-title' }, formatDayShort(d.date, true)),
        el('div', { class: 'slot-times' }, d.slots.map((s) => el('button', {
          class: 'slot-time', type: 'button',
          onclick: () => openAppointmentForm({ date: d.date, start: s, serviceIds: [svc.id] }),
        }, fromMinShort(s))))));
    }
    return el('div', {},
      el('div', { class: 'fs-hint' }, 'Выберите услугу и период — покажем время, когда её можно провести целиком. Нажмите на время, чтобы записать клиента.'),
      rows, list);
  }

  render();
  return modal;
}

/** Карточка-превью для картинки */
function buildCard(days, profile, location, theme) {
  const logo = profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : logoSvg();
  const card = html(`
    <div class="fs-card">
      <div class="fs-card-head" style="background:linear-gradient(100deg, ${theme.from}, ${theme.to})">
        <div class="fs-card-logo">${logo}</div>
        <div class="fs-card-id">
          <div class="fs-card-name">${esc(profile.name)}</div>
          ${profile.phone ? `<div class="fs-card-line">${esc(profile.phone)}</div>` : ''}
          ${location ? `<div class="fs-card-line dim">${esc(location.name)}</div>` : ''}
          ${location?.address ? `<div class="fs-card-line dim">${esc(location.address)}</div>` : ''}
        </div>
        <div class="fs-card-cta">Записывайтесь!</div>
        <div class="fs-card-mark">${logoSvg()}</div>
      </div>
      <div class="fs-card-body">
        <div class="fs-card-title">Свободное время для записи:</div>
      </div>
    </div>`);
  const body = card.querySelector('.fs-card-body');
  if (!days.length) body.appendChild(el('div', { class: 'fs-card-empty' }, 'В выбранный период свободных окон нет'));
  for (const d of days) {
    body.appendChild(el('div', { class: 'fs-card-row' },
      el('span', { class: 'fs-card-day' }, formatDayShort(d.date, true)),
      el('span', { class: 'fs-card-times' }, d.slots.map((s) => el('span', {}, fromMinShort(s))))));
  }
  return card;
}

/** Текстовый вариант */
function buildText(days, profile, location) {
  const lines = [`Свободное время для записи${profile.name ? ' — ' + profile.name : ''}:`, ''];
  if (!days.length) lines.push('В выбранный период свободных окон нет.');
  for (const d of days) lines.push(`${formatDayShort(d.date, true)}: ${d.slots.map(fromMinShort).join(', ')}`);
  lines.push('');
  if (location) lines.push(`📍 ${location.name}${location.address ? ', ' + location.address : ''}`);
  if (profile.phone) lines.push(`📞 ${profile.phone}`);
  lines.push('Записывайтесь!');
  return lines.join('\n');
}

/** Отрисовать карточку в PNG (масштаб 3x) и открыть системное меню «Поделиться» */
async function shareImage(card) {
  try {
    await loadScript(HTML2CANVAS);
  } catch {
    toast('Не удалось загрузить html2canvas — нужен интернет при первом использовании');
    return;
  }
  const canvas = await window.html2canvas(card, { scale: 3, backgroundColor: null, useCORS: true, logging: false });
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) { toast('Не удалось создать картинку'); return; }
  const file = new File([blob], `svobodnye-okna-${today()}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Свободные окна' });
    } catch (e) {
      if (e.name !== 'AbortError') toast('Не удалось поделиться');
    }
    return;
  }
  // share с файлами недоступен (например, на компьютере) — скачиваем PNG
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: file.name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Картинка сохранена');
}

/** Скопировать текст и открыть меню «Поделиться» */
async function shareText(text) {
  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch { /* буфер обмена может быть недоступен */ }
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  toast(copied ? 'Текст скопирован' : 'Не удалось скопировать текст');
}
