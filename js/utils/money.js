// Форматирование денег. Все суммы хранятся в целых центах.

let currency = '€';

/** Установить символ валюты (берётся из настроек при запуске) */
export function setCurrency(sym) {
  currency = sym || '€';
}

export function getCurrency() {
  return currency;
}

/** Разделить целое число точками по тысячам: 2345 → «2.345» */
function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Краткий формат без копеек: 234500 → «€2.345» */
export function money(cents) {
  const sign = cents < 0 ? '−' : '';
  const units = Math.round(Math.abs(cents) / 100);
  return `${sign}${currency}${groupThousands(units)}`;
}

/** Полный формат с копейками: 4500 → «€45,00» */
export function moneyFull(cents) {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(Math.round(cents));
  const units = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}${currency}${groupThousands(units)},${rest}`;
}

/** Строка из поля ввода («45,5» или «45.50») → центы */
export function parseMoney(str) {
  if (str === null || str === undefined || str === '') return 0;
  const n = parseFloat(String(str).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Центы → строка для поля ввода: 4550 → «45.50», 4500 → «45» */
export function centsToInput(cents) {
  if (!cents) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
