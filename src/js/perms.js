/* =====================================================================
   Iestatījumi → Atļaujas: kuras pārlūka atļaujas rīks izmanto, kāds ir
   to stāvoklis un kas nestrādā bez tām. Atļaut var tieši šeit (pārlūks
   prasa apstiprinājumu); atņemt — pārlūka vietnes iestatījumos.
   Rīks pats nevienu atļauju neslēdz ārā un neko nesūta internetā
   (izņemot Google atvienošanu, kas Google paziņo, ka piekļuve atsaukta).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  let popupOk = null;            // uznirstošo logu pārbaudes rezultāts šajā sesijā
  let last = [];                 // pēdējais aprēķinātais saraksts (cilnes brīdinājumam)

  async function fsPerm(h, mode) {
    if (!h) return 'none';
    try { return h.queryPermission ? await h.queryPermission({ mode }) : 'granted'; } catch (e) { return 'prompt'; }
  }
  /** Visas atļaujas: { k, title, why, state: ok|ask|bad|off, label, btn, act, arg } */
  async function collect() {
    const out = [];
    // 1. Datu mape
    const root = S.root || S.pendingRoot, rp = await fsPerm(root, 'readwrite');
    out.push({ k: 'root', icon: 'folder', title: 'Datu mape — skatīt un rediģēt failus', need: true,
      why: 'Bez tās rīks nevar nolasīt un saglabāt datus, pievienot dokumentus un veidot kopijas mapē.',
      state: !root ? 'bad' : rp === 'granted' ? 'ok' : rp === 'denied' ? 'bad' : 'ask',
      label: !root ? 'Mape nav izvēlēta' : rp === 'granted' ? `Atļauts · ${root.name}` : rp === 'denied' ? 'Aizliegts' : 'Jāapstiprina',
      btn: !root ? '📁 Izvēlēties mapi' : rp === 'granted' ? '' : '🔓 Atļaut', act: !root ? 'pickRoot' : 'permRoot' });
    // 2. Papildu dokumentu mapes
    for (const r of S.roots.filter(x => x.id !== 'main')) {
      const h = r.handle || r.pending, pp = await fsPerm(h, 'read');
      out.push({ k: 'src:' + r.id, icon: 'files', title: `Papildu dokumentu mape “${r.name}” — skatīt failus`, need: true,
        why: 'Bez tās šīs mapes dokumentus nevar atvērt un pārbaudīt (saites kartiņās paliek).',
        state: pp === 'granted' && r.ok ? 'ok' : pp === 'denied' ? 'bad' : 'ask', label: pp === 'granted' && r.ok ? 'Atļauts' : pp === 'denied' ? 'Aizliegts' : 'Jāapstiprina',
        btn: pp === 'granted' && r.ok ? '' : '🔓 Atļaut', act: 'reconnectSource', arg: r.id });
    }
    // 3. Šifrētās kopijas mape datorā
    const bd = CP.encBackup?.localDir?.();
    if (bd) {
      const bp = await fsPerm(bd, 'readwrite');
      out.push({ k: 'enc', icon: 'shield', title: `Šifrētās kopijas mape “${bd.name}” — rediģēt failus`, need: true,
        why: 'Bez tās šifrētā rezerves kopija netiek papildināta.',
        state: bp === 'granted' ? 'ok' : bp === 'denied' ? 'bad' : 'ask', label: bp === 'granted' ? 'Atļauts' : bp === 'denied' ? 'Aizliegts' : 'Jāapstiprina',
        btn: bp === 'granted' ? '' : '🔓 Atļaut', act: 'permEnc' });
    }
    // 4. Google konts
    const G = CP.google, needs = G?.needed?.() || [], scopes = [...new Set(needs.map(n => n.scope))];
    const conn = G?.valid?.(), missing = needs.filter(n => !G.has(n.scope));
    out.push({ k: 'google', icon: 'external', title: 'Google konts (Drive kopija, kalendārs)', need: needs.length > 0,
      why: needs.length ? `Vajadzīgs: ${esc([...new Set(needs.map(n => n.what))].join(', '))}. Bez tā tas netiek sūtīts uz tavu Google.` : 'Šobrīd nav vajadzīgs — nav ieslēgta kopija Google Drive vai kalendāra sinhronizācija.',
      state: !needs.length ? (conn ? 'ok' : 'off') : missing.length ? 'ask' : 'ok',
      label: conn ? `Pieslēgts līdz ${new Date(G.expiresAt()).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' })}` : (needs.length ? 'Nav pieslēgts' : 'Nav pieslēgts (nav vajadzīgs)'),
      btn: missing.length ? 'Pieslēgties' : '', act: 'gConnect', btn2: conn ? 'Atvienot' : '', act2: 'permGoogleOff', scopes });
    // 5. Uznirstošie logi
    out.push({ k: 'popup', icon: 'layout', title: 'Uznirstošie logi', need: needs.length > 0,
      why: 'Vajadzīgi Google pieteikšanās logam. Ja tie bloķēti, pieslēgties Google nevar.',
      state: popupOk === null ? 'off' : popupOk ? 'ok' : 'bad', label: popupOk === null ? 'Nav pārbaudīts' : popupOk ? 'Atļauti' : 'Bloķēti',
      btn: 'Pārbaudīt', act: 'permPopup' });
    // 6. Darbs bezsaistē (bibliotēkas un veidnes pārlūka kešā)
    const off = CP.offline?.state?.();
    if (off && off.ready !== null) out.push({ k: 'offline', icon: 'download', title: 'Darbs bezsaistē (bibliotēkas un veidnes kešā)', need: false,
      why: 'Bez tā bez interneta var nestrādāt Word skatīšana, PDF veidlapas, līgumi un anketu nolasīšana. Personu dati kešā nenonāk.',
      state: off.ready ? 'ok' : off.running ? 'ask' : 'off', label: off.ready ? 'Gatavs' : off.running ? `Sagatavo ${off.done}/${off.total}` : `Nav pilnībā (${off.done}/${off.total || '?'})`,
      btn: off.ready || off.running ? '' : 'Sagatavot', act: 'netPrepare' });
    // 7. Paziņojumi
    const np = 'Notification' in window ? Notification.permission : 'unsupported';
    out.push({ k: 'notif', icon: 'bell', title: 'Paziņojumi uz darbvirsmas', need: false,
      why: 'Atgādinājumi par grafika notikumiem, kad rīks nav priekšplānā. Bez tiem atgādinājumi redzami tikai rīkā.',
      state: np === 'granted' ? 'ok' : np === 'denied' ? 'bad' : np === 'unsupported' ? 'off' : 'off',
      label: np === 'granted' ? 'Atļauti' : np === 'denied' ? 'Bloķēti' : np === 'unsupported' ? 'Pārlūks neatbalsta' : 'Nav jautāts',
      btn: np === 'default' ? '🔔 Atļaut' : '', act: 'permNotif' });
    last = out; return out;
  }
  const PILL = { ok: 'ok', ask: 'warn', bad: 'bad', off: '' };
  const problems = list => list.filter(x => x.need && (x.state === 'bad' || x.state === 'ask'));
  const settingsAddr = () => 'chrome://settings/content/siteDetails?site=' + encodeURIComponent(location.origin);

  function card() {
    return `<section class="card" id="permsCard"><h3>${CP.ic('shield')}Pārlūka atļaujas</h3>
      <p class="small muted" style="margin-top:0">Šeit redzams, kādas atļaujas rīks izmanto un kas nestrādās bez tām. <b>Atļaut</b> var ar pogu — Chrome parādīs savu jautājumu. Stāvoklis atjaunojas, atgriežoties šajā logā.</p>
      <div id="permsList"><p class="muted small">Pārbauda atļaujas…</p></div></section>
      <section class="card"><h3>${CP.ic('lock')}Kā atņemt vai atjaunot bloķētu atļauju</h3>
      <ol class="small perm-how">
        <li>Adreses joslā pa kreisi no adreses noklikšķini uz ikonas <b>⚙ / 🔒</b> (“Skatīt vietnes informāciju”).</li>
        <li>Tur var ieslēgt vai izslēgt atļaujas (Faili, Paziņojumi, Uznirstošie logi). Pilns saraksts — <b>“Vietnes iestatījumi”</b>.</li>
        <li>Vai atver šo adresi jaunā cilnē: <code class="perm-addr">${esc(settingsAddr())}</code> <button type="button" class="sm" data-act="permCopy">📋 Kopēt</button></li>
        <li>Pēc izmaiņām atgriezies šeit — stāvoklis atjaunosies. Ja atņem datu mapes atļauju, nākamreiz atverot rīks lūgs to atkal atļaut.</li>
      </ol>
      <p class="small muted">Google piekļuvi var atsaukt arī Google kontā: myaccount.google.com → Drošība → Trešo pušu lietotnes un pakalpojumi.</p></section>`;
  }
  async function paint() {
    const box = U.$('permsList'); if (!box) return;
    const list = await collect();
    box.innerHTML = list.map(x => `<div class="row perm-row" data-perm="${esc(x.k)}"><div class="perm-ic">${CP.ic(x.icon)}</div>
      <div class="grow"><b>${esc(x.title)}</b>${x.need ? '' : ' <span class="muted small">· nav obligāta</span>'}<div class="small muted">${x.why}</div></div>
      <span class="pill ${PILL[x.state]}">${esc(x.label)}</span>
      ${x.btn ? `<button type="button" class="sm ${x.state === 'bad' || x.state === 'ask' ? 'mainbtn' : ''}" data-act="${x.act}" ${x.arg ? `data-arg="${esc(x.arg)}"` : ''}>${x.btn}</button>` : ''}
      ${x.btn2 ? `<button type="button" class="sm ghost" data-act="${x.act2}">${x.btn2}</button>` : ''}
      ${x.state === 'bad' && x.k !== 'root' ? `<span class="small warn perm-blocked">Bloķēts pārlūkā — atļauj, kā aprakstīts zemāk</span>` : ''}</div>`).join('');
    tabBadge(list);
  }
  function tabBadge(list) {
    const n = problems(list).length, b = document.querySelector('.set-tabs [data-arg="perm"]'); if (!b) return;
    let m = b.querySelector('.tab-warn'); if (!n) { m?.remove(); return; }
    if (!m) { m = document.createElement('span'); m.className = 'tab-warn'; b.appendChild(m); }
    m.textContent = ' ⚠' + n; m.title = `${n} vajadzīgas atļaujas nav dotas`;
  }
  const repaint = () => { if (S.page === 'settings') paint(); };

  A.permRoot = async () => {
    if (S.pendingRoot && !S.root) return CP.store.restoreRoot()?.then(repaint);
    try { await S.root.requestPermission({ mode: 'readwrite' }); } catch (e) { ui.toast('Atļauju neizdevās pieprasīt: ' + e.message, 'err', 9000); }
    repaint();
  };
  A.permEnc = async () => {
    const h = CP.encBackup?.localDir?.(); if (!h) return;
    try { const r = await h.requestPermission({ mode: 'readwrite' }); if (r === 'granted') { ui.toast('Kopijas mapei piekļuve atļauta', 'ok'); CP.encBackup.run?.(); } } catch (e) { ui.toast(e.message, 'err'); }
    repaint();
  };
  A.permNotif = async () => {
    if (!('Notification' in window)) return;
    const r = await Notification.requestPermission();
    ui.toast(r === 'granted' ? 'Paziņojumi atļauti' : 'Paziņojumi netika atļauti', r === 'granted' ? 'ok' : 'warn');
    repaint();
  };
  A.permPopup = () => {
    let w = null; try { w = window.open('about:blank', 'cp-popup-test', 'width=120,height=80'); } catch (e) { w = null; }
    popupOk = !!w; try { w?.close(); } catch (e) { }
    ui.toast(popupOk ? 'Uznirstošie logi ir atļauti' : 'Uznirstošie logi ir bloķēti. Adreses joslas labajā pusē spied uz bloķētā loga ikonas → “Vienmēr atļaut”.', popupOk ? 'ok' : 'warn', popupOk ? 3000 : 12000);
    repaint();
  };
  A.permGoogleOff = async () => {
    const G = CP.google; if (!G?.valid()) return repaint();
    if (!confirm('Atvienot Google kontu šajā pārlūkā? Kamēr nepieslēgsies no jauna, kopija netiks sūtīta uz Google Drive un kalendārs netiks sinhronizēts. Dati netiek dzēsti.')) return;
    const t = G.token_();
    try { if (t) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'token=' + encodeURIComponent(t) }); } catch (e) { /* tīkla kļūda — vietējo pieslēgumu tik un tā aizmirst */ }
    G.forget(); ui.toast('Google konts atvienots', 'ok'); repaint();
  };
  A.permCopy = async () => {
    try { await navigator.clipboard.writeText(settingsAddr()); ui.toast('Adrese nokopēta — ielīmē to jaunā cilnē', 'ok'); }
    catch (e) { ui.toast('Nokopē adresi ar peli: ' + settingsAddr(), 'warn', 12000); }
  };
  // stāvoklis mainās pārlūka iestatījumos — pārzīmē, atgriežoties rīkā
  window.addEventListener('focus', repaint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) repaint(); });
  try { navigator.permissions?.query({ name: 'notifications' }).then(st => { st.onchange = repaint; }); } catch (e) { }
  const oldAfter = CP.pages.settings.after;
  CP.pages.settings.after = async (...a) => { paint(); return oldAfter?.(...a); };

  CP.perms = { card, paint, collect, problems: () => problems(last) };
})(window.CP);
