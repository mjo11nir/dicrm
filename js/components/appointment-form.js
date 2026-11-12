// Форма создания и редактирования записи (в BottomSheet).
// Клиент (поиск + новый клиент), несколько услуг, дата/время/длительность,
// цена, скидка, предоплата, комментарий, повтор, проверка пересечений.

import * as data from '../db.js';
import { el, openSheet, toast, segmented, field, esc } from './ui.js';
import { icon } from './icons.js';
import { getDayHours, findConflicts } from '../utils/slots.js';
import { today, toMin, fromMin, addDays, formatDuration, formatDayShort, roundUp, nowMin } from '../utils/dates.js';
import { moneyFull, parseMoney, centsToInput } from '../utils/money.js';
import { calcTotal, REPEAT_OPTIONS } from '../utils/appt.js';

/** Сколько повторов создавать для серии (примерно на 3 месяца вперёд) */
const SERIES_DAYS = 90;

/**
 * Открыть форму записи.
 * @param {{appointment?: object, date?: string, start?: number, clientId?: string, serviceIds?: string[], focus?: 'time'}} opts
 */
export async function openAppointmentForm(opts = {}) {
  const editing = opts.appointment || null;
  const [services, categories, clients, settings] = await Promise.all([
    data.getAll('services'), data.getAll('serviceCategories'), data.getAll('clients'), data.getSettings(),
  ]);
  categories.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  clients.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  // ---- Состояние формы ----
  const st = {
    clientId: editing?.clientId || opts.clientId || null,
    newClient: null, // { name, phone } — если создаём клиента прямо в форме
    selected: editing ? editing.services.map((s) => ({ ...s })) : (opts.serviceIds || [])
      .map((id) => services.find((s) => s.id === id)).filter(Boolean)
      .map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
    date: editing?.date || opts.date || today(),
    start: editing?.start ?? opts.start ?? null,
    duration: editing?.duration || 0,
    durationManual: !!editing,
    price: editing?.price || 0,
    priceManual: !!editing,
    discountType: editing?.discountType || 'percent',
    discountValue: editing?.discountValue || 0,
    prepaid: editing?.prepaid || 0,
    comment: editing?.comment || '',
    repeat: 0,
    breakAfter: editing?.breakAfter || 0,
    force: false,
  };
  if (!st.durationManual) recalcFromServices();
  if (st.start === null) {
    // По умолчанию — ближайшее время, кратное 15 минутам (или начало рабочего дня)
    const { schedule, exceptions } = await data.getScheduleData();
    const h = getDayHours(st.date, schedule, exceptions);
    st.start = st.date === today() ? Math.max(h.working ? h.start : 540, roundUp(nowMin(), 15)) : (h.working ? h.start : 540);
  }

  function recalcFromServices() {
    if (!st.durationManual) st.duration = st.selected.reduce((s, x) => s + x.duration, 0) || 60;
    if (!st.priceManual) st.price = st.selected.reduce((s, x) => s + x.price, 0);
    st.breakAfter = Math.max(0, ...st.selected.map((x) => services.find((s) => s.id === x.id)?.breakAfter || 0));
  }

  const root = el('div', { class: 'form' });

  // ---- Клиент ----
  const clientBox = el('div', { class: 'form-section' });
  function renderClient() {
    clientBox.replaceChildren(el('div', { class: 'form-section-title' }, 'Клиент'));
    const chosen = clients.find((c) => c.id === st.clientId);
    if (chosen || st.newClient) {
      const c = chosen || st.newClient;
      clientBox.appendChild(el('div', { class: 'chosen' },
        el('div', { class: 'chosen-text' },
          el('div', { class: 'chosen-title' }, c.name + (st.newClient ? ' (новый)' : '')),
          c.phone ? el('div', { class: 'chosen-sub' }, c.phone) : null),
        el('button', { class: 'link-btn', type: 'button', onclick: () => { st.clientId = null; st.newClient = null; renderClient(); } }, 'Изменить')));
      return;
    }
    const input = el('input', { class: 'input', type: 'search', placeholder: 'Поиск по имени или телефону', autocomplete: 'off' });
    const list = el('div', { class: 'pick-list' });
    const newBtn = el('button', { class: 'link-btn add-client-btn', type: 'button', html: `${icon('plus')} новый клиент` });
    const newBox = el('div', { class: 'new-client', hidden: true });
    const nameIn = el('input', { class: 'input', placeholder: 'Имя и фамилия', autocomplete: 'off' });
    const phoneIn = el('input', { class: 'input', type: 'tel', placeholder: 'Телефон', autocomplete: 'off' });
    newBox.append(nameIn, phoneIn, el('button', { class: 'btn btn-primary small', type: 'button', onclick: () => {
      if (!nameIn.value.trim()) { nameIn.focus(); toast('Введите имя клиента'); return; }
      st.newClient = { name: nameIn.value.trim(), phone: phoneIn.value.trim() };
      renderClient();
    } }, 'Добавить'));
    newBtn.addEventListener('click', () => {
      newBox.hidden = !newBox.hidden;
      if (!newBox.hidden) { nameIn.value = input.value; nameIn.focus(); }
    });

    function renderList() {
      const q = input.value.trim().toLowerCase();
      const qd = q.replace(/\D/g, '');
      const found = clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && String(c.phone).replace(/\D/g, '').includes(qd))).slice(0, q ? 8 : 5);
      list.replaceChildren(...found.map((c) => el('button', { class: 'pick-row', type: 'button', onclick: () => { st.clientId = c.id; renderClient(); renderWarnings(); } },
        el('span', { class: 'pick-title' }, c.name), el('span', { class: 'pick-sub' }, c.phone || ''))));
      if (q && !found.length) list.appendChild(el('div', { class: 'pick-empty' }, 'Никого не нашли'));
    }
    input.addEventListener('input', renderList);
    renderList();
    clientBox.append(input, list, newBtn, newBox);
  }

  // ---- Услуги ----
  const servicesBox = el('div', { class: 'form-section' });
  const summary = el('div', { class: 'svc-summary' });
  function renderServices() {
    servicesBox.replaceChildren(el('div', { class: 'form-section-title' }, 'Услуги'));
    const groups = categories.map((cat) => ({ cat, items: services.filter((s) => s.categoryId === cat.id && (s.active || st.selected.some((x) => x.id === s.id))) }));
    const orphan = services.filter((s) => !categories.some((c) => c.id === s.categoryId) && s.active);
    if (orphan.length) groups.push({ cat: { name: 'Без категории' }, items: orphan });
    for (const g of groups) {
      if (!g.items.length) continue;
      servicesBox.appendChild(el('div', { class: 'svc-cat' }, g.cat.name));
      for (const s of g.items) {
        const on = st.selected.some((x) => x.id === s.id);
        servicesBox.appendChild(el('button', {
          class: 'svc-row' + (on ? ' on' : ''), type: 'button',
          onclick: () => {
            if (on) st.selected = st.selected.filter((x) => x.id !== s.id);
            else st.selected.push({ id: s.id, name: s.name, duration: s.duration, price: s.price });
            st.durationManual = false;
            st.priceManual = false;
            recalcFromServices();
            renderServices();
            renderTime();
            renderPrice();
            renderWarnings();
          },
        },
        el('span', { class: 'svc-check', html: on ? icon('check') : '' }),
        el('span', { class: 'svc-name' }, s.name),
        el('span', { class: 'svc-meta' }, `${formatDuration(s.duration)} · ${moneyFull(s.price)}`)));
      }
    }
    if (!services.length) servicesBox.appendChild(el('div', { class: 'pick-empty' }, 'Услуг пока нет — добавьте их в «Другое → Услуги и товары».'));
    summary.textContent = st.selected.length ? `Выбрано: ${st.selected.length} · ${formatDuration(st.selected.reduce((s, x) => s + x.duration, 0))} · ${moneyFull(st.selected.reduce((s, x) => s + x.price, 0))}` : '';
    servicesBox.appendChild(summary);
  }

  // ---- Дата и время ----
  const timeBox = el('div', { class: 'form-section' });
  const dateIn = el('input', { class: 'input', type: 'date', required: true });
  const startIn = el('input', { class: 'input', type: 'time', step: 300, required: true });
  const durIn = el('input', { class: 'input', type: 'number', min: 5, step: 5, inputmode: 'numeric' });
  const endOut = el('div', { class: 'end-out' });
  dateIn.addEventListener('change', () => { if (dateIn.value) { st.date = dateIn.value; renderWarnings(); } });
  startIn.addEventListener('change', () => { if (startIn.value) { st.start = toMin(startIn.value); updateEnd(); renderWarnings(); } });
  durIn.addEventListener('input', () => {
    const v = parseInt(durIn.value, 10);
    if (v > 0) { st.duration = v; st.durationManual = true; updateEnd(); renderWarnings(); }
  });
  function updateEnd() {
    endOut.textContent = `Окончание: ${fromMin(st.start + st.duration)} (${formatDuration(st.duration)})`;
  }
  function renderTime() {
    dateIn.value = st.date;
    startIn.value = fromMin(st.start);
    durIn.value = st.duration;
    updateEnd();
  }
  timeBox.append(
    el('div', { class: 'form-section-title' }, 'Дата и время'),
    el('div', { class: 'grid2' }, field('Дата', dateIn), field('Начало', startIn)),
    field('Длительность, мин', durIn),
    endOut);

  // ---- Цена ----
  const priceBox = el('div', { class: 'form-section' });
  const priceIn = el('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: '0' });
  const discIn = el('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: '0' });
  const prepaidIn = el('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: '0' });
  const totalOut = el('div', { class: 'total-out' });
  const discSeg = segmented({
    options: [{ value: 'percent', label: '%' }, { value: 'amount', label: '€' }],
    value: st.discountType,
    onChange: (v) => {
      st.discountType = v;
      st.discountValue = 0;
      discIn.value = '';
      updateTotal();
    },
  });
  priceIn.addEventListener('input', () => { st.price = parseMoney(priceIn.value); st.priceManual = true; updateTotal(); });
  discIn.addEventListener('input', () => {
    st.discountValue = st.discountType === 'percent' ? Math.min(100, parseFloat(discIn.value.replace(',', '.')) || 0) : parseMoney(discIn.value);
    updateTotal();
  });
  prepaidIn.addEventListener('input', () => { st.prepaid = parseMoney(prepaidIn.value); updateTotal(); });
  function updateTotal() {
    const total = calcTotal(st.price, st.discountType, st.discountValue);
    totalOut.innerHTML = `Итого: <b>${esc(moneyFull(total))}</b>` + (st.prepaid ? ` · предоплата ${esc(moneyFull(st.prepaid))}` : '');
  }
  function renderPrice() {
    priceIn.value = centsToInput(st.price);
    discIn.value = st.discountValue ? (st.discountType === 'percent' ? String(st.discountValue) : centsToInput(st.discountValue)) : '';
    prepaidIn.value = centsToInput(st.prepaid);
    discSeg.setValue(st.discountType);
    updateTotal();
  }
  priceBox.append(
    el('div', { class: 'form-section-title' }, 'Оплата'),
    field('Цена', priceIn),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, 'Скидка'), el('div', { class: 'disc-row' }, discSeg, discIn)),
    field('Предоплата', prepaidIn),
    totalOut);

  // ---- Прочее ----
  const extraBox = el('div', { class: 'form-section' });
  const commentIn = el('textarea', { class: 'input', rows: 2, placeholder: 'Комментарий' });
  commentIn.value = st.comment;
  commentIn.addEventListener('input', () => { st.comment = commentIn.value; });
  extraBox.append(el('div', { class: 'form-section-title' }, 'Дополнительно'), commentIn);
  if (!editing) {
    const repeatSel = el('select', { class: 'input' }, REPEAT_OPTIONS.map((o) => el('option', { value: o.value }, o.label)));
    repeatSel.addEventListener('change', () => { st.repeat = Number(repeatSel.value); });
    extraBox.appendChild(field('Повтор записи', repeatSel, 'Повторы создаются примерно на 3 месяца вперёд'));
  }

  // ---- Предупреждения о пересечениях ----
  const warnBox = el('div', { class: 'warn', hidden: true });
  async function checkConflicts() {
    const { schedule, exceptions } = await data.getScheduleData();
    const hours = getDayHours(st.date, schedule, exceptions);
    const [appointments, breaks] = await Promise.all([data.getAppointmentsByDate(st.date), data.getBreaksBetween(st.date, st.date)]);
    return findConflicts({ date: st.date, start: st.start, duration: st.duration, excludeId: editing?.id }, { hours, appointments, breaks });
  }
  let warnSeq = 0;
  async function renderWarnings() {
    // Проверки асинхронные: результат устаревшей проверки игнорируем
    const seq = ++warnSeq;
    const c = await checkConflicts();
    if (seq !== warnSeq) return;
    st.force = false;
    if (c.ok) { warnBox.hidden = true; return; }
    const cmap = new Map(clients.map((x) => [x.id, x]));
    const lines = [];
    if (c.dayOff) lines.push('Этот день — нерабочий по графику.');
    if (c.outsideHours) lines.push('Время выходит за рабочие часы.');
    for (const o of c.overlaps) lines.push(`Пересекается с записью ${fromMin(o.start)}–${fromMin(o.start + o.duration)} (${cmap.get(o.clientId)?.name || 'клиент'}).`);
    if (c.breakOverlap) lines.push('Пересекается с перерывом.');
    warnBox.replaceChildren(...lines.map((l) => el('div', {}, l)),
      el('button', { class: 'btn btn-danger small', type: 'button', onclick: () => { st.force = true; doSave(); } }, 'Всё равно сохранить'));
    warnBox.hidden = false;
  }

  root.append(clientBox, servicesBox, timeBox, warnBox, priceBox, extraBox);
  renderClient();
  renderServices();
  renderTime();
  renderPrice();
  renderWarnings();

  // ---- Сохранение ----
  let sheet = null;
  let saving = false;
  async function doSave() {
    if (saving) return false;
    if (!st.clientId && !st.newClient) { toast('Выберите клиента'); clientBox.scrollIntoView({ behavior: 'smooth' }); return false; }
    if (!st.date || st.start === null || !st.duration) { toast('Укажите дату и время'); return false; }
    const c = await checkConflicts();
    if (!c.ok && !st.force) {
      await renderWarnings();
      warnBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Время занято или вне графика');
      return false;
    }
    saving = true;
    try {
      let clientId = st.clientId;
      if (!clientId && st.newClient) {
        const nc = await data.save('clients', { name: st.newClient.name, phone: st.newClient.phone, notes: '', tags: [] });
        clientId = nc.id;
      }
      const total = calcTotal(st.price, st.discountType, st.discountValue);
      const base = {
        clientId,
        services: st.selected,
        duration: st.duration,
        breakAfter: st.breakAfter,
        price: st.price,
        discountType: st.discountType,
        discountValue: st.discountValue,
        total,
        prepaid: st.prepaid,
        comment: st.comment.trim(),
      };
      if (editing) {
        const moved = editing.date !== st.date || editing.start !== st.start;
        await data.save('appointments', {
          ...editing, ...base, date: st.date, start: st.start,
          // При переносе напоминание нужно отправить заново
          reminderSentAt: moved ? null : editing.reminderSentAt,
        });
        await syncPrepay(editing.id, st.prepaid, st.date);
        toast(moved ? 'Запись перенесена' : 'Запись сохранена');
      } else {
        const dates = [st.date];
        if (st.repeat) for (let d = addDays(st.date, st.repeat * 7); d <= addDays(st.date, SERIES_DAYS); d = addDays(d, st.repeat * 7)) dates.push(d);
        const seriesId = dates.length > 1 ? data.uuid() : null;
        const created = [];
        for (const d of dates) {
          const a = await data.save('appointments', {
            ...base, date: d, start: st.start, status: 'scheduled', repeat: st.repeat, seriesId,
            reminderSentAt: null, prepaid: d === st.date ? st.prepaid : 0,
          });
          created.push(a);
        }
        if (st.prepaid) await syncPrepay(created[0].id, st.prepaid, st.date);
        toast(created.length > 1 ? `Создано записей: ${created.length}` : 'Запись создана', {
          undo: async () => { for (const a of created) await data.remove('appointments', a.id); },
        });
        opts.onSaved?.(created[0]);
      }
      sheet?.close();
      return true;
    } finally {
      saving = false;
    }
  }

  sheet = openSheet({
    title: editing ? (opts.focus === 'time' ? 'Перенос записи' : 'Изменить запись') : 'Новая запись',
    content: root,
    actionText: 'Сохранить',
    cancelText: 'Отмена',
    full: true,
    onAction: async () => { await doSave(); return false; },
  });
  if (opts.focus === 'time') setTimeout(() => timeBox.scrollIntoView({ block: 'start' }), 350);
  return sheet;
}

/** Предоплата хранится и в записи, и отдельным платежом (kind = 'prepay') */
async function syncPrepay(appointmentId, amount, date) {
  const pays = await data.getPaymentsFor(appointmentId);
  const prepay = pays.find((p) => p.kind === 'prepay');
  if (prepay && !amount) await data.remove('payments', prepay.id);
  else if (prepay) await data.save('payments', { ...prepay, amount });
  else if (amount) await data.save('payments', { appointmentId, amount, method: 'transfer', kind: 'prepay', date });
}

/** Подпись времени записи для заголовков */
export function apptWhen(a) {
  return `${formatDayShort(a.date)}, ${fromMin(a.start)}–${fromMin(a.start + a.duration)}`;
}
