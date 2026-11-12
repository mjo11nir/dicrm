// Вся работа с данными — только через этот модуль.
// Хранилище — IndexedDB через Dexie.js (глобальный объект Dexie подключается по CDN в index.html).
//
// Подготовка к будущей синхронизации с сервером:
//  • id всех записей — UUID (crypto.randomUUID());
//  • у каждой записи есть createdAt, updatedAt и deleted (мягкое удаление);
//  • каждое изменение дописывается в таблицу outbox.

/* global Dexie */

export const db = new Dexie('beauty-crm');

db.version(1).stores({
  profile: 'id',
  locations: 'id',
  schedule: 'id, weekday',
  scheduleExceptions: 'id, dateFrom',
  services: 'id, categoryId',
  serviceCategories: 'id',
  products: 'id',
  clients: 'id, name, phone',
  appointments: 'id, date, clientId, status, seriesId',
  breaks: 'id, date',
  payments: 'id, appointmentId, date',
  expenses: 'id, date',
  waitlist: 'id',
  templates: 'id, key',
  messages: 'id, clientId',
  gallery: 'id, clientId',
  reviews: 'id, date',
  settings: 'key',
  outbox: '++seq, at',
});

/** Генерация UUID (с запасным вариантом для старых браузеров / не-HTTPS) */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const nowIso = () => new Date().toISOString();

// ---------- Оповещение экранов об изменениях ----------

let changeTimer = null;
/** Сообщить приложению, что данные изменились (с небольшой задержкой, чтобы склеить пачку изменений) */
function emitChange() {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => window.dispatchEvent(new CustomEvent('db:change')), 0);
}

function logOutbox(table, record, op) {
  return db.outbox.add({ table, recordId: record.id ?? record.key, op, at: nowIso() });
}

// ---------- Общие операции ----------

/** Все не удалённые записи таблицы */
export async function getAll(table) {
  return (await db[table].toArray()).filter((r) => !r.deleted);
}

export async function get(table, id) {
  const r = await db[table].get(id);
  return r && !r.deleted ? r : null;
}

/** Создать или полностью сохранить запись. Возвращает сохранённый объект. */
export async function save(table, obj) {
  const t = nowIso();
  const isNew = !obj.id;
  const record = {
    ...obj,
    id: obj.id || uuid(),
    createdAt: obj.createdAt || t,
    updatedAt: t,
    deleted: obj.deleted || false,
  };
  await db.transaction('rw', db[table], db.outbox, async () => {
    await db[table].put(record);
    await logOutbox(table, record, isNew ? 'create' : 'update');
  });
  emitChange();
  return record;
}

/** Частично изменить запись */
export async function update(table, id, changes) {
  const cur = await db[table].get(id);
  if (!cur) throw new Error(`Запись ${table}/${id} не найдена`);
  return save(table, { ...cur, ...changes });
}

/** Мягкое удаление */
export async function remove(table, id) {
  const cur = await db[table].get(id);
  if (!cur) return;
  const record = { ...cur, deleted: true, updatedAt: nowIso() };
  await db.transaction('rw', db[table], db.outbox, async () => {
    await db[table].put(record);
    await logOutbox(table, record, 'delete');
  });
  emitChange();
}

/** Отменить мягкое удаление */
export async function restore(table, id) {
  return update(table, id, { deleted: false });
}

// ---------- Настройки (ключ → значение) ----------

export const DEFAULT_SETTINGS = {
  appName: 'Beauty CRM',
  currency: '€',
  slotDuration: 120,      // длительность свободного окна, мин
  homeBackground: true,   // переливающийся фон Главной
  reminderTemplate: 'Здравствуйте, {имя}! Напоминаем о записи {дата} в {время}: {услуга}. Адрес: {адрес}. До встречи!',
};

