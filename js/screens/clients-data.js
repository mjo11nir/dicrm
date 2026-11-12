// Настройки → «Клиенты»: импорт и экспорт CSV, поиск и объединение дубликатов.

import * as data from '../db.js';
import { el, navBar, groupedList, toast, confirmAction, emptyState } from '../components/ui.js';
import { clientsToCsv, csvToClients, findDuplicates } from '../utils/clients.js';
import { phoneDigits } from '../utils/appt.js';
import { today } from '../utils/dates.js';

export function ClientsDataScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Клиенты', onBack: () => nav.pop() }), body);

  async function refresh() {
    const clients = (await data.getAll('clients')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    const groups = findDuplicates(clients);
    const dupBox = el('div', {});
    if (!groups.length) dupBox.appendChild(emptyState({ title: 'Дубликатов нет', text: 'Клиентов с одинаковым телефоном или именем не найдено.' }));
    for (const g of groups) {
      dupBox.appendChild(groupedList([
        ...g.map((c) => ({ title: c.name, subtitle: c.phone || 'без телефона' })),
        { title: `Объединить в «${g[0].name}»`, onClick: () => merge(g), chevron: false },
      ]));
    }
    body.replaceChildren(
      groupedList([
        { title: 'Экспорт в CSV', subtitle: `Все клиенты (${clients.length}) в файл для Excel / Google Таблиц`, onClick: () => exportCsv(clients) },
        { title: 'Импорт из CSV', subtitle: 'Колонки: Имя; Телефон; День рождения; Telegram; Скидка %; Теги; Заметки', onClick: importCsv },
      ], { header: 'Файлы', footer: 'При импорте клиенты с уже существующим телефоном пропускаются.' }),
      el('div', { class: 'group-header' }, `Возможные дубликаты (${groups.length})`),
      dupBox);
  }

  function exportCsv(clients) {
    const blob = new Blob([clientsToCsv(clients)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `klienty-${today()}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Файл CSV сохранён');
  }

  function importCsv() {
    const input = el('input', { type: 'file', accept: '.csv,text/csv,text/plain' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const parsed = csvToClients(await file.text());
      if (!parsed.length) { toast('В файле не найдено клиентов'); return; }
      const existing = await data.getAll('clients');
      const phones = new Set(existing.map((c) => phoneDigits(c.phone).slice(-10)).filter((p) => p.length >= 7));
      let added = 0;
      let skipped = 0;
      for (const c of parsed) {
        const p = phoneDigits(c.phone).slice(-10);
        if (p.length >= 7 && phones.has(p)) { skipped++; continue; }
        await data.save('clients', c);
        if (p.length >= 7) phones.add(p);
        added++;
      }
      toast(`Добавлено: ${added}${skipped ? `, пропущено (уже есть): ${skipped}` : ''}`, { duration: 5000 });
    });
    input.click();
  }

  /** Объединить группу: записи, сообщения и пустые поля переносятся в первого клиента */
  async function merge(group) {
    const [main, ...rest] = group;
    const ok = await confirmAction({ title: 'Объединить клиентов?', message: `Записи ${rest.length + 1} карточек будут собраны в «${main.name}».`, okText: 'Объединить' });
    if (!ok) return;
    const ids = new Set(rest.map((c) => c.id));
    const [appts, messages] = await Promise.all([data.getAll('appointments'), data.getAll('messages')]);
    for (const a of appts) if (ids.has(a.clientId)) await data.update('appointments', a.id, { clientId: main.id });
    for (const m of messages) if (ids.has(m.clientId)) await data.update('messages', m.id, { clientId: main.id });
    const merged = { ...main };
    for (const c of rest) {
      for (const k of ['phone', 'telegram', 'birthday', 'avatar']) if (!merged[k] && c[k]) merged[k] = c[k];
      merged.discount = Math.max(merged.discount || 0, c.discount || 0);
      merged.tags = [...new Set([...(merged.tags || []), ...(c.tags || [])])];
      if (c.notes) merged.notes = [merged.notes, c.notes].filter(Boolean).join('\n');
      await data.remove('clients', c.id);
    }
    await data.save('clients', merged);
    toast('Клиенты объединены');
  }

  refresh();
  return { el: root, refresh };
}
