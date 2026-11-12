// «Статистика»: период (неделя / месяц / год / свой), выручка по дням (линейный график),
// записи, завершённые, отмены, неявки, средний чек, новые и вернувшиеся клиенты,
// топ услуг (столбцы), доходы против расходов, прибыль. Графики — Chart.js по CDN.

import * as data from '../db.js';
import { el, navBar, segmented, openSheet, field, toast, loadScript } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { computeStats, statsRange } from '../utils/stats.js';
import { today, parseYmd, MONTHS, MONTHS_SHORT, formatDayShort } from '../utils/dates.js';
import { money, moneyFull } from '../utils/money.js';

const CHART_JS = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';

export function StatsScreen(params, nav) {
  let kind = 'month';
  let offset = 0;
  let custom = null;
  const charts = [];

  const root = el('div', { class: 'page' });
  const body = el('div', { class: 'page-body' });
  const periodTitle = el('div', { class: 'stats-period-title' });
  const seg = segmented({
    options: [{ value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }, { value: 'custom', label: 'Свой' }],
    value: kind,
    full: true,
    onChange: (v) => {
      if (v === 'custom') { pickCustom(); return false; }
      kind = v;
      offset = 0;
      refresh();
      return true;
    },
  });
  const periodNav = el('div', { class: 'wv-nav' },
    el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Предыдущий период', html: icon('chevronLeft'), onclick: () => { offset--; refresh(); } }),
    periodTitle,
    el('button', { class: 'icon-btn primary', type: 'button', 'aria-label': 'Следующий период', html: icon('chevronRight'), onclick: () => { offset++; refresh(); } }));
  const content = el('div', {});
  body.append(seg, periodNav, content);
  root.append(navBar({ title: 'Статистика', onBack: () => nav.pop() }), body);

  function pickCustom() {
    const fromIn = el('input', { class: 'input', type: 'date', value: custom?.from || today().slice(0, 8) + '01' });
    const toIn = el('input', { class: 'input', type: 'date', value: custom?.to || today() });
    openSheet({
      title: 'Свой период',
      content: el('div', { class: 'form' }, el('div', { class: 'form-section' }, el('div', { class: 'grid2' }, field('С', fromIn), field('По', toIn)))),
      actionText: 'Готово',
      cancelText: 'Отмена',
      onAction: () => {
        if (!fromIn.value || !toIn.value || toIn.value < fromIn.value) { toast('Проверьте даты'); return false; }
        custom = { from: fromIn.value, to: toIn.value };
        kind = 'custom';
        offset = 0;
        seg.setValue('custom');
        refresh();
        return true;
      },
    });
  }

  function titleFor(range) {
    if (kind === 'month') {
      const d = parseYmd(range.from);
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (kind === 'year') return range.from.slice(0, 4);
    const f = parseYmd(range.from);
    const t = parseYmd(range.to);
    return `${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${t.getDate()} ${MONTHS_SHORT[t.getMonth()]}${f.getFullYear() !== t.getFullYear() ? ' ' + t.getFullYear() : ''}`;
  }

  async function refresh() {
    const range = statsRange(kind, offset, today(), custom);
    periodNav.classList.toggle('no-arrows', kind === 'custom');
    periodTitle.textContent = titleFor(range);
    const [appointments, expenses] = await Promise.all([data.getAll('appointments'), data.getAll('expenses')]);
    const s = computeStats({ ...range, appointments, expenses, byMonth: kind === 'year' });

    const kpi = (label, value, sub = '') => el('div', { class: 'card kpi' }, el('div', { class: 'kpi-l' }, label), el('div', { class: 'kpi-v' }, value), sub ? el('div', { class: 'kpi-s' }, sub) : null);
    const lineCanvas = el('canvas', { 'aria-label': 'Выручка по дням' });
    const topCanvas = el('canvas', { 'aria-label': 'Топ услуг' });
    const finCanvas = el('canvas', { 'aria-label': 'Доходы и расходы' });

    content.replaceChildren(
      el('div', { class: 'kpi-grid' },
        kpi('Выручка', money(s.revenue), `${s.completed} завершённых`),
        kpi('Прибыль', money(s.profit), `расходы ${money(s.expenses)}`),
        kpi('Записей', String(s.count), `отмен ${s.cancelled}`),
        kpi('Средний чек', money(s.avg)),
        kpi('Неявки', `${s.noshowPct}%`, `${s.noshow} из ${s.completed + s.noshow}`),
        kpi('Клиенты', `${s.newClients + s.returning}`, `новых ${s.newClients} · вернулись ${s.returning}`)),
      el('div', { class: 'card chart-card' }, el('div', { class: 'chart-title' }, kind === 'year' ? 'Выручка по месяцам' : 'Выручка по дням'), el('div', { class: 'chart-box' }, lineCanvas)),
      el('div', { class: 'card chart-card' }, el('div', { class: 'chart-title' }, 'Топ услуг'),
        s.topServices.length ? el('div', { class: 'chart-box', style: { height: Math.max(140, s.topServices.length * 38) + 'px' } }, topCanvas) : el('div', { class: 'hint' }, 'Нет завершённых записей за период')),
      el('div', { class: 'card chart-card' }, el('div', { class: 'chart-title' }, 'Доходы и расходы'), el('div', { class: 'chart-box small' }, finCanvas),
        s.expByCat.length ? el('div', { class: 'cat-summary' }, s.expByCat.map(([c, v]) => el('span', { class: 'cat-pill' }, `${c} ${moneyFull(v)}`))) : null),
    );

    // Графики рисуем после загрузки Chart.js; без интернета показываем понятное сообщение
    charts.splice(0).forEach((c) => c.destroy());
    try {
      await loadScript(CHART_JS);
    } catch {
      content.querySelectorAll('.chart-box').forEach((b) => b.replaceChildren(el('div', { class: 'hint' }, 'Графики загрузятся при подключении к интернету. Цифры выше посчитаны без него.')));
      return;
    }
    drawCharts(s, lineCanvas, topCanvas, finCanvas);
  }

  function drawCharts(s, lineCanvas, topCanvas, finCanvas) {
    const { Chart } = window;
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue('--primary').trim() || '#9137E8';
    const green = css.getPropertyValue('--green').trim() || '#28B84A';
    const red = css.getPropertyValue('--red').trim() || '#E5484D';
    const grid = '#ECECF0';
    const textColor = '#8A8A8E';
    Chart.defaults.font.family = css.getPropertyValue('--font');
    Chart.defaults.color = textColor;
    const euros = (v) => money(v * 100);
    const label = (k) => (kind === 'year' ? MONTHS_SHORT[Number(k.slice(5, 7)) - 1] : String(parseYmd(k).getDate()));

    charts.push(new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: s.series.map((p) => label(p.key)),
        datasets: [{
          data: s.series.map((p) => p.revenue / 100),
          borderColor: primary,
          backgroundColor: primary + '22',
          fill: true,
          tension: 0.3,
          pointRadius: s.series.length > 40 ? 0 : 3,
          pointBackgroundColor: primary,
        }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (it) => (kind === 'year' ? MONTHS[Number(s.series[it[0].dataIndex].key.slice(5, 7)) - 1] : formatDayShort(s.series[it[0].dataIndex].key)), label: (it) => euros(it.raw) } },
        },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { callback: euros, maxTicksLimit: 5 } } },
      },
    }));

    if (s.topServices.length) {
      charts.push(new Chart(topCanvas, {
        type: 'bar',
        data: {
          labels: s.topServices.map((x) => (x.name.length > 22 ? x.name.slice(0, 21) + '…' : x.name)),
          datasets: [{ data: s.topServices.map((x) => x.count), backgroundColor: primary, borderRadius: 6, barThickness: 18 }],
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => `${it.raw} записей · ${moneyFull(s.topServices[it.dataIndex].revenue)}` } } },
          scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }, y: { grid: { display: false } } },
        },
      }));
    }

    charts.push(new Chart(finCanvas, {
      type: 'bar',
      data: {
        labels: ['Доходы', 'Расходы', 'Прибыль'],
        datasets: [{ data: [s.revenue / 100, s.expenses / 100, s.profit / 100], backgroundColor: [green, red, primary], borderRadius: 8, barThickness: 40 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it) => euros(it.raw) } } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: grid }, ticks: { callback: euros, maxTicksLimit: 5 } } },
      },
    }));
  }

  refresh();
  return { el: root, refresh, destroy: () => charts.forEach((c) => c.destroy()) };
}
