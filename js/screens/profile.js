// «Профиль и настройки» (docs/screenshots/04-profile-settings.jpg).
// Сверху блок профиля (аватарка, имя, телефон, адрес, текст бейджа),
// ниже крупный заголовок «Настройки» и группы iOS с цветными иконками.

import * as data from '../db.js';
import { el, navBar, groupedList, openSheet, field, toast, toggle, actionSheet, segmented, downloadFile } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { TemplatesScreen } from './templates.js';
import { ScheduleSettingsScreen } from './schedule-settings.js';
import { ServicesScreen } from './services.js';
import { ClientsDataScreen } from './clients-data.js';
import { AlertsScreen } from './alerts.js';
import { WaitlistScreen } from './waitlist.js';
import { WebPageScreen } from './webpage.js';
import { buildIcs } from '../utils/ics.js';
import { today, addDays } from '../utils/dates.js';
import { logoSvg } from './home.js';
import { resizeImage, pickImageFile } from '../utils/image.js';

/** Акцентные цвета в «Оформлении» */
export const ACCENTS = [
  { value: '#9137E8', label: 'Фиолетовый' },
  { value: '#EB3485', label: 'Розовый' },
  { value: '#078EA7', label: 'Бирюзовый' },
  { value: '#007AFF', label: 'Синий' },
  { value: '#28B84A', label: 'Зелёный' },
  { value: '#F0A626', label: 'Оранжевый' },
];

export const CURRENCIES = ['€', '₺', '$', '₽'];

/** Темы оформления */
const THEMES_UI = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' };

const ORANGE = '#F0A626';
const VIOLET = '#9137E8';
const PINK = '#EB3485';
const GREEN = '#34C759';
const GRAY = '#AEAEB2';

/** Функция, которой нужен сервер: показываем пояснение вместо работы */
function soon(what) {
  toast(`${what} появится после подключения сервера`, { duration: 4500 });
}

