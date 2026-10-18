/* =====================================================================
   Tiešsaiste / bezsaiste
   • Statuss galvenē: ● Tiešsaiste / ○ Bezsaiste (+ cik izmaiņu gaida Google).
   • Darbs bezsaistē: visas bibliotēkas un veidnes (vendor/offline.json)
     tiek iepriekš saglabātas pārlūka kešā “cadet-vendor”; mainītie faili
     atjaunojas pēc kontrolsummas. Personu dati un dokumenti kešā nenonāk.
   • Kad savienojums atjaunojas: šifrētā kopija Google Drive un Google
     kalendārs tiek sinhronizēti automātiski; ja vajag pieslēgties Google —
     paziņojums ar pogu.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const VCACHE = 'cadet-vendor', MKEY = 'cp.offlineMap';
  const st = { online: navigator.onLine, ready: null, done: 0, total: 0, bytes: 0, running: false, error: '', since: Date.now() };
  const canCache = () => CP.WEB && 'caches' in window && 'serviceWorker' in navigator;
  const mapGet = () => { try { return JSON.parse(localStorage.getItem(MKEY) || '{}'); } catch (e) { return {}; } };
  const mapSet = m => { try { localStorage.setItem(MKEY, JSON.stringify(m)); } catch (e) { } };
  const abs = f => new URL(CP.VENDOR + f, location.href).href;

  async function manifest(net) {
    const url = abs('offline.json');
    if (net) {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw Error('bezsaistes saraksts nav atrasts');
      const j = await r.clone().json(); (await caches.open(VCACHE)).put(url, r); return j;
    }
    const hit = await (await caches.open(VCACHE)).match(url); return hit ? hit.json() : null;
  }
  /** Pārbauda, vai visi faili ir kešā (bez tīkla) */
  async function check() {
    if (!canCache()) { st.ready = null; return paint(); }
    try {
      const m = await manifest(false); if (!m) { st.ready = false; st.total = 0; st.done = 0; return paint(); }
      const c = await caches.open(VCACHE), map = mapGet(); let n = 0;
      for (const x of m.files) if (map[x.f] === x.h && await c.match(abs(x.f), { ignoreSearch: true })) n++;
      st.total = m.files.length; st.done = n; st.ready = n === m.files.length;
    } catch (e) { st.ready = false; }
    paint();
  }
  /** Lejupielādē trūkstošos vai mainītos failus */
  async function prepare(manual) {
    if (!canCache()) { if (manual) ui.toast('Bezsaistes režīms pieejams tikai tīmekļa versijā (https).', 'warn'); return; }
    if (st.running) return; if (!navigator.onLine) { if (manual) ui.toast('Nav interneta — sagatavot bezsaistei var, kad savienojums ir.', 'warn'); return; }
    st.running = true; st.error = ''; paint();
    try {
      const m = await manifest(true), c = await caches.open(VCACHE), map = mapGet();
      st.total = m.files.length; st.done = 0; st.bytes = 0;
      for (const x of m.files) {
        const url = abs(x.f);
        if (!(map[x.f] === x.h && await c.match(url, { ignoreSearch: true }))) {
          const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw Error(`${x.f}: ${r.status}`);
          await c.put(url, r); map[x.f] = x.h; mapSet(map); st.bytes += x.s;
        }
        st.done++; paint();
      }
      for (const k of Object.keys(map)) if (!m.files.some(x => x.f === k)) delete map[k];
      mapSet(map); st.ready = true;
      if (manual) ui.toast('✓ Rīks sagatavots darbam bezsaistē', 'ok', 5000);
    } catch (e) { st.error = e.message; st.ready = false; if (manual) ui.toast('Bezsaistei neizdevās sagatavot: ' + e.message, 'warn', 9000); }
    finally { st.running = false; paint(); }
  }

  /* --- Sinhronizācija ar Google, kad savienojums atjaunojas --- */
  const pend = () => {
    const out = [], E = CP.encBackup?.state?.(), G = CP.google;
    if (E?.enabled && E.drive && CP.encBackup.pending?.()) out.push({ k: 'drive', l: 'šifrētā kopija Google Drive', scope: 'drive', ok: () => G?.has('drive') });
    if (CP.gcal?.enabled() && CP.gcal.pending()) out.push({ k: 'cal', l: `Google kalendārs (${CP.gcal.pending()})`, scope: 'cal', ok: () => G?.has('cal') });
    return out;
  };
  let syncing = false;
  async function syncAll(manual) {
    if (syncing || !S.root) return; const list = pend();
    if (!list.length) { if (manual) ui.toast('Viss jau sinhronizēts ar Google', 'ok', 4000); return; }
    if (!navigator.onLine) return manual && ui.toast('Nav interneta — sinhronizēs, kad savienojums atjaunosies.', 'warn', 7000);
    syncing = true; paint();
    const need = [], done = [];
    try {
      for (const x of list) {
        if (!x.ok()) { need.push(x); continue; }
        try { if (x.k === 'drive') await CP.encBackup.run({ quiet: true }); else await CP.gcal.sync(false); done.push(x.l); }
        catch (e) { need.push(x); }
      }
    } finally { syncing = false; paint(); }
    if (need.length) {
      CP.google?.paintBanner?.();
      ui.toast(`Savienojums ir. Lai nosūtītu izmaiņas (${need.map(x => x.l).join(', ')}), pieslēdzies Google.`, 'warn', 15000, { act: 'netConnect', label: 'Pieslēgties' });
    } else if (done.length && !manual) ui.toast(`Savienojums atjaunots — izmaiņas nosūtītas: ${done.join(', ')}`, 'ok', 7000);
    else if (done.length) ui.toast(`Sinhronizēts: ${done.join(', ')}`, 'ok', 5000);
  }
  A.netConnect = async () => {
    const list = pend(), scopes = [...new Set(list.map(x => x.scope))]; if (!scopes.length) return;
    if (await CP.google.token(scopes, true)) syncAll(true);
  };
  A.netSync = () => syncAll(true);
  A.netPrepare = () => prepare(true);

  /* --- Statuss galvenē --- */
  function pill() {
    const p = pend().length;
    return st.online
      ? `<span class="net-dot on"></span>Tiešsaiste${p ? ` <span class="net-badge" title="Izmaiņas gaida nosūtīšanu uz Google">${p}</span>` : ''}${st.running ? ' <span class="muted">· sagatavo bezsaistei ' + Math.round(st.done / Math.max(1, st.total) * 100) + '%</span>' : ''}`
      : `<span class="net-dot off"></span>Bezsaiste${p ? ` <span class="net-badge" title="Izmaiņas nosūtīs, kad būs internets">${p}</span>` : ''}`;
  }
  function paint() {
    let b = U.$('netPill');
    const host = U.$('yearPick'); if (!host) return;
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'netPill'; b.className = 'net-pill'; b.dataset.act = 'netInfo'; host.parentNode.insertBefore(b, host); }
    b.classList.toggle('offline', !st.online);
    b.title = st.online ? 'Ir interneta savienojums' + (st.ready ? ' · rīks gatavs darbam bezsaistē' : st.ready === false ? ' · rīks vēl nav pilnībā sagatavots bezsaistei' : '') : 'Nav interneta — darbs turpinās, dati glabājas datorā';
    const h = pill(); if (b.dataset.h !== h) { b.innerHTML = h; b.dataset.h = h; }
    if (U.$('netDialog')?.open) info();
  }
  function info() {
    let d = U.$('netDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'netDialog'; document.body.appendChild(d); }
    const p = pend(), E = CP.encBackup?.state?.(), last = E?.last?.at;
    const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    d.innerHTML = `<header class="dlg-head"><h2>${st.online ? '● Tiešsaiste' : '○ Bezsaiste'}</h2><button type="button" class="ghost" data-close="netDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body net-info">
        <p style="margin-top:0">${st.online ? 'Ir interneta savienojums.' : 'Nav interneta. <b>Darbs turpinās</b> — personas, dokumenti un izmaiņas glabājas tavā datu mapē datorā. Google kopija un kalendārs tiks atjaunināti, kad savienojums atjaunosies.'}</p>
        <h4>Darbs bezsaistē</h4>
        <p class="small">${st.ready === null ? 'Šajā versijā (atvērts no datora faila) bezsaistes kešs nav vajadzīgs — viss jau ir datorā.' : st.running ? `Sagatavo… ${st.done}/${st.total} (${pct}%)` : st.ready ? '✓ Rīks gatavs darbam bezsaistē: Word un PDF skatīšana, veidlapas, līgumi, anketu nolasīšana, personas lietas paka.' : `⚠ Vēl nav pilnībā sagatavots (${st.done}/${st.total || '?'})${st.error ? ' — ' + esc(st.error) : ''}. Bez tā bezsaistē var nestrādāt Word skatīšana, PDF veidlapas, līgumi un anketu nolasīšana.`}</p>
        ${st.ready === null ? '' : `<div class="actions"><button type="button" class="sm ${st.ready ? '' : 'mainbtn'}" data-act="netPrepare" ${st.running || !st.online ? 'disabled' : ''}>${st.ready ? 'Pārbaudīt atjauninājumus' : 'Sagatavot bezsaistei'} (~23 MB)</button></div>`}
        <h4>Sinhronizācija ar Google</h4>
        ${p.length ? `<p class="small">Gaida nosūtīšanu: <b>${esc(p.map(x => x.l).join(', '))}</b>.</p>` : `<p class="small">Viss nosūtīts.${last ? ' Pēdējā kopija: ' + esc(U.fmtDateTime(last)) + '.' : ''}${CP.gcal?.lastSync() ? ' Kalendārs: ' + esc(U.fmtDateTime(CP.gcal.lastSync())) + '.' : ''}</p>`}
        ${p.length ? `<div class="actions"><button type="button" class="sm mainbtn" data-act="netSync" ${st.online ? '' : 'disabled'}>⟳ Sinhronizēt tagad</button></div>` : ''}
        <p class="small muted">Bez interneta nestrādā arī: “Ziņot”, WhatsApp / Signal saites, Google Vision atpazīšana un atjauninājumu pārbaude.</p>
      </div>`;
    if (!d.open) d.showModal();
  }
  A.netInfo = () => { check().then(info); };

  /* --- Notikumi --- */
  async function reallyOnline() {
    try { const r = await fetch(new URL('version.json', location.href).href + '?t=' + Date.now(), { cache: 'no-store' }); return r.ok; } catch (e) { return false; }
  }
  addEventListener('offline', () => {
    st.online = false; st.since = Date.now(); paint();
    ui.toast('Nav interneta. Darbs turpinās — dati glabājas datorā; Google kopija un kalendārs tiks atjaunināti vēlāk.', 'warn', 8000);
  });
  addEventListener('online', () => setTimeout(async () => {
    if (!(await reallyOnline())) return;
    const was = st.online; st.online = true; paint();
    if (!was) { await syncAll(false); if (!st.ready) prepare(false); }
  }, 2500));
  // sākumā: statuss, pārbaude un (tiešsaistē) fona sagatavošana
  setTimeout(async () => { paint(); await check(); if (st.online && st.ready === false) prepare(false); }, 6000);
  CP.afterRender = CP.afterRender || []; CP.afterRender.push(() => paint());
  setInterval(paint, 60000);
  CP.offline = { state: () => ({ ...st }), prepare, check, syncAll, pending: pend };
})(window.CP);
