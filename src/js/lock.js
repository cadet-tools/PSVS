/* =====================================================================
   Ekrāna bloķēšana: pulkstenis + PIN kods.
   • Pēc N min bez darbības (noklusēti 5) ekrānu aizsedz liels pulkstenis — dati nav redzami.
   • Ja iestatīts PIN: to prasa, izejot no pulksteņa un atverot rīku. Bez PIN pulkstenis aizveras ar klikšķi.
   • PIN glabājas tikai šajā pārlūkā kā PBKDF2-SHA-256 jaucējvērtība (nekad kā teksts). 5 kļūdas → pauze, kas pieaug.
   • Aizmirsts PIN: 6 ciparu kods uz iepriekš apstiprinātu e-pastu (caur izstrādātāja Google Apps Script),
     vai — ja e-pasta nav — rīka atiestatīšana šajā datorā (no jauna jāizvēlas datu mape).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const KEY = 'cp.lock', ITER = 150000;
  const te = new TextEncoder();
  const hex = u => [...new Uint8Array(u)].map(x => x.toString(16).padStart(2, '0')).join('');
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const get = () => { try { return Object.assign({ mins: 5 }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { mins: 5 }; } };
  const put = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { } };
  let C = get();
  const hasPin = () => !!(C.hash && C.salt);
  async function hashPin(pin, saltHex, iter = ITER) {
    const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
    const k = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, k, 256));
  }
  async function setPin(pin) { const salt = hex(rnd(16)); C.salt = salt; C.iter = ITER; C.hash = await hashPin(pin, salt); C.fails = 0; C.until = 0; put(C); }
  const sha6 = async code => hex(await crypto.subtle.digest('SHA-256', te.encode('cp-pin|' + code)));
  const maskMail = m => String(m || '').replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '•'.repeat(Math.min(6, Math.max(2, b.length))) + c);
  const pinOk = p => /^\d{4,8}$/.test(p);

  /* ---------- Pulksteņa ekrāns ---------- */
  let locked = false, dlg = null, mode = 'clock', tick = 0;
  const DF = new Intl.DateTimeFormat('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' });
  function build() {
    dlg = document.createElement('dialog'); dlg.id = 'cpLock'; dlg.className = 'cplock'; dlg.setAttribute('aria-label', 'Ekrāns bloķēts');
    dlg.innerHTML = `<div class="cpl-in"><div class="cpl-time" id="cplTime"></div><div class="cpl-date" id="cplDate"></div>
      <div class="cpl-box" id="cplBox"></div><div class="cpl-brand">CADET PERSONĀLS · ekrāns bloķēts</div></div>`;
    dlg.addEventListener('cancel', e => e.preventDefault());
    dlg.addEventListener('keydown', e => { if (mode === 'clock') { e.preventDefault(); wake(); } });
    dlg.addEventListener('pointerdown', e => { if (mode === 'clock') { e.preventDefault(); wake(); } });
    for (const ev of ['keydown', 'keyup', 'keypress', 'paste']) dlg.addEventListener(ev, e => e.stopPropagation());   // rīka īsinājumtaustiņi nedarbojas zem bloķējuma
    document.body.appendChild(dlg);
  }
  function clock() { const d = new Date(), t = U.$('cplTime'), dd = U.$('cplDate'); if (t) t.textContent = d.toTimeString().slice(0, 5); if (dd) dd.textContent = DF.format(d); }
  function box(html) { const b = U.$('cplBox'); if (b) b.innerHTML = html; }
  const clockHint = () => `<p class="cpl-hint">${hasPin() ? 'Nospied jebkuru taustiņu, lai ievadītu PIN' : 'Nospied jebkuru taustiņu vai klikšķini, lai turpinātu'}</p>`;
  function lock(reason = 'idle') {
    if (!dlg) build();
    document.body.classList.add('cp-locked');
    mode = reason === 'open' && hasPin() ? 'pin' : 'clock';
    dlg.classList.toggle('pin', mode === 'pin');
    if (mode === 'pin') pinView(); else box(clockHint());
    clock(); clearInterval(tick); tick = setInterval(clock, 5000);
    if (!locked) { locked = true; raise(); }
    if (mode === 'pin') setTimeout(() => U.$('cplPin')?.focus(), 30);
  }
  function raise() { try { if (dlg.open) dlg.close(); dlg.showModal(); } catch (e) { } }
  function wake() { if (!hasPin()) return unlock(); mode = 'pin'; dlg.classList.add('pin'); pinView(); setTimeout(() => U.$('cplPin')?.focus(), 30); }
  function unlock() {
    locked = false; clearInterval(tick); document.body.classList.remove('cp-locked');
    try { dlg.close(); } catch (e) { } last = Date.now();
  }
  // citi modālie logi, kas atveras bloķējuma laikā, paliek ZEM pulksteņa
  { const sm = HTMLDialogElement.prototype.showModal; HTMLDialogElement.prototype.showModal = function () { const r = sm.apply(this, arguments); if (locked && this !== dlg && dlg) raise(); return r; }; }

  /* ---------- PIN ievade ---------- */
  const waitLeft = () => Math.max(0, (C.until || 0) - Date.now());
  function pinView(msg = '') {
    const w = waitLeft();
    box(`<form class="cpl-form" id="cplForm" autocomplete="off"><label for="cplPin">PIN kods</label>
      <input id="cplPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" ${w ? 'disabled' : ''} aria-describedby="cplMsg">
      <button type="submit" class="mainbtn" ${w ? 'disabled' : ''}>Atbloķēt</button>
      <p class="cpl-msg" id="cplMsg" role="alert">${w ? `Pārāk daudz nepareizu mēģinājumu. Mēģini pēc ${Math.ceil(w / 1000)} s.` : esc(msg)}</p>
      <button type="button" class="ghost sm" id="cplForgot">Aizmirsi PIN?</button></form>`);
    const f = U.$('cplForm');
    f.onsubmit = async e => {
      e.preventDefault(); const i = U.$('cplPin'), v = i.value; if (!v) return;
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      const ok = (await hashPin(v, C.salt, C.iter || ITER)) === C.hash;
      C = get();
      if (ok) { C.fails = 0; C.until = 0; put(C); return unlock(); }
      C.fails = (C.fails || 0) + 1;
      if (C.fails >= 5) { C.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (C.fails - 5)) * 1000; }
      put(C); pinView('Nepareizs PIN'); dlg.querySelector('.cpl-box').classList.add('shake'); setTimeout(() => dlg.querySelector('.cpl-box')?.classList.remove('shake'), 400);
      setTimeout(() => U.$('cplPin')?.focus(), 30);
    };
    U.$('cplForgot').onclick = () => forgotView();
    if (w) setTimeout(() => { if (locked && mode === 'pin' && U.$('cplPin')?.disabled) pinView(); }, Math.min(w, 1000) + 50);
  }

  /* ---------- Aizmirsts PIN ---------- */
  let pending = null;   // { h: sha(kods), exp }
  async function sendCode(to, purpose) {
    const url = CP.FEEDBACK_URL; if (!url) throw Error('e-pasta sūtīšana šajā versijā nav pieejama');
    if (!navigator.onLine) throw Error('nav interneta');
    C = get(); const now = Date.now(); C.sent = (C.sent || []).filter(t => now - t < 3600000);
    if (C.sent.length >= 4) throw Error('kodu var sūtīt ne vairāk kā 4 reizes stundā');
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    const r = await fetch(url, { method: 'POST', body: JSON.stringify({ k: 'cadet-pin-v1', to, code, purpose, version: CP.VERSION }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw Error(j.error === 'nepareizs formāts' ? 'e-pasta saņēmējs vēl nav atjaunināts (izstrādātājam jāatjauno Apps Script)' : (j.error || 'serveris atbildēja ' + r.status));
    C.sent.push(now); put(C);
    pending = { h: await sha6(code), exp: now + 15 * 60000, to };
  }
  async function checkCode(v) { return pending && Date.now() < pending.exp && (await sha6(String(v).replace(/\D/g, ''))) === pending.h; }
  function forgotView() {
    if (!C.email) return box(`<div class="cpl-form"><p><b>Atkopšanas e-pasts nav iestatīts.</b></p>
      <p class="small">Var atiestatīt bloķēšanu šajā datorā: PIN tiek noņemts, un datu mape būs jāizvēlas no jauna (tas pierāda, ka tev ir piekļuve datiem). Dati netiek dzēsti.</p>
      <button type="button" class="mainbtn" id="cplReset">Atiestatīt un izvēlēties datu mapi</button><button type="button" class="ghost sm" id="cplBack">← Atpakaļ</button></div>`, wireReset());
    box(`<form class="cpl-form" id="cplForm2"><p>Sūtīsim 6 ciparu kodu uz <b>${esc(maskMail(C.email))}</b>.</p>
      <button type="button" class="mainbtn" id="cplSend">✉ Sūtīt kodu</button>
      <div id="cplCodeRow" hidden><label for="cplCode">Kods no e-pasta</label><input id="cplCode" inputmode="numeric" maxlength="7" autocomplete="one-time-code">
        <button type="submit" class="mainbtn">Turpināt</button></div>
      <p class="cpl-msg" id="cplMsg" role="alert"></p>
      <button type="button" class="ghost sm" id="cplBack">← Atpakaļ</button>
      <button type="button" class="ghost sm" id="cplNoMail">Nav piekļuves e-pastam?</button></form>`);
    const msg = t => { const m = U.$('cplMsg'); if (m) m.textContent = t; };
    U.$('cplBack').onclick = () => pinView();
    U.$('cplNoMail').onclick = () => { const e = C.email; C.email = ''; forgotView(); C.email = e; };
    U.$('cplSend').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Sūta…'; msg('');
      try { await sendCode(C.email, 'reset'); U.$('cplCodeRow').hidden = false; b.textContent = '✉ Sūtīt vēlreiz'; msg('Kods nosūtīts. Tas derīgs 15 minūtes. Ja nav vēstules, pārbaudi mapi “Mēstules”.'); U.$('cplCode').focus(); }
      catch (e) { b.textContent = '✉ Sūtīt kodu'; msg('Neizdevās nosūtīt: ' + e.message); }
      finally { b.disabled = false; }
    };
    U.$('cplForm2').onsubmit = async e => {
      e.preventDefault();
      if (!(await checkCode(U.$('cplCode').value))) return msg('Nepareizs vai novecojis kods');
      pending = null; newPinView();
    };
  }
  function wireReset() {
    setTimeout(() => {
      U.$('cplBack') && (U.$('cplBack').onclick = () => pinView());
      U.$('cplReset') && (U.$('cplReset').onclick = async () => {
        if (!confirm('Noņemt PIN un no jauna izvēlēties datu mapi?')) return;
        C = { mins: C.mins }; put(C);
        try { await CP.store.idbSet('root', null); } catch (e) { }
        location.reload();
      });
    }, 0);
  }
  function newPinView() {
    box(`<form class="cpl-form" id="cplForm3"><p><b>Izvēlies jaunu PIN</b> (4–8 cipari)</p>
      <input id="cplN1" type="password" inputmode="numeric" maxlength="8" placeholder="Jaunais PIN" autocomplete="off">
      <input id="cplN2" type="password" inputmode="numeric" maxlength="8" placeholder="Vēlreiz" autocomplete="off">
      <button type="submit" class="mainbtn">Saglabāt un atbloķēt</button><p class="cpl-msg" id="cplMsg" role="alert"></p></form>`);
    U.$('cplN1').focus();
    U.$('cplForm3').onsubmit = async e => {
      e.preventDefault(); const a = U.$('cplN1').value, b = U.$('cplN2').value, m = U.$('cplMsg');
      if (!pinOk(a)) return m.textContent = 'PIN: 4–8 cipari';
      if (a !== b) return m.textContent = 'PIN nesakrīt';
      await setPin(a); unlock(); ui.toast('🔒 Jaunais PIN saglabāts', 'ok');
    };
  }

  /* ---------- Neaktivitāte ---------- */
  let last = Date.now(), hiddenAt = 0;
  const bump = () => { if (!locked) last = Date.now(); };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'input']) document.addEventListener(ev, bump, { capture: true, passive: true });
  const idleMs = () => (C.mins > 0 ? C.mins * 60000 : 0);
  setInterval(() => { if (!locked && idleMs() && Date.now() - last > idleMs()) lock('idle'); }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (!locked && idleMs() && hiddenAt && Date.now() - Math.max(hiddenAt, last) > idleMs()) lock('idle');
  });
  // Ctrl+Shift+L — bloķēt uzreiz
  document.addEventListener('keydown', e => { if (!locked && e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); lock('now'); } });
  // atverot rīku
  if (hasPin()) lock('open');

  /* ---------- Iestatījumi ---------- */
  const MINS = [[1, '1 min'], [2, '2 min'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [0, 'nekad']];
  function card() {
    C = get();
    return `<section class="card" id="lockCard"><h3>${CP.ic('lock', '🔒')}Ekrāna bloķēšana</h3>
      <p class="small" style="margin-top:0">Ja rīku kādu laiku nelieto, ekrānu aizsedz liels pulkstenis, un jaunsargu dati nav redzami. Ar PIN kodu rīku var atbloķēt tikai tu: to prasa, izejot no pulksteņa un atverot rīku.</p>
      <div class="fieldgrid"><div class="field"><label for="lockMins">Pulkstenis pēc neaktivitātes</label><select id="lockMins">${MINS.map(([v, l]) => `<option value="${v}" ${+C.mins === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label>PIN kods</label><div class="lock-st">${hasPin() ? '<span class="okc">✓ iestatīts</span>' : '<span class="warn">nav iestatīts</span>'}</div></div></div>
      ${ui.dl([['Atkopšanas e-pasts', C.email ? esc(C.email) + ' <span class="okc small">✓ apstiprināts</span>' : '<span class="muted">nav — aizmirstot PIN, datu mape būs jāizvēlas no jauna</span>', 1]])}
      <div class="actions" style="margin-top:10px">${hasPin()
        ? `<button data-act="lockPinSet">Mainīt PIN</button><button data-act="lockMail">${C.email ? 'Mainīt e-pastu' : 'Pievienot atkopšanas e-pastu'}</button><button class="ghost danger" data-act="lockPinOff">Noņemt PIN</button>`
        : `<button class="mainbtn" data-act="lockPinSet">🔒 Iestatīt PIN</button>`}
        <span class="grow"></span><button class="ghost" data-act="lockNow" title="Ctrl+Shift+L">Bloķēt tagad</button></div>
      <p class="small muted">PIN glabājas tikai šajā datorā un pārlūkā šifrētā veidā (to nevar nolasīt). Bloķēt uzreiz: <b>Ctrl+Shift+L</b>.</p></section>`;
  }
  const paint = () => { const el = U.$('lockCard'); if (el) el.outerHTML = card(); };
  document.addEventListener('change', e => { if (e.target.id === 'lockMins') { C = get(); C.mins = +e.target.value; put(C); last = Date.now(); ui.toast(C.mins ? `Pulkstenis pēc ${C.mins} min neaktivitātes` : 'Pulkstenis automātiski neparādīsies', 'ok', 3000); } });
  function modal(id, html) { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  async function verifyCurrent(f) {
    if (!hasPin()) return true;
    const v = f.cur?.value || '';
    if ((await hashPin(v, C.salt, C.iter || ITER)) !== C.hash) { ui.toast('Pašreizējais PIN nav pareizs', 'err'); return false; }
    return true;
  }
  A.lockPinSet = () => {
    C = get(); const had = hasPin();
    const d = modal('lockDlg', `<form><header class="dlg-head"><h2>${had ? 'Mainīt PIN' : 'Iestatīt PIN kodu'}</h2><button type="button" class="ghost" data-close="lockDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        ${had ? '<div class="field wide"><label>Pašreizējais PIN</label><input type="password" name="cur" inputmode="numeric" maxlength="8" autocomplete="off" required></div>' : ''}
        <div class="field"><label>Jaunais PIN (4–8 cipari)</label><input type="password" name="p1" inputmode="numeric" maxlength="8" autocomplete="off" required></div>
        <div class="field"><label>Vēlreiz</label><input type="password" name="p2" inputmode="numeric" maxlength="8" autocomplete="off" required></div>
        ${had ? '' : `<div class="field wide"><label>Atkopšanas e-pasts <span class="muted small">(ieteicams)</span></label><input type="email" name="mail" autocomplete="email" placeholder="tavs@epasts.lv"><small class="muted">Ja aizmirsīsi PIN, uz šo adresi tiks sūtīts kods. Adrese tiks apstiprināta ar kodu.</small></div>`}
      </div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="lockDlg">Atcelt</button><button class="mainbtn" type="submit">${had ? 'Saglabāt' : 'Tālāk →'}</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (!pinOk(f.p1.value)) return ui.toast('PIN: 4–8 cipari', 'warn');
      if (f.p1.value !== f.p2.value) return ui.toast('PIN nesakrīt', 'warn');
      if (!(await verifyCurrent(f))) return;
      const mail = (f.mail?.value || '').trim();
      if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return ui.toast('Nepareiza e-pasta adrese', 'warn');
      await setPin(f.p1.value); d.close(); paint();
      ui.toast(had ? '🔒 PIN nomainīts' : '🔒 PIN iestatīts. Tas tiks prasīts, atverot rīku un izejot no pulksteņa.', 'ok', 7000);
      if (mail) A.lockMail(mail);
    };
  };
  A.lockMail = preset => {
    C = get(); const v = typeof preset === 'string' ? preset : '';
    const d = modal('lockDlg', `<form><header class="dlg-head"><h2>Atkopšanas e-pasts</h2><button type="button" class="ghost" data-close="lockDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>E-pasta adrese</label><div class="inline-form" style="margin:0"><input type="email" name="mail" value="${esc(v || C.email || '')}" autocomplete="email" style="flex:1"><button type="button" id="lockMailSend">✉ Sūtīt kodu</button></div></div>
        <div class="field" id="lockCodeRow" hidden><label>Kods no e-pasta</label><input name="code" inputmode="numeric" maxlength="7" autocomplete="one-time-code"></div>
        <p class="small muted">Uz adresi tiks nosūtīts 6 ciparu kods, lai pārliecinātos, ka adrese ir pareiza. Vēstule tiek sūtīta caur rīka izstrādātāja Google kontu.</p></div>
      <footer class="dlg-foot">${C.email ? '<button type="button" class="ghost danger" id="lockMailDel">Noņemt e-pastu</button>' : ''}<span class="grow"></span><button type="button" data-close="lockDlg">Atcelt</button><button class="mainbtn" type="submit">Apstiprināt</button></footer></form>`);
    const f = d.querySelector('form');
    U.$('lockMailSend').onclick = async ev => {
      const m = f.mail.value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return ui.toast('Nepareiza e-pasta adrese', 'warn');
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Sūta…';
      try { await sendCode(m, 'verify'); U.$('lockCodeRow').hidden = false; f.code.focus(); ui.toast('Kods nosūtīts uz ' + m, 'ok', 6000); }
      catch (x) { ui.toast('Neizdevās nosūtīt: ' + x.message, 'err', 10000); }
      finally { b.disabled = false; b.textContent = '✉ Sūtīt vēlreiz'; }
    };
    if (U.$('lockMailDel')) U.$('lockMailDel').onclick = () => { if (!confirm('Noņemt atkopšanas e-pastu?')) return; C = get(); C.email = ''; put(C); d.close(); paint(); };
    f.onsubmit = async e => {
      e.preventDefault();
      if (!pending || pending.to !== f.mail.value.trim()) return ui.toast('Vispirms spied “Sūtīt kodu”', 'warn');
      if (!(await checkCode(f.code.value))) return ui.toast('Nepareizs vai novecojis kods', 'err');
      C = get(); C.email = pending.to; put(C); pending = null; d.close(); paint(); ui.toast('✓ Atkopšanas e-pasts apstiprināts', 'ok');
    };
    if (v) setTimeout(() => U.$('lockMailSend').click(), 50);
  };
  A.lockPinOff = () => {
    const d = modal('lockDlg', `<form><header class="dlg-head"><h2>Noņemt PIN</h2><button type="button" class="ghost" data-close="lockDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="field"><label>Pašreizējais PIN</label><input type="password" name="cur" inputmode="numeric" maxlength="8" autocomplete="off" required></div>
        <p class="small muted">Pulkstenis turpinās aizsegt ekrānu, bet atvērsies ar klikšķi.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="lockDlg">Atcelt</button><button class="mainbtn danger" type="submit">Noņemt PIN</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => { e.preventDefault(); if (!(await verifyCurrent(e.target))) return; C = get(); delete C.hash; delete C.salt; delete C.iter; put(C); d.close(); paint(); ui.toast('PIN noņemts', 'ok'); };
  };
  A.lockNow = () => lock('now');
  CP.lock = { card, lock, unlock, isLocked: () => locked, hasPin };
})(window.CP);