export function ProfileScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Профиль', onBack: () => nav.pop() }), body);

  async function refresh() {
    const [profile, settings] = await Promise.all([data.getProfile(), data.getSettings()]);

    // ---- Блок профиля ----
    const ava = el('button', { class: 'profile-ava', type: 'button', 'aria-label': 'Изменить фото', onclick: () => changeAvatar(profile) },
      profile.avatar ? el('img', { src: profile.avatar, alt: '' }) : el('span', { class: 'home-logo', html: logoSvg() }),
      el('span', { class: 'profile-ava-cam', html: icon('camera') }));
    const card = el('div', { class: 'card profile-card' },
      ava,
      el('div', { class: 'profile-info' },
        el('div', { class: 'profile-name' }, profile.name),
        el('span', { class: 'home-badge' }, profile.badge || 'PRO'),
        profile.phone ? el('div', { class: 'profile-line' }, profile.phone) : null,
        profile.address ? el('div', { class: 'profile-line' }, profile.address) : null),
      el('button', { class: 'link-btn', type: 'button', onclick: () => editProfile(profile) }, 'Изменить'));

    body.replaceChildren(
      card,
      el('h2', { class: 'section-title' }, 'Настройки'),
      groupedList([
        { icon: 'scheduleSettings', iconBg: ORANGE, title: 'График и место работы', onClick: () => nav.push(ScheduleSettingsScreen) },
        { icon: 'clipboardPen', iconBg: ORANGE, title: 'Онлайн-запись', badge: 'Скоро', onClick: () => soon('Онлайн-запись для клиентов') },
        { icon: 'waitlist', iconBg: ORANGE, title: 'Лист ожидания', value: settings.waitlistEnabled === false ? 'Выкл' : 'Вкл', onClick: () => nav.push(WaitlistScreen) },
      ]),
      groupedList([
        { icon: 'bellService', iconBg: VIOLET, title: 'Услуги и товары', onClick: () => nav.push(ServicesScreen) },
      ]),
      groupedList([
        { icon: 'globe', iconBg: PINK, title: 'Web-страница', onClick: () => nav.push(WebPageScreen) },
      ]),
      groupedList([
        { icon: 'usersStroke', iconBg: PINK, title: 'Клиенты', onClick: () => nav.push(ClientsDataScreen) },
      ]),
      groupedList([
        { icon: 'messageCircle', iconBg: GREEN, title: 'Уведомления для клиентов', onClick: () => nav.push(TemplatesScreen) },
        { icon: 'bell', iconBg: GREEN, title: 'Оповещения', onClick: () => nav.push(AlertsScreen) },
        { icon: 'calendar', iconBg: GREEN, title: 'Синхронизация с календарем', onClick: () => openCalendarExport(settings) },
      ]),
      groupedList([
        { icon: 'palette', iconBg: GRAY, title: 'Оформление', value: THEMES_UI[settings.theme || 'auto'], onClick: () => openAppearance(settings) },
        { icon: 'languages', iconBg: GRAY, title: 'Язык и регион', value: settings.currency, onClick: () => openRegion(settings) },
      ]),
      groupedList([
        { icon: 'sync', iconBg: GRAY, title: 'Синхронизация', badge: 'Скоро', onClick: () => soon('Синхронизация между устройствами') },
      ], { footer: `${settings.appName} хранит все данные только на этом устройстве.` }),
    );
  }

  async function changeAvatar(profile) {
    const file = await pickImageFile();
    if (!file) return;
    try {
      const url = await resizeImage(file, { max: 400, square: true });
      await data.save('profile', { ...profile, avatar: url });
      toast('Фото профиля сохранено');
    } catch (e) {
      toast(e.message);
    }
  }

  function editProfile(profile) {
    const nameIn = el('input', { class: 'input', type: 'text', value: profile.name || '' });
    const phoneIn = el('input', { class: 'input', type: 'tel', value: profile.phone || '' });
    const addrIn = el('input', { class: 'input', type: 'text', value: profile.address || '' });
    const badgeIn = el('input', { class: 'input', type: 'text', maxlength: 20, value: profile.badge || 'PRO' });
    const content = el('div', { class: 'form' },
      el('div', { class: 'form-section' },
        field('Имя', nameIn), field('Телефон', phoneIn), field('Адрес', addrIn),
        field('Текст бейджа', badgeIn, 'Показывается под именем на Главной')));
    if (profile.avatar) {
      content.appendChild(el('button', { class: 'btn btn-danger-outline', type: 'button', onclick: async () => {
        await data.save('profile', { ...profile, avatar: null });
        sheet.close();
        toast('Фото удалено');
      } }, 'Удалить фото'));
    }
    const sheet = openSheet({
      title: 'Профиль',
      content,
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        if (!nameIn.value.trim()) { toast('Введите имя'); return false; }
        await data.save('profile', {
          ...profile,
          name: nameIn.value.trim(),
          phone: phoneIn.value.trim(),
          address: addrIn.value.trim(),
          badge: badgeIn.value.trim() || 'PRO',
        });
        toast('Профиль сохранён');
        return true;
      },
    });
  }

  function openAppearance(settings) {
    let accent = settings.accent || ACCENTS[0].value;
    const swatches = el('div', { class: 'accent-row' });
    const renderSw = () => swatches.replaceChildren(...ACCENTS.map((a) => el('button', {
      class: 'accent-sw' + (a.value === accent ? ' active' : ''), type: 'button', 'aria-label': a.label,
      style: { background: a.value }, onclick: () => { accent = a.value; renderSw(); },
    })));
    renderSw();
    let bg = settings.homeBackground !== false;
    let theme = settings.theme || 'auto';
    const themeSeg = segmented({
      options: Object.entries(THEMES_UI).map(([value, label]) => ({ value, label })),
      value: theme,
      full: true,
      onChange: (v) => { theme = v; },
    });
    const nameIn = el('input', { class: 'input', type: 'text', maxlength: 30, value: settings.appName });
    openSheet({
      title: 'Оформление',
      content: el('div', { class: 'form' },
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Тема'), themeSeg,
          el('div', { class: 'hint' }, '«Авто» — как в настройках iPhone.')),
        groupedList([{ title: 'Переливающийся фон Главной', control: toggle(bg, (v) => { bg = v; }) }]),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Акцентный цвет'), swatches),
        el('div', { class: 'form-section' }, field('Название приложения', nameIn))),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        await data.setSetting('theme', theme);
        await data.setSetting('homeBackground', bg);
        await data.setSetting('accent', accent);
        await data.setSetting('appName', nameIn.value.trim() || data.DEFAULT_SETTINGS.appName);
        toast('Оформление сохранено');
        return true;
      },
    });
  }

  /** Экспорт записей в .ics — файл открывается в Календаре iPhone («Добавить все») */
  function openCalendarExport(settings) {
    let range = 'future';
    const seg = segmented({
      options: [{ value: 'future', label: 'Будущие' }, { value: 'quarter', label: '3 месяца' }, { value: 'all', label: 'Все' }],
      value: range,
      full: true,
      onChange: (v) => { range = v; },
    });
    openSheet({
      title: 'Синхронизация с календарем',
      content: el('div', { class: 'form' },
        el('div', { class: 'hint' }, 'Скачайте файл .ics и откройте его на iPhone — Календарь предложит добавить записи. Если запись уже была добавлена раньше, Календарь обновит её, а не создаст копию.'),
        el('div', { class: 'form-section' }, el('div', { class: 'form-section-title' }, 'Какие записи'), seg)),
      actionText: 'Скачать .ics',
      cancelText: 'Отмена',
      onAction: async () => {
        const t = today();
        const [appts, clientsMap, locations] = await Promise.all([data.getAll('appointments'), data.getClientsMap(), data.getAll('locations')]);
        const list = appts.filter((a) => range === 'all' || (a.date >= t && (range === 'future' || a.date <= addDays(t, 90))));
        if (!list.length) { toast('Нет записей для экспорта'); return false; }
        downloadFile(`zapisi-${t}.ics`, buildIcs(list, clientsMap, { name: settings.appName, location: locations[0] }), 'text/calendar');
        toast(`Экспортировано записей: ${list.filter((a) => a.status !== 'cancelled').length}`);
        return true;
      },
    });
  }

  function openRegion(settings) {
    actionSheet({
      title: 'Валюта',
      message: 'Суммы хранятся без пересчёта — меняется только знак валюты.',
      actions: CURRENCIES.map((c) => ({
        label: c + (c === settings.currency ? ' ✓' : ''),
        onClick: async () => { await data.setSetting('currency', c); toast(`Валюта: ${c}`); },
      })),
    });
  }

  refresh();
  return { el: root, refresh };
}
