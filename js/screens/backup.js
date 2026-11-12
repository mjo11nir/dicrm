// «Резервная копия»: экспорт всех данных (включая фото) в один JSON-файл и импорт обратно,
// удаление демо-данных. Раз в 7 дней на Главной появляется напоминание сделать копию.

import * as data from '../db.js';
import { el, navBar, groupedList, toast, confirmAction, downloadFile } from '../components/ui.js';
import { today, diffDays, formatDayShort, ymd } from '../utils/dates.js';

/** Через сколько дней напоминать о резервной копии */
export const BACKUP_EVERY_DAYS = 7;

/** Нужно ли напомнить о копии: прошло 7 дней с последней копии (или с первого запуска) */
export function backupDue(settings) {
  const last = settings.lastBackupAt || settings.firstRunAt;
  if (!last) return false;
  return diffDays(ymd(new Date(last)), today()) >= BACKUP_EVERY_DAYS;
}

/** Сделать копию и скачать файл */
export async function makeBackup() {
  const backup = await data.exportAll();
  const json = JSON.stringify(backup);
  downloadFile(`beauty-crm-${today()}.json`, json, 'application/json');
  await data.setSetting('lastBackupAt', new Date().toISOString());
  const mb = (json.length / 1024 / 1024).toFixed(1);
  toast(`Резервная копия сохранена (${mb} МБ)`);
}

export function BackupScreen(params, nav) {
  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  root.append(navBar({ title: 'Резервная копия', onBack: () => nav.pop() }), body);

  async function refresh() {
    const [settings, demo, counts] = await Promise.all([
      data.getSettings(), data.hasDemo(),
      Promise.all(['clients', 'appointments', 'gallery'].map((t) => data.getAll(t).then((r) => r.length))),
    ]);
    const last = settings.lastBackupAt ? `${formatDayShort(ymd(new Date(settings.lastBackupAt)))}` : 'ещё не делали';
    body.replaceChildren(
      el('div', { class: 'hint pad' }, 'Все данные хранятся только на этом телефоне. Если удалить приложение или очистить данные Safari, они пропадут. Сохраняйте копию в «Файлы» или iCloud Drive хотя бы раз в неделю.'),
      groupedList([
        { title: 'Сделать резервную копию', subtitle: `Клиентов ${counts[0]}, записей ${counts[1]}, фото ${counts[2]}`, onClick: makeBackup },
        { title: 'Восстановить из копии', subtitle: 'Текущие данные будут заменены', onClick: restore },
      ], { header: `Последняя копия: ${last}` }),
      demo
        ? groupedList([{ title: 'Удалить демо-данные', danger: true, onClick: removeDemo }],
          { header: 'Демо-данные', footer: 'Удалятся примерные клиенты, записи, расходы, отзывы и лист ожидания. График, услуги и место работы останутся — их можно изменить под себя.' })
        : null,
    );
  }

  function restore() {
    const input = el('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        toast('Файл повреждён или это не JSON');
        return;
      }
      const date = backup.exportedAt ? formatDayShort(ymd(new Date(backup.exportedAt))) : 'неизвестной даты';
      const ok = await confirmAction({
        title: 'Восстановить копию?',
        message: `Копия от ${date}. Все текущие данные на этом устройстве будут заменены.`,
        okText: 'Восстановить', danger: true,
      });
      if (!ok) return;
      try {
        await data.importAll(backup);
        toast('Данные восстановлены');
      } catch (e) {
        toast(e.message || 'Не удалось восстановить копию');
      }
    });
    input.click();
  }

  async function removeDemo() {
    const ok = await confirmAction({ title: 'Удалить демо-данные?', message: 'Это действие нельзя отменить.', okText: 'Удалить', danger: true });
    if (!ok) return;
    await data.deleteDemo();
    toast('Демо-данные удалены');
  }

  refresh();
  return { el: root, refresh };
}
