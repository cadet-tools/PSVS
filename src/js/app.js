/* =====================================================================
   Lietotnes palaišana un notikumu sadalīšana.
   Visas pogas izmanto data-act="nosaukums" (un data-arg) → CP.actions[nosaukums].
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions;

  document.addEventListener('click', async e => {
    // aizver atvērtās izvēlnes, ja klikšķis ārpus tām
    U.qsa('details.menu[open]').forEach(m => { if (!m.contains(e.target) || e.target.closest('.menu-list button')) m.removeAttribute('open'); });
    const el = e.target.closest('[data-act],[data-page],[data-person],[data-tab],[data-close]'); if (!el) return;
    const d = el.dataset;
    if (el.tagName === 'A') e.preventDefault();
    if (d.close) { U.$(d.close).close(); if (!d.person) return; }
    if (d.act) {
      const fn = A[d.act]; if (!fn) return console.warn('Nav darbības', d.act);
      if (!S.root && !CP.noRootOk(d.act)) { CP.needRoot(); return; }
      try { await fn(d.arg, el, e); } catch (err) { console.error(err); ui.toast('Kļūda: ' + err.message, 'err'); }
      return;
    }
    if (d.page) {
      if (d.page === 'archive') { S.list.status = 'archived'; S.list.missing = false; S.list.sel.clear(); ui.go('people'); return; }
      if (d.page === 'people' && S.list.status === 'archived') S.list.status = 'current';
      ui.go(d.page); return;
    }
    if (d.person) { if (U.$('viewDialog').open) U.$('viewDialog').close(); ui.go('person', { person: d.person, tab: d.goto || 'overview' }); return; }
    if (d.tab) { S.tab = d.tab; CP.render(); }
  });
  document.addEventListener('change', e => { for (const h of CP.changeHandlers) if (h(e)) return; });
  document.addEventListener('input', e => { for (const h of CP.inputHandlers) if (h(e)) return; });

  // Sānjosla
  U.$('search').addEventListener('input', () => ui.renderSide());
  U.$('search').addEventListener('keydown', e => { if (e.key === 'Enter') { const first = U.qs('#sideList .person'); if (first) first.click(); } });
  U.$('groupFilter').addEventListener('change', e => { S.groupFilter = e.target.value; ui.renderSide(); });
  U.$('sideArchive').addEventListener('change', e => { S.sideArchive = e.target.checked; ui.renderSide(); });

  // Īsinājumtaustiņi
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); CP.store.save(false); return; }
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !U.qs('dialog[open]'))) { e.preventDefault(); U.$('search').focus(); U.$('search').select(); return; }
    if (e.key === 'Enter' && e.target.id === 'noteText' && !e.shiftKey && !e.isComposing) { e.preventDefault(); A.addNote(S.selected); }
  });
  /* Datu mapes ievilkšana no File Explorer. Reģistrēts pēc documents.js / viewer.js — ja tie notikumu
     jau apstrādāja (defaultPrevented), šeit to neaiztiek. Bez datu mapes mapi var ievilkt jebkur logā.
     Citur ievilkts fails netiek atvērts pārlūkā (citādi Chrome aizietu prom no programmas). */
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const rootZone = e => e.target.closest?.('[data-rootdrop]') || (!S.root && !U.qs('dialog[open]') ? U.qs('.hero [data-rootdrop]') || document.body : null);
  let overEl = null;
  const setOver = el => { if (overEl === el) return; overEl?.classList.remove('over'); overEl = el; el?.classList.add('over'); };
  document.addEventListener('dragover', e => {
    if (e.defaultPrevented || !hasFiles(e)) return;
    e.preventDefault();
    const z = rootZone(e);
    e.dataTransfer.dropEffect = z ? 'link' : 'none';
    setOver(z && z !== document.body ? z : null);
  });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) setOver(null); });
  document.addEventListener('drop', e => {
    setOver(null);
    if (e.defaultPrevented || !hasFiles(e)) return;
    e.preventDefault();
    if (!rootZone(e)) { ui.toast('Lai mainītu datu mapi, ievelc to laukā “Datu mape” (Iestatījumos vai sānjoslā pie 📁).', 'warn', 8000); return; }
    const items = [...e.dataTransfer.items].filter(i => i.kind === 'file');
    // getAsFileSystemHandle jāizsauc sinhroni — pēc pirmā await dataTransfer vairs nav pieejams
    const pr = items[0] && items[0].getAsFileSystemHandle ? items[0].getAsFileSystemHandle() : null;
    CP.store.dropRoot(pr, items.length).catch(err => { console.error(err); ui.toast('Mapes pieslēgšanas kļūda: ' + err.message, 'err', 15000); });
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  // Palaišana
  ui.datalists();
  CP.render();
  if (!window.FileSystemHandle) ui.toast('Šis pārlūks neatbalsta darbu ar mapēm. Lieto Google Chrome vai Microsoft Edge.', 'err', 20000);
  else CP.store.tryRestore();

  /* --- Tīmekļa versija: bezsaistes kešs, atjauninājumi, instalēšana, testa kanāls --- */
  if (CP.CHANNEL === 'test') {
    document.title = 'TESTS · ' + document.title;
    const b = document.createElement('div'); b.className = 'testbanner';
    b.textContent = 'TESTA VERSIJA — izmanto tikai testa datu mapi ar izdomātiem datiem';
    document.body.prepend(b);
  }
  if (CP.WEB && 'serviceWorker' in navigator) {
    const swUrl = new URL('sw.js', location.href).href, cur = navigator.serviceWorker.controller;
    const hadController = !!cur && cur.scriptURL === swUrl;   // tikai savs kanāls (stabilais kešs kontrolē arī /test/ pirmajā reizē)
    // Bezsaistes kešs atjaunojas fonā. Lapa jau ielādē jaunāko kodu (tīkls vispirms), tāpēc kešs pats par sevi nav iemesls pārlādēt.
    navigator.serviceWorker.register('sw.js').then(reg => { CP._swReg = reg; }).catch(e => console.warn('Bezsaistes kešs nav pieejams:', e));
    void hadController;
    /* Jauna versija, kamēr lietotājs strādā: salīdzina publicēto version.json ar ielādēto kodu */
    let told = '';
    const check = async () => {
      if (!navigator.onLine) return;
      try {
        const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
        const v = String((await r.json()).version || '');
        if (v && v !== CP.VERSION && v !== told && newer(v, CP.VERSION)) {
          told = v; CP._swReg?.update?.().catch(() => {});
          ui.toast(`Ir pieejama jauna versija ${v}. Kad ērti — saglabā darbu un pārlādē lapu, lai to izmantotu.`, 'ok', 0, { act: 'reloadApp', label: '↻ Pārlādēt' });
        }
      } catch (e) { /* bezsaistē — nekas */ }
    };
    const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
    setTimeout(check, 5 * 60 * 1000);
    setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    CP.checkUpdate = check;
  }
  A.reloadApp = () => { if (S.dirty) CP.store.save(false).then(ok => ok !== false && location.reload()); else location.reload(); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); CP.installPrompt = e; if (S.page === 'settings') CP.render(); });
  A.installApp = async () => { const p = CP.installPrompt; if (!p) return ui.toast('Chrome adreses joslā spied ikonu “Instalēt” (⊕) vai izvēlni ⋮ → “Instalēt lapu kā lietotni”.', 'ok', 10000); p.prompt(); await p.userChoice; CP.installPrompt = null; CP.render(); };
})(window.CP);