export async function getSettings() {
  const rows = await db.settings.toArray();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export async function setSetting(key, value) {
  const record = { key, value, updatedAt: nowIso() };
  await db.transaction('rw', db.settings, db.outbox, async () => {
    await db.settings.put(record);
    await logOutbox('settings', record, 'update');
  });
  emitChange();
}

// ---------- Профиль ----------

export async function getProfile() {
  const all = await getAll('profile');
  return all[0] || { name: 'Мастер', badge: 'PRO', phone: '', address: '', avatar: null };
}

// ---------- Специальные выборки ----------

/** Записи за период (включительно), без удалённых */
export async function getAppointmentsBetween(from, to) {
  return (await db.appointments.where('date').between(from, to, true, true).toArray()).filter((a) => !a.deleted);
}

export async function getAppointmentsByDate(date) {
  return getAppointmentsBetween(date, date);
}

export async function getBreaksBetween(from, to) {
  return (await db.breaks.where('date').between(from, to, true, true).toArray()).filter((b) => !b.deleted);
}

/** График по дням недели (отсортирован с понедельника) и исключения */
export async function getScheduleData() {
  const [schedule, exceptions] = await Promise.all([getAll('schedule'), getAll('scheduleExceptions')]);
  schedule.sort((a, b) => a.weekday - b.weekday);
  return { schedule, exceptions };
}

/** Клиенты в виде Map(id → клиент) для быстрого поиска */
export async function getClientsMap() {
  const list = await getAll('clients');
  return new Map(list.map((c) => [c.id, c]));
}

/** Платежи по записи */
export async function getPaymentsFor(appointmentId) {
  return (await db.payments.where('appointmentId').equals(appointmentId).toArray()).filter((p) => !p.deleted);
}

/** Пустая ли база (первый запуск) */
export async function isEmpty() {
  return (await db.schedule.count()) === 0;
}

// ---------- Резервная копия ----------

/** Таблицы, которые попадают в резервную копию (outbox — служебный журнал, не нужен) */
export const BACKUP_TABLES = db.tables.map((t) => t.name).filter((n) => n !== 'outbox');

/** Blob → data URL (для фото в JSON) */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Выгрузить все данные (включая удалённые и фото) в один объект */
export async function exportAll() {
  const out = { app: 'beauty-crm', version: 1, exportedAt: nowIso(), tables: {} };
  for (const name of BACKUP_TABLES) {
    const rows = await db[name].toArray();
    if (name === 'gallery') {
      for (const r of rows) if (r.blob instanceof Blob) r.blob = { dataUrl: await blobToDataUrl(r.blob) };
    }
    out.tables[name] = rows;
  }
  return out;
}

/** Загрузить резервную копию: полностью заменяет текущие данные */
export async function importAll(backup) {
  if (!backup || backup.app !== 'beauty-crm' || !backup.tables) throw new Error('Это не резервная копия Beauty CRM');
  // Фото: data URL → Blob (до транзакции — fetch внутри транзакции IndexedDB недопустим)
  const gallery = backup.tables.gallery || [];
  for (const r of gallery) {
    if (r.blob?.dataUrl) r.blob = await (await fetch(r.blob.dataUrl)).blob();
  }
  await db.transaction('rw', db.tables, async () => {
    for (const name of BACKUP_TABLES) {
      await db[name].clear();
      const rows = backup.tables[name];
      if (Array.isArray(rows) && rows.length) await db[name].bulkPut(rows);
    }
    await db.outbox.add({ table: '*', recordId: '*', op: 'import', at: nowIso() });
  });
  emitChange();
}

/** Есть ли в базе демо-данные */
export async function hasDemo() {
  return (await db.clients.filter((c) => c.demo && !c.deleted).count()) > 0 ||
    (await db.appointments.filter((a) => a.demo && !a.deleted).count()) > 0;
}

/**
 * Удалить демо-данные. График, услуги и место работы остаются (их обычно
 * просто правят под себя), профиль сбрасывается к пустому.
 */
export async function deleteDemo() {
  const tables = ['clients', 'appointments', 'payments', 'expenses', 'reviews', 'waitlist', 'breaks', 'scheduleExceptions', 'messages', 'gallery'];
  await db.transaction('rw', tables.map((n) => db[n]).concat(db.profile, db.outbox), async () => {
    const demoClients = new Set((await db.clients.toArray()).filter((c) => c.demo).map((c) => c.id));
    for (const n of tables) {
      const rows = await db[n].toArray();
      const ids = rows.filter((r) => r.demo || (r.clientId && demoClients.has(r.clientId) && (n === 'messages' || n === 'gallery'))).map((r) => r.id);
      if (ids.length) await db[n].bulkDelete(ids);
    }
    for (const p of await db.profile.toArray()) {
      if (p.demo) await db.profile.put({ ...p, name: 'Мастер', phone: '', address: '', demo: false, updatedAt: nowIso() });
    }
    await db.outbox.add({ table: '*', recordId: '*', op: 'deleteDemo', at: nowIso() });
  });
  emitChange();
}

/** Массовая вставка без записи в outbox — только для демо-данных */
export async function bulkInsertDemo(table, records) {
  const t = nowIso();
  await db[table].bulkPut(records.map((r) => ({
    createdAt: t, ...r, id: r.id || uuid(), updatedAt: t, deleted: false, demo: true,
  })));
}

export function notifyChange() {
  emitChange();
}
