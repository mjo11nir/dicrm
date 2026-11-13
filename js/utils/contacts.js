// Выбор контакта из телефонной книги через Contact Picker API.
// Android (Chrome) — работает сразу. iPhone (Safari) — функция есть, но выключена по умолчанию:
// Настройки → Приложения → Safari → Дополнения → Feature Flags → Contact Picker API.
// Если API недоступен, используем автозаполнение Safari («Автозаполнение контакта» над клавиатурой) —
// для этого у полей имени и телефона стоят autocomplete="name" и autocomplete="tel".

import { phoneDigits } from './appt.js';

/** Доступен ли системный выбор контакта */
export function canPickContacts() {
  return 'contacts' in navigator && typeof navigator.contacts?.select === 'function';
}

/**
 * Открыть телефонную книгу и вернуть выбранный контакт.
 * @returns {Promise<{name: string, phone: string}|null>} null — если ничего не выбрали
 */
export async function pickContact() {
  const res = await navigator.contacts.select(['name', 'tel'], { multiple: false });
  const c = res?.[0];
  if (!c) return null;
  const name = (c.name || []).find((n) => n && n.trim()) || '';
  const phone = (c.tel || []).find((t) => t && t.trim()) || '';
  if (!name && !phone) return null;
  return { name: name.trim() || phone.trim(), phone: phone.trim() };
}

/** Найти клиента с таким же номером (сравниваем последние 10 цифр) */
export function findClientByPhone(clients, phone) {
  const d = phoneDigits(phone).slice(-10);
  if (d.length < 7) return null;
  return clients.find((c) => phoneDigits(c.phone).slice(-10) === d) || null;
}

/** Подсказка, если системный выбор контакта недоступен */
export const CONTACTS_HINT = 'Нажмите на поле «Имя» и выберите «Автозаполнение контакта» над клавиатурой — откроются Контакты. ' +
  'Чтобы кнопка сразу открывала Контакты, включите на iPhone: Настройки → Приложения → Safari → Дополнения → Feature Flags → Contact Picker API.';
