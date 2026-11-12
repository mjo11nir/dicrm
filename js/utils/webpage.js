// Генератор web-страницы мастера (визитки): один самостоятельный HTML-файл
// со встроенными стилями и фото — его можно выложить на любой хостинг или отправить файлом.

/** Экранирование текста для HTML */
function h(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Собрать HTML страницы.
 * @param {{title, description, phone, address, instagram, telegram, theme: {from, to}}} cfg
 * @param {{services: {name, duration, price}[], photos: string[], avatar: string|null, money: Function, duration: Function}} parts
 */
export function buildWebPage(cfg, { services, photos, avatar, money, duration }) {
  const digits = String(cfg.phone || '').replace(/\D/g, '');
  const ig = String(cfg.instagram || '').replace(/^@/, '').trim();
  const tg = String(cfg.telegram || '').replace(/^@/, '').trim();
  const contacts = [
    digits ? `<a class="btn" href="tel:+${digits}">Позвонить</a>` : '',
    digits ? `<a class="btn" href="https://wa.me/${digits}">WhatsApp</a>` : '',
    tg ? `<a class="btn" href="https://t.me/${h(tg)}">Telegram</a>` : '',
    ig ? `<a class="btn" href="https://instagram.com/${h(ig)}">Instagram</a>` : '',
  ].filter(Boolean).join('');
  const serviceRows = services.map((s) => `<li><span>${h(s.name)}<small>${h(duration(s.duration))}</small></span><b>${h(money(s.price))}</b></li>`).join('');
  const gallery = photos.map((src) => `<img src="${src}" alt="Работа мастера" loading="lazy">`).join('');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(cfg.title)}</title>
<meta name="description" content="${h(String(cfg.description || '').slice(0, 160))}">
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"SF Pro Text",system-ui,Segoe UI,Roboto,sans-serif;background:#F2F1F7;color:#111;line-height:1.45}
  .wrap{max-width:640px;margin:0 auto;padding:0 0 40px}
  header{background:linear-gradient(135deg,${cfg.theme.from},${cfg.theme.to});color:#fff;padding:40px 20px 28px;text-align:center;border-radius:0 0 28px 28px}
  .ava{width:104px;height:104px;border-radius:50%;border:4px solid rgba(255,255,255,.7);object-fit:cover;background:#fff;display:block;margin:0 auto 14px}
  h1{margin:0;font-size:28px}
  header p{margin:10px auto 0;max-width:460px;opacity:.92;white-space:pre-line}
  section{background:#fff;margin:16px;border-radius:18px;padding:18px}
  h2{margin:0 0 12px;font-size:20px}
  ul{list-style:none;margin:0;padding:0}
  li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEE}
  li:last-child{border-bottom:0}
  li small{display:block;color:#8A8A8E;font-size:13px}
  li b{white-space:nowrap}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;border-radius:12px;overflow:hidden}
  .grid img{width:100%;aspect-ratio:1;object-fit:cover;display:block}
  .btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .btn{flex:1 1 140px;text-align:center;background:${cfg.theme.from};color:#fff;text-decoration:none;font-weight:600;padding:13px 16px;border-radius:999px}
  .addr{color:#555;text-align:center;margin:12px 0 0}
  footer{text-align:center;color:#8A8A8E;font-size:12px;margin-top:20px}
</style>
</head>
<body>
<div class="wrap">
  <header>
    ${avatar ? `<img class="ava" src="${avatar}" alt="">` : ''}
    <h1>${h(cfg.title)}</h1>
    ${cfg.description ? `<p>${h(cfg.description)}</p>` : ''}
  </header>
  ${serviceRows ? `<section><h2>Услуги и цены</h2><ul>${serviceRows}</ul></section>` : ''}
  ${gallery ? `<section><h2>Мои работы</h2><div class="grid">${gallery}</div></section>` : ''}
  ${contacts || cfg.address ? `<section><h2>Запись</h2><div class="btns">${contacts}</div>${cfg.address ? `<p class="addr">Адрес: ${h(cfg.address)}</p>` : ''}</section>` : ''}
  <footer>Страница создана в ${h(cfg.appName || 'Beauty CRM')}</footer>
</div>
</body>
</html>`;
}
