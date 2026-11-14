// «Уведомления для клиентов»: настройки WhatsApp и напоминаний, шаблоны сообщений
// с переменными {имя} {дата} {время} {услуга} {адрес} {цена} {окна}.

import * as data from '../db.js';
import { el, navBar, groupedList, openSheet, toast, toggle, field, actionSheet } from '../components/ui.js';
import { TEMPLATE_DEFS, TEMPLATE_VARS, getTemplates, saveTemplate, defaultCountryCode } from '../messaging.js';
import { openTomorrowReminders, calendarAlarmsLabel } from '../components/notify.js';
import { CALENDAR_ALARMS } from '../utils/ics.js';
import { waPhone } from '../utils/phone.js';

export function TemplatesScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Уведомления для клиентов', onBack: () => nav.pop() }), body);

  async function refresh() {
    const [templates, settings, profile] = await Promise.all([getTemplates(), data.getSettings(), data.getProfile()]);
    const cc = defaultCountryCode(settings, profile);
    body.replaceChildren(
      groupedList([
        { title: 'Код страны', subtitle: 'Для номеров без «+»: 8 916…, 0532…', value: cc ? `+${cc}` : 'не задан', onClick: () => editCountryCode(settings, cc) },
        { title: 'Сообщать о новой записи', subtitle: 'После создания или переноса записи предложить отправить клиенту сообщение', control: toggle(settings.offerClientMessage !== false, (v) => data.setSetting('offerClientMessage', v)) },
        { title: 'Напоминания на завтра', subtitle: 'Карточка на Главной, пока не всем клиентам напомнили', control: toggle(settings.dayBeforeReminders !== false, (v) => data.setSetting('dayBeforeReminders', v)) },
        { title: 'Отправить напоминания на завтра', onClick: () => openTomorrowReminders() },
      ], { header: 'WhatsApp', footer: 'Приложение открывает WhatsApp с готовым текстом — остаётся нажать «Отправить». Номер дополняется кодом страны автоматически.' }),
      groupedList([
        { title: 'Напоминание мне', value: calendarAlarmsLabel(settings.calendarAlarms), onClick: () => pickAlarms(settings) },
      ], { header: 'Календарь iPhone', footer: 'Добавьте запись в Календарь (кнопка в записи или «Синхронизация с календарем») — iPhone пришлёт уведомление за день, даже если приложение закрыто.' }),
      groupedList([
        { title: 'Автоматическая отправка', badge: 'Скоро', onClick: () => toast('Отправка без вашего участия появится после подключения сервера и WhatsApp Business API', { duration: 4500 }) },
      ]),
      el('div', { class: 'group-header' }, 'Шаблоны'),
      el('div', { class: 'hint pad' }, 'Переменные в фигурных скобках заменяются данными клиента и записи.'),
      groupedList(TEMPLATE_DEFS.map((t) => ({
        title: t.title,
        subtitle: templates.get(t.key),
        onClick: () => edit(t, templates.get(t.key)),
      }))));
  }

  function editCountryCode(settings, cc) {
    const input = el('input', { class: 'input', type: 'tel', inputmode: 'numeric', placeholder: 'например, 7 или 90', value: cc });
    const example = el('div', { class: 'hint' });
    const upd = () => {
      const code = input.value.replace(/\D/g, '');
      const sample = code === '7' ? '8 916 123-45-67' : '0532 123 45 67';
      example.textContent = code ? `Пример: ${sample} → +${waPhone(sample, code)}` : 'Пусто — код берётся из вашего телефона в профиле.';
    };
    input.addEventListener('input', upd);
    upd();
    openSheet({
      title: 'Код страны',
      content: el('div', { class: 'form' },
        el('div', { class: 'form-section' }, field('Код страны', input, 'Россия и Казахстан — 7, Турция — 90, Украина — 380, Германия — 49')),
        example),
      actionText: 'Сохранить',
      cancelText: 'Отмена',
      onAction: async () => {
        await data.setSetting('phoneCountryCode', input.value.replace(/\D/g, ''));
        toast('Код страны сохранён');
        return true;
      },
    });
  }

  function pickAlarms(settings) {
    const cur = settings.calendarAlarms || 'day';
    actionSheet({
      title: 'Напоминание в Календаре',
      message: 'Для записей, которые вы добавляете в Календарь iPhone.',
      actions: Object.entries(CALENDAR_ALARMS).map(([value, a]) => ({
        label: a.label + (value === cur ? ' ✓' : ''),
        onClick: () => data.setSetting('calendarAlarms', value),
      })),
    });
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
