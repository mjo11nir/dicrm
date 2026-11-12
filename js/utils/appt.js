// Вспомогательные функции для записей: статусы, цены, оплата.

export const STATUSES = {
  scheduled: { label: 'Запланирована', color: 'var(--primary)' },
  confirmed: { label: 'Подтверждена', color: 'var(--teal)' },
  completed: { label: 'Завершена', color: 'var(--green)' },
  noshow: { label: 'Не пришёл', color: 'var(--orange)' },
  cancelled: { label: 'Отменена', color: 'var(--red)' },
};

export const PAYMENT_METHODS = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
};

export const REPEAT_OPTIONS = [
  { value: 0, label: 'Не повторять' },
  { value: 1, label: 'Каждую неделю' },
  { value: 2, label: 'Каждые 2 недели' },
  { value: 3, label: 'Каждые 3 недели' },
  { value: 4, label: 'Каждые 4 недели' },
];

/** Итоговая цена с учётом скидки, в центах */
export function calcTotal(price, discountType, discountValue) {
  let d = 0;
  if (discountType === 'percent') d = Math.round(price * Math.min(100, Math.max(0, discountValue || 0)) / 100);
  else d = Math.min(price, Math.max(0, discountValue || 0));
  return Math.max(0, price - d);
}

/** Учитывается ли запись в выручке */
export function countsInRevenue(a) {
  return !a.deleted && a.status !== 'cancelled' && a.status !== 'noshow';
}

/** Выручка по списку записей (центы) */
export function revenueOf(appts) {
  return appts.filter(countsInRevenue).reduce((s, a) => s + (a.total || 0), 0);
}

/** Строка с названиями услуг через запятую */
export function servicesTitle(a) {
  return (a.services || []).map((s) => s.name).join(', ') || 'Без услуги';
}

/** Время окончания записи в минутах */
export function apptEnd(a) {
  return a.start + a.duration;
}

/** Нормализованный телефон для ссылок wa.me / t.me / tel: — только цифры, с ведущим «+» для tel */
export function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Подстановка переменных в шаблон: {имя}, {дата}, {время}, {услуга}, {адрес}, {цена}, {окна} */
export function fillTemplate(tpl, vars) {
  return tpl.replace(/\{(имя|дата|время|услуга|адрес|цена|окна)\}/g, (m, k) => vars[k] ?? '');
}
