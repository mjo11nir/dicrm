// Точка входа и роутер вкладок/экранов.
// У каждой вкладки свой стек экранов; вкладка помнит прокрутку и открытый подэкран,
// потому что её DOM не уничтожается при переключении.
//
// Экран — это функция (params, nav) → { el, refresh?, onShow?, destroy? }.
//   el      — корневой элемент экрана;
//   refresh — перерисовать данные (вызывается после изменений в базе);
//   onShow  — вызывается, когда экран снова становится видимым.

import { seedIfEmpty } from './demo.js';
import { getSettings } from './db.js';
import { setCurrency } from './utils/money.js';
import { icons } from './components/icons.js';
import { el, toast } from './components/ui.js';
import { HomeScreen } from './screens/home.js';
import { ScheduleScreen } from './screens/schedule.js';
import { ChatsScreen } from './screens/chats.js';
import { MoreScreen } from './screens/more.js';

const TABS = [
  { id: 'home', label: 'Главная', icon: 'tabHome', screen: HomeScreen },
  { id: 'schedule', label: 'Расписание', icon: 'tabSchedule', screen: ScheduleScreen },
  { id: 'chats', label: 'Чаты', icon: 'tabChats', screen: ChatsScreen },
  { id: 'more', label: 'Другое', icon: 'tabMore', screen: MoreScreen },
];

/** Состояние вкладок: { id → { pane, stack: [{inst, node, dirty}] } } */
const tabs = {};
let activeTab = null;

/** Глобальный объект приложения — доступен экранам через nav.app */
export const app = {
  switchTab,
  get activeTab() { return activeTab; },
  settings: null,
};

function makeNav(tabId) {
  return {
    app,
    tab: tabId,
    push: (factory, params) => push(tabId, factory, params),
    pop: () => pop(tabId),
    popToRoot: () => popToRoot(tabId),
    switchTab: (id, params) => switchTab(id, params),
  };
}

function mountScreen(tabId, factory, params) {
  const inst = factory(params || {}, makeNav(tabId));
  const node = el('div', { class: 'screen' });
  node.appendChild(inst.el);
  return { inst, node, dirty: false };
}

function push(tabId, factory, params) {
  const t = tabs[tabId];
  const prev = t.stack[t.stack.length - 1];
  const entry = mountScreen(tabId, factory, params);
  entry.node.classList.add('enter');
  t.pane.appendChild(entry.node);
  t.stack.push(entry);
  // Анимация как в iOS: новый экран выезжает справа, прежний немного уходит влево
  requestAnimationFrame(() => requestAnimationFrame(() => {
    entry.node.classList.remove('enter');
    prev?.node.classList.add('behind');
  }));
  return entry.inst;
}

function pop(tabId) {
  const t = tabs[tabId];
  if (t.stack.length <= 1) return;
  const top = t.stack.pop();
  const prev = t.stack[t.stack.length - 1];
  prev.node.classList.remove('behind');
  top.node.classList.add('leave');
  setTimeout(() => { top.inst.destroy?.(); top.node.remove(); }, 320);
  showEntry(prev);
}

function popToRoot(tabId) {
  const t = tabs[tabId];
  while (t.stack.length > 1) {
    const top = t.stack.pop();
    top.inst.destroy?.();
    top.node.remove();
  }
  t.stack[0].node.classList.remove('behind');
  showEntry(t.stack[0]);
}

/** Показать экран: обновить, если данные менялись, и вызвать onShow */
function showEntry(entry) {
  if (entry.dirty) {
    entry.dirty = false;
    entry.inst.refresh?.();
  }
  entry.inst.onShow?.();
}

function switchTab(id, params = null) {
  if (!tabs[id]) return;
  if (activeTab === id && !params) {
    // Повторное нажатие на активную вкладку — вернуться к корневому экрану
    popToRoot(id);
    tabs[id].stack[0].node.scrollTop = 0;
    return;
  }
  activeTab = id;
  for (const [tid, t] of Object.entries(tabs)) t.pane.hidden = tid !== id;
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  const t = tabs[id];
  const top = t.stack[t.stack.length - 1];
  if (params) {
    popToRoot(id);
    t.stack[0].inst.setParams?.(params);
  } else {
    showEntry(top);
  }
  document.body.dataset.tab = id;
}

/** После изменения данных: видимый экран обновляем сразу, остальные — когда станут видимы */
function onDataChange() {
  for (const [tid, t] of Object.entries(tabs)) {
    t.stack.forEach((entry, i) => {
      const visible = tid === activeTab && i === t.stack.length - 1;
      if (visible) entry.inst.refresh?.();
      else entry.dirty = true;
    });
  }
}

function buildTabBar() {
  const bar = el('nav', { class: 'tabbar', 'aria-label': 'Разделы' });
  for (const t of TABS) {
    bar.appendChild(el('button', {
      class: 'tab-btn', type: 'button', 'data-tab': t.id, onclick: () => switchTab(t.id),
    }, el('span', { class: 'tab-ic', html: icons[t.icon] }), el('span', { class: 'tab-label' }, t.label)));
  }
  return bar;
}

async function start() {
  const root = document.getElementById('app');
  try {
    await seedIfEmpty();
  } catch (e) {
    console.error(e);
    toast('Не удалось подготовить базу данных');
  }
  app.settings = await getSettings();
  setCurrency(app.settings.currency);
  document.title = app.settings.appName;

  const panes = el('main', { class: 'panes' });
  for (const t of TABS) {
    const pane = el('section', { class: 'pane', 'data-pane': t.id, hidden: true });
    panes.appendChild(pane);
    const entry = mountScreen(t.id, t.screen, {});
    pane.appendChild(entry.node);
    tabs[t.id] = { pane, stack: [entry] };
  }
  root.replaceChildren(panes, buildTabBar());
  switchTab('home');

  window.addEventListener('db:change', async () => {
    app.settings = await getSettings();
    setCurrency(app.settings.currency);
    onDataChange();
  });

  // Смена дня (приложение открыто через полночь) — перерисовать
  let lastDay = new Date().toDateString();
  setInterval(() => {
    const d = new Date().toDateString();
    if (d !== lastDay) { lastDay = d; onDataChange(); }
  }, 60000);
}

start();
