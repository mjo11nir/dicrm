// Телефоны и ссылки на мессенджеры. Чистые функции без доступа к базе.
//
// WhatsApp требует номер в международном формате без «+» (79161234567).
// Мастера часто записывают номера по-местному: «8 916…», «0532…», «916…» —
// такие номера дополняются кодом страны из настроек.

/** Коды стран, которые угадываются по телефону мастера (самый длинный совпавший префикс) */
const KNOWN_CODES = [
  '1', '7', '20', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
  '90', '351', '353', '357', '358', '359', '370', '371', '372', '373', '374', '375', '380', '381', '385', '420', '421',
  '971', '972', '992', '993', '994', '995', '996', '998',
];

/** Код страны по номеру в международном формате («+90 532…» → «90»). Пусто, если не понять. */
export function guessCountryCode(phone) {
  const raw = String(phone || '').trim();
  if (!raw.startsWith('+')) return '';
  const d = raw.replace(/\D/g, '');
  return KNOWN_CODES.filter((c) => d.startsWith(c)).sort((a, b) => b.length - a.length)[0] || '';
}

/**
 * Номер для WhatsApp: только цифры, с кодом страны.
 * @param {string} phone — номер как его ввели
 * @param {string} cc — код страны по умолчанию («7», «90», …)
 */
export function waPhone(phone, cc = '') {
  const raw = String(phone || '').trim();
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.startsWith('+')) return d;
  if (d.startsWith('00')) return d.slice(2);
  cc = String(cc || '').replace(/\D/g, '');
  if (!cc) return d;
  // Россия и Казахстан: 8 916 … → 7 916 …
  if (cc === '7' && d.length === 11 && d.startsWith('8')) return '7' + d.slice(1);
  // Код страны уже есть
  if (d.startsWith(cc) && d.length >= 11) return d;
  // Местный формат с нулём впереди (Турция 0532…, Германия 0170…)
  d = d.replace(/^0+/, '');
  return d.length <= 10 ? cc + d : d;
}

/**
 * Ссылка, открывающая чат WhatsApp с готовым текстом.
 * На телефоне — схема whatsapp:// (сразу приложение, без промежуточной страницы wa.me
 * и без блокировки всплывающих окон), на компьютере — wa.me.
 */
export function whatsappUrl(digits, text = '', { app = true } = {}) {
  if (!digits) return null;
  const t = text ? encodeURIComponent(text) : '';
  if (app) return `whatsapp://send?phone=${digits}${t ? `&text=${t}` : ''}`;
  return `https://wa.me/${digits}${t ? `?text=${t}` : ''}`;
}

/** Ссылка на чат Telegram: по нику, иначе по номеру */
export function telegramUrl(digits, username = '') {
  const u = String(username || '').trim().replace(/^@/, '');
  if (u) return `https://t.me/${u}`;
  return digits ? `https://t.me/+${digits}` : null;
}

/** Телефон или планшет (на них есть приложение WhatsApp) */
export function isMobileDevice(ua = navigator.userAgent, platform = navigator.platform, touch = navigator.maxTouchPoints) {
  return /iphone|ipad|ipod|android/i.test(ua) || (platform === 'MacIntel' && touch > 1);
}
