// Демо-данные при первом запуске: профиль, график, услуги, 25 клиентов,
// записи на прошлый, текущий и следующий месяц, несколько расходов и отзывов.
// Все демо-записи помечены полем demo: true (в этапе 4 их можно будет удалить одной кнопкой).

import { bulkInsertDemo, uuid, isEmpty } from './db.js';
import { today, addDays, addMonths, startOfMonth, endOfMonth, weekdayIndex, diffDays, nowMin } from './utils/dates.js';
import { calcTotal } from './utils/appt.js';

/** Детерминированный генератор случайных чисел, чтобы демо было стабильным */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Ирина', 'Татьяна', 'Светлана', 'Юлия', 'Екатерина',
  'Дарья', 'Алина', 'Виктория', 'Ксения', 'Полина', 'Валерия', 'Софья', 'Вероника', 'Кристина', 'Марина',
  'Александра', 'Анастасия', 'Евгения', 'Людмила', 'Диана'];
const LAST = ['Иванова', 'Петрова', 'Соколова', 'Кузнецова', 'Попова', 'Лебедева', 'Козлова', 'Новикова', 'Морозова', 'Волкова',
  'Павлова', 'Семёнова', 'Голубева', 'Виноградова', 'Богданова', 'Воробьёва', 'Фёдорова', 'Михайлова', 'Белова', 'Тарасова',
  'Белякова', 'Орлова', 'Киселёва', 'Макарова', 'Андреева'];

