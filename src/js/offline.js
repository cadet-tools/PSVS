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
      const r = await fetch(url + '?cpraw=1', { cache: 'no-store' }); if (!r.ok) throw Error('bezsaistes saraksts nav atrasts');
      const text = await r.text(); const j = JSON.parse(text);
      await (await caches.open(VCACHE)).put(url, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
      return j;
    }
    const hit = await (await caches.open(VCACHE)).match(url); return hit ? hit.json() : null;
  }
  const latNet = e => { const m = (e && e.message) || String(e || ''); return /Cache\.put|network error|Failed to fetch|NetworkError|nepilns/i.test(m) && !/nepilns/.test(m) ? 'savienojums pārtrūka lejupielādes laikā' : m; };
  /** Pilns fails atmiņā, tad kešā. ?cpraw=1 neiet caur servisa darbinieku, lai Cache.put nesaņem pārtrauktu plūsmu. */
  async function pullFile(url) {
    let last; const raw = url + (url.includes('?') ? '&' : '?') + 'cpraw=1';
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(raw, { cache: 'no-store' }); if (!r.ok) throw Error(String(r.status));
        const buf = await r.arrayBuffer(); if (!buf.byteLength) throw Error('tukšs fails');
        return { buf, type: r.headers.get('Content-Type') || '' };
      } catch (e) { last = e; await new Promise(res => setTimeout(res, 500 * (i + 1))); }
    }
    throw last;
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
      st.total = m.files.length; st.done = 0; st.bytes = 0; const failed = [];
      for (const x of m.files) {
        const url = abs(x.f);
        try {
          if (!(map[x.f] === x.h && await c.match(url, { ignoreSearch: true }))) {
            const { buf, type } = await pullFile(url);
            if (buf.byteLength !== x.s) throw Error(`nepilns (${buf.byteLength} no ${x.s})`);
            await c.put(url, new Response(buf, { headers: type ? { 'Content-Type': type } : {} }));
            map[x.f] = x.h; mapSet(map); st.bytes += buf.byteLength;
          }
          st.done++;
        } catch (e) { failed.push(`${x.f}: ${latNet(e)}`); }
        paint();
      }
      for (const k of Object.keys(map)) if (!m.files.some(x => x.f === k)) delete map[k];
      mapSet(map); st.ready = !failed.length && st.done === m.files.length;
      if (failed.length) {
        st.error = (failed.length === 1 ? failed[0] : `${failed.length} faili neielādējās. ${failed.slice(0, 2).join('; ')}`) + ' Jau saglabātie paliek — spied pogu vēlreiz.';
        if (manual) ui.toast('Bezsaistei neizdevās sagatavot: ' + st.error, 'warn', 9000);
      } else if (manual) ui.toast('✓ Rīks sagatavots darbam bezsaistē', 'ok', 5000);
    } catch (e) { st.error = latNet(e); st.ready = false; if (manual) ui.toast('Bezsaistei neizdevās sagatavot: ' + st.error, 'warn', 9000); }
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
  const scopesWanted = () => {
    const E = CP.encBackup?.state?.() || {}, s = [];
    if (E.enabled && E.drive) s.push('drive');
    if (CP.gcal?.enabled?.()) s.push('cal');
    return s;
  };
  /** Ko rādīt pie “Sinhronizācija ar Google”. “Viss nosūtīts” tikai tad, kad Google tiešām ir pieslēgts un rindā nekā nav. */
  function gView() {
    const E = CP.encBackup?.state?.() || {}, G = CP.google;
    const driveOn = !!(E.enabled && E.drive), calOn = !!CP.gcal?.enabled?.();
    const last = E.last?.at || '', calLast = CP.gcal?.lastSync?.() || '', p = pend();
    const when = iso => iso ? esc(U.fmtDateTime(iso)) : '';
    if (!driveOn && !calOn) return {
      html: E.enabled ? 'Šifrētā kopija ir mapē datorā. Google Drive un kalendārs nav pieslēgti, tāpēc uz Google nekas netiek sūtīts.' : 'Google nav pieslēgts. Šifrētā kopija un kalendārs nav ieslēgti, tāpēc nekas netiek sūtīts.',
      act: 'netGoogleSet', label: 'Atvērt iestatījumus'
    };
    const miss = [];
    if (driveOn && !G?.has?.('drive')) miss.push('Google Drive');
    if (calOn && !G?.has?.('cal')) miss.push('kalendārs');
    const prev = [last ? `Pēdējā kopija: ${when(last)}.` : (driveOn ? 'Kopija vēl nav nosūtīta.' : ''), calLast ? `Kalendārs: ${when(calLast)}.` : ''].filter(Boolean).join(' ');
    if (miss.length) return {
      html: `Google nav pieslēgts (${esc(miss.join(', '))}).${p.length ? ` Gaida nosūtīšanu: <b>${esc(p.map(x => x.l).join(', '))}</b>.` : ''}${prev ? ' ' + prev : ''}`,
      act: 'netConnect', label: 'Pieslēgties'
    };
    if (p.length) return { html: `Gaida nosūtīšanu: <b>${esc(p.map(x => x.l).join(', '))}</b>.`, act: 'netSync', label: '⟳ Sinhronizēt tagad' };
    return { html: `Viss nosūtīts.${last ? ' Pēdējā kopija: ' + when(last) + '.' : ''}${calLast ? ' Kalendārs: ' + when(calLast) + '.' : ''}`, act: '', label: '' };
  }
  A.netGoogleSet = () => { U.$('netDialog')?.close(); CP.actions.encGoSet?.(); };
  A.netConnect = async () => {
    const scopes = scopesWanted(); if (!scopes.length) return;
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
    const g = gView();
    const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    d.innerHTML = `<header class="dlg-head"><h2>${st.online ? '● Tiešsaiste' : '○ Bezsaiste'}</h2><button type="button" class="ghost" data-close="netDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body net-info">
        <p style="margin-top:0">${st.online ? 'Ir interneta savienojums.' : 'Nav interneta. <b>Darbs turpinās</b> — personas, dokumenti un izmaiņas glabājas tavā datu mapē datorā. Google kopija un kalendārs tiks atjaunināti, kad savienojums atjaunosies.'}</p>
        <h4>Darbs bezsaistē</h4>
        <p class="small">${st.ready === null ? 'Šajā versijā (atvērts no datora faila) bezsaistes kešs nav vajadzīgs — viss jau ir datorā.' : st.running ? `Sagatavo… ${st.done}/${st.total} (${pct}%)` : st.ready ? '✓ Rīks gatavs darbam bezsaistē: Word un PDF skatīšana, veidlapas, līgumi, anketu nolasīšana, personas lietas paka.' : `⚠ Vēl nav pilnībā sagatavots (${st.done}/${st.total || '?'})${st.error ? ' — ' + esc(st.error) : ''}. Bez tā bezsaistē var nestrādāt Word skatīšana, PDF veidlapas, līgumi un anketu nolasīšana.`}</p>
        ${st.ready === null ? '' : `<div class="actions"><button type="button" class="sm ${st.ready ? '' : 'mainbtn'}" data-act="netPrepare" ${st.running || !st.online ? 'disabled' : ''}>${st.ready ? 'Pārbaudīt atjauninājumus' : 'Sagatavot bezsaistei'} (~23 MB)</button></div>`}
        <h4>Sinhronizācija ar Google</h4>
        <p class="small">${g.html}</p>
        ${g.act ? `<div class="actions"><button type="button" class="sm mainbtn" data-act="${g.act}" ${st.online || g.act === 'netGoogleSet' ? '' : 'disabled'}>${esc(g.label)}</button></div>` : ''}
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
