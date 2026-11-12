// Утилиты для работы с датами и временем.
// Даты храним строками «YYYY-MM-DD» (ISO, локальная дата устройства),
// время внутри дня — числом минут от полуночи (540 = 09:00).

export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
// Месяц в родительном падеже, сокращённо: «10 нояб.»
export const MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.',
  'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
// Месяц в предложном падеже: «в ноябре»
export const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
// Дни недели, неделя начинается с понедельника (индекс 0 = понедельник)
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_LETTER = ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'];
export const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const pad = (n) => String(n).padStart(2, '0');

/** Date → «YYYY-MM-DD» по локальному времени */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** «YYYY-MM-DD» → Date (полночь по локальному времени) */
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return ymd(new Date());
}

/** Прибавить n дней к строке-дате */
export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Прибавить n месяцев (день ставится в 1-е число) */
export function addMonths(s, n) {
  const d = parseYmd(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Номер дня недели: 0 = понедельник … 6 = воскресенье */
export function weekdayIndex(s) {
  return (parseYmd(s).getDay() + 6) % 7;
}

/** Понедельник недели, в которую попадает дата */
export function startOfWeek(s) {
  return addDays(s, -weekdayIndex(s));
}

export function startOfMonth(s) {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s) {
  const d = parseYmd(s);
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Разница в днях между датами (b - a) */
export function diffDays(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}

/** «09:00» → 540 */
export function toMin(hhmm) {
  if (typeof hhmm === 'number') return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 540 → «09:00» */
export function fromMin(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** 540 → «9:00» (без ведущего нуля, для карточки свободных окон) */
export function fromMinShort(min) {
  return `${Math.floor(min / 60)}:${pad(min % 60)}`;
}

/** Текущее время в минутах от полуночи */
export function nowMin(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/** «Вт, 10 нояб.» */
export function formatDayShort(s, lower = false) {
  const d = parseYmd(s);
  const wd = WEEKDAYS_SHORT[weekdayIndex(s)];
  return `${lower ? wd.toLowerCase() : wd}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** «12 ноября 2026» — длинный формат */
export function formatDayLong(s) {
  const d = parseYmd(s);
  const gen = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${gen[d.getMonth()]} ${d.getFullYear()}`;
}

/** Длительность в минутах → «1 ч 30 мин» */
export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

/** Округлить минуты вверх до шага */
export function roundUp(min, step) {
  return Math.ceil(min / step) * step;
}