export async function seedIfEmpty() {
  if (!(await isEmpty())) return false;
  const rand = rng(20261112);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const t = today();

  // --- Профиль и место работы ---
  const locationId = uuid();
  await bulkInsertDemo('locations', [{ id: locationId, name: 'Студия маникюра', address: 'ул. Цветочная, 12' }]);
  await bulkInsertDemo('profile', [{
    name: 'Анна Смирнова', badge: 'PRO', phone: '+7 916 555-12-34', address: 'ул. Цветочная, 12', avatar: null,
  }]);

  // --- График: пн–чт 09:00–19:00, пт–вс выходные ---
  await bulkInsertDemo('schedule', [0, 1, 2, 3, 4, 5, 6].map((w) => ({
    weekday: w, isWorking: w <= 3, start: '09:00', end: '19:00', breaks: [],
  })));

  // Выходной в среду на следующей неделе
  const nextWed = addDays(t, 7 - weekdayIndex(t) + 2);
  await bulkInsertDemo('scheduleExceptions', [{ kind: 'off', dateFrom: nextWed, dateTo: nextWed, note: 'Выходной' }]);

  // --- Категории и услуги ---
  const catMani = uuid();
  const catPedi = uuid();
  await bulkInsertDemo('serviceCategories', [
    { id: catMani, name: 'Маникюр', sort: 0 },
    { id: catPedi, name: 'Педикюр', sort: 1 },
  ]);
  const services = [
    { id: uuid(), categoryId: catMani, name: 'Маникюр с однотонным покрытием', duration: 120, price: 4500, breakAfter: 0, repeatDays: 21, active: true },
    { id: uuid(), categoryId: catMani, name: 'Маникюр без покрытия', duration: 60, price: 2500, breakAfter: 0, repeatDays: 21, active: true },
    { id: uuid(), categoryId: catMani, name: 'Наращивание ногтей', duration: 150, price: 7000, breakAfter: 0, repeatDays: 21, active: true },
    { id: uuid(), categoryId: catMani, name: 'Снятие покрытия', duration: 30, price: 1000, breakAfter: 0, repeatDays: 0, active: true },
    { id: uuid(), categoryId: catPedi, name: 'Педикюр с покрытием', duration: 90, price: 5000, breakAfter: 0, repeatDays: 28, active: true },
    { id: uuid(), categoryId: catPedi, name: 'Педикюр без покрытия', duration: 60, price: 3500, breakAfter: 0, repeatDays: 28, active: true },
  ];
  await bulkInsertDemo('services', services);

  // --- Клиенты ---
  const clients = FIRST.map((f, i) => {
    // Часть клиентов добавлена в этом месяце (для «+N в ноябре»)
    const created = i < 3 ? addDays(startOfMonth(t), Math.min(i * 3, Math.max(0, Number(t.slice(8)) - 1)))
      : addDays(t, -(30 + Math.floor(rand() * 330)));
    const birthMonth = 1 + Math.floor(rand() * 12);
    return {
      id: uuid(),
      name: `${f} ${LAST[i]}`,
      phone: `+7 9${String(10 + Math.floor(rand() * 89))} ${String(100 + Math.floor(rand() * 899))}-${String(10 + Math.floor(rand() * 89))}-${String(10 + Math.floor(rand() * 89))}`,
      birthday: `1990-${String(birthMonth).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`,
      notes: '',
      tags: [],
      createdAt: new Date(created + 'T10:00:00').toISOString(),
    };
  });
  await bulkInsertDemo('clients', clients);

  // --- Записи с начала прошлого месяца до конца следующего ---
  const from = addMonths(t, -1);
  const to = endOfMonth(addMonths(t, 1));
  const slotStarts = [540, 660, 780, 900, 1020]; // 9, 11, 13, 15, 17
  const appts = [];
  const payments = [];
  const now = nowMin();
  const popular = [services[0], services[0], services[0], services[1], services[2], services[4], services[5]];

  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (weekdayIndex(d) > 3 || d === nextWed) continue;
    const future = d > t;
    // В будущем дни заполнены реже — чтобы были свободные окна
    const fill = future ? Math.max(0.15, 0.7 - diffDays(t, d) / 40) : 0.75;
    for (const start of slotStarts) {
      if (rand() > fill) continue;
      const svc = pick(popular);
      const extra = svc === services[0] && rand() < 0.15 ? [services[3]] : [];
      const list = [svc, ...extra].filter((s) => s.duration + start <= 1140);
      const duration = Math.min(120, list.reduce((s, x) => s + x.duration, 0));
      const price = list.reduce((s, x) => s + x.price, 0);
      const discount = rand() < 0.1 ? 10 : 0;
      const total = calcTotal(price, 'percent', discount);
      const past = d < t || (d === t && start + duration <= now);

      let status = future || !past ? (rand() < 0.5 ? 'confirmed' : 'scheduled') : 'completed';
      if (past) {
        const r = rand();
        if (r < 0.05) status = 'noshow';
        else if (r < 0.1) status = 'cancelled';
      }
      const client = pick(clients);
      const id = uuid();
      appts.push({
        id,
        clientId: client.id,
        services: list.map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
        date: d,
        start,
        duration,
        breakAfter: 0,
        price,
        discountType: 'percent',
        discountValue: discount,
        total,
        prepaid: 0,
        comment: '',
        status,
        repeat: 0,
        seriesId: null,
        reminderSentAt: !past && d <= addDays(t, 1) && rand() < 0.6 ? new Date().toISOString() : null,
        locationId,
      });
      if (status === 'completed') {
        payments.push({ appointmentId: id, amount: total, method: pick(['cash', 'card', 'card', 'transfer']), kind: 'final', date: d });
      }
    }
  }
  await bulkInsertDemo('appointments', appts);
  await bulkInsertDemo('payments', payments);

  // --- Расходы ---
  const ms = startOfMonth(t);
  await bulkInsertDemo('expenses', [
    { amount: 45000, category: 'Аренда', date: ms, comment: 'Аренда кабинета' },
    { amount: 8650, category: 'Материалы', date: addDays(ms, 3), comment: 'Гель-лаки, базы' },
    { amount: 3000, category: 'Реклама', date: addDays(ms, 5), comment: 'Продвижение в соцсетях' },
    { amount: 45000, category: 'Аренда', date: addMonths(t, -1), comment: 'Аренда кабинета' },
    { amount: 12400, category: 'Материалы', date: addDays(addMonths(t, -1), 8), comment: 'Фрезы, пилки' },
  ]);

  // --- Лист ожидания ---
  await bulkInsertDemo('waitlist', [
    { clientId: clients[6].id, serviceId: services[0].id, dateFrom: t, dateTo: addDays(t, 14), timeFrom: '15:00', timeTo: '19:00', note: 'Удобно после работы', status: 'waiting' },
    { clientId: clients[12].id, serviceId: services[4].id, dateFrom: addDays(t, 3), dateTo: addDays(t, 10), timeFrom: '09:00', timeTo: '13:00', note: '', status: 'waiting' },
  ]);

  // --- Отзывы ---
  await bulkInsertDemo('reviews', [
    { clientId: clients[0].id, rating: 5, text: 'Очень аккуратно и быстро, покрытие держится три недели!', date: addDays(t, -12) },
    { clientId: clients[4].id, rating: 5, text: 'Лучший мастер в городе, всем советую.', date: addDays(t, -20) },
    { clientId: clients[9].id, rating: 4, text: 'Всё понравилось, немного задержались по времени.', date: addDays(t, -33) },
  ]);

  return true;
}
