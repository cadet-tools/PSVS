/* =====================================================================
   Šifrētā rezerves kopija (piem., Google Drive datorā sinhronizētā mapē).
   • Kopijā ir VISS datu mapes saturs (datu fails, dokumenti, veidlapas, veidnes) + ārējo mapju dokumenti.
     Darba mapes faili netiek mainīti — šifrēta ir tikai kopija.
   • Visi faili šifrēti ar vienu nejaušu galveno atslēgu (AES-GCM 256). Galvenā atslēga “ietīta” divreiz:
     ar paroli un ar atkopšanas kodu (PBKDF2-SHA-256, 600 000 iterācijas). Jebkurš no tiem atver kopiju.
   • Paroles mājiens glabājas atklāti (nedrīkst saturēt paroli). Savā datorā paroli var nomainīt bez vecās.
   • Papildu kopijas: tikai jaunie / mainītie faili. Kopijas mapē ir ATJAUNOT.html — atšifrē arī bez rīka.
   Kopijas struktūra:  CADET_rezerve/KOPIJA.json  +  CADET_rezerve/dati/<id>.bin  +  CADET_rezerve/ATJAUNOT.html
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, store = CP.store;
  const ic = (n, f = '') => CP.ic(n, f);
  const FORMAT = 'cadet-rezerve', DIRNAME = 'CADET_rezerve', ITER = 600000;
  const SKIP = n => /^(_arhivi|_rezerves|\..*|~\$.*|desktop\.ini|thumbs\.db)$/i.test(n) || /\.crswap$/i.test(n);
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u => { u = new Uint8Array(u); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const hex = u => [...u].map(x => x.toString(16).padStart(2, '0')).join('');

  /* --- Kriptogrāfija --- */
  const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const newRecovery = () => { const b = rnd(25); return [...b].map(x => CROCK[x & 31]).join('').match(/.{5}/g).join('-'); };
  const normRecovery = s => String(s || '').toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0').replace(/[^0-9A-Z]/g, '');
  async function kek(secret, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  }
  async function wrap(master, secret) {
    const salt = rnd(16), iv = rnd(12), k = await kek(secret, salt);
    return { salt: b64(salt), iv: b64(iv), iter: ITER, key: b64(await crypto.subtle.wrapKey('raw', master, k, { name: 'AES-GCM', iv })) };
  }
  async function unwrap(w, secret) {
    const k = await kek(secret, unb64(w.salt), w.iter || ITER);
    return crypto.subtle.unwrapKey('raw', unb64(w.key), k, { name: 'AES-GCM', iv: unb64(w.iv) }, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  async function encBytes(master, bytes) { const iv = rnd(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, bytes)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
  async function decBytes(master, buf) { const u = new Uint8Array(buf); return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, master, u.subarray(12))); }
  const encJson = async (m, o) => b64(await encBytes(m, te.encode(JSON.stringify(o))));
  const decJson = async (m, s) => JSON.parse(td.decode(await decBytes(m, unb64(s))));
  const sha = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

  /* --- Iestatījumi pārlūkā (IndexedDB): mapes rokturis, galvenā atslēga, pēdējās kopijas stāvoklis --- */
  const cfgGet = () => store.idbGet('encbak').catch(() => null);
  const cfgSet = v => store.idbSet('encbak', v);
  let CFG = null, running = false, status = '';
  (async () => { CFG = await cfgGet(); paint(); })();

  /* --- Failu sistēma --- */
  async function sub(dir, name, create) { return dir.getDirectoryHandle(name, { create }); }
  async function readText(dir, name) { try { return await (await (await dir.getFileHandle(name)).getFile()).text(); } catch (e) { return null; } }
  async function writeBytes(dir, name, data) { const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); await w.write(data); await w.close(); return fh; }
  async function* walk(dir, pre = '', dirs = null) {
    for await (const [n, h] of dir.entries()) {
      if (SKIP(n)) continue;
      if (h.kind === 'directory') { dirs?.push(pre + n); yield* walk(h, pre + n + '/', dirs); } else yield [pre + n, h];
    }
  }
  async function perm(h, mode = 'readwrite', ask = false) {
    try { if ((await h.queryPermission({ mode })) === 'granted') return true; if (ask) return (await h.requestPermission({ mode })) === 'granted'; } catch (e) { }
    return false;
  }
  async function backupDirOf(h) {   // izvēlēta mape: pati CADET_rezerve vai tās vecākmape
    if (await readText(h, 'KOPIJA.json')) return h;
    try { const d = await h.getDirectoryHandle(DIRNAME); if (await readText(d, 'KOPIJA.json')) return d; } catch (e) { }
    return null;
  }

  /* --- Kopijas izveide / papildināšana --- */
  async function run({ ask = false, quiet = false } = {}) {
    if (running) return; if (!S.root) return;
    CFG = CFG || await cfgGet(); if (!CFG?.dir || !CFG?.master) return;
    if (!(await perm(CFG.dir, 'readwrite', ask))) { status = 'perm'; paint(); if (!quiet) ui.toast('Rezerves kopijas mapei vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”.', 'warn', 9000); return; }
    running = true; status = 'run'; paint();
    const t0 = Date.now(); let added = 0, kept = 0, removed = 0, bytes = 0, ext = 0, failed = [];
    try {
      if (S.dirty && !S.conflict) await store.save(true);
      const bdir = await sub(CFG.dir, DIRNAME, true), ddir = await sub(bdir, 'dati', true);
      const head = JSON.parse(await readText(bdir, 'KOPIJA.json') || 'null');
      if (!head || head.set !== CFG.set) throw Error('kopijas mapē ir citas kopijas fails — iestati kopiju no jauna');
      const idx = head.index ? await decJson(CFG.master, head.index) : { files: {} };
      const seen = new Set(), put = async (key, fh, meta = {}) => {
        seen.add(key);
        const f = await fh.getFile(), old = idx.files[key];
        if (old && old.size === f.size && old.lm === f.lastModified) { kept++; return; }
        const data = new Uint8Array(await f.arrayBuffer()), id = old?.id || hex(rnd(12));
        await writeBytes(ddir, id + '.bin', await encBytes(CFG.master, data));
        idx.files[key] = { id, size: f.size, lm: f.lastModified, sha: await sha(data), ...meta }; added++; bytes += f.size;
        if ((added + kept) % 20 === 0) { status = `run:${added + kept}`; paint(); await new Promise(r => setTimeout(r, 0)); }
      };
      // 1) visa datu mape
      const dirs = [];
      for await (const [rel, fh] of walk(S.root, '', dirs)) { try { await put('main/' + rel, fh); } catch (e) { failed.push(rel); } }
      idx.dirs = dirs;
      // 2) dokumenti no ārējām (papildu) mapēm — ja tās pieslēgtas
      for (const d of S.db.documents || []) {
        const sid = d.sourceId || 'main'; if (sid === 'main' || !d.path || String(sid).startsWith('fails:')) continue;
        const h = await store.handleFor(d.path, sid); if (!h) { failed.push(`(ārējā mape) ${d.path}`); continue; }
        const src = (S.db.sources || []).find(s => s.id === sid);
        try { await put(`ext/${sid}/${d.path}`, h, { src: src?.name || sid }); ext++; } catch (e) { failed.push(d.path); }
      }
      // 3) dzēstie faili → noņem no kopijas
      for (const [k, v] of Object.entries(idx.files)) if (!seen.has(k)) { try { await ddir.removeEntry(v.id + '.bin'); } catch (e) { } delete idx.files[k]; removed++; }
      head.index = await encJson(CFG.master, idx); head.updated = U.now(); head.version = CP.VERSION;
      head.stats = { files: Object.keys(idx.files).length, bytes: Object.values(idx.files).reduce((a, f) => a + f.size, 0) };
      head.root = S.rootName;
      await writeBytes(bdir, 'KOPIJA.json', JSON.stringify(head, null, 1));
      if ((await readText(bdir, 'ATJAUNOT.html')) !== RESTORE_HTML) await writeBytes(bdir, 'ATJAUNOT.html', RESTORE_HTML);
      CFG.last = { at: U.now(), rev: S.db.revision, files: head.stats.files, bytes: head.stats.bytes, added, removed, failed: failed.length, ms: Date.now() - t0 };
      await cfgSet(CFG); status = failed.length ? 'partial' : 'ok';
      if (!quiet || failed.length) ui.toast(failed.length ? `Rezerves kopija izveidota, bet ${failed.length} faili netika iekļauti (piem., ${failed[0]})` : `🔐 Rezerves kopija atjaunināta: ${faili(head.stats.files)} (${added} jauni/mainīti${removed ? `, ${removed} noņemti` : ''})`, failed.length ? 'warn' : 'ok', 7000);
    } catch (e) { console.error(e); status = 'err'; CFG.lastErr = { at: U.now(), msg: e.message }; await cfgSet(CFG); ui.toast('Rezerves kopiju neizdevās izveidot: ' + e.message, 'err', 12000); }
    finally { running = false; paint(); }
  }
  // automātiski: ik 10 min pārbauda; ja datos ir izmaiņas un kopija vecāka par 30 min
  setInterval(() => { if (CFG?.last && S.root && !running && S.db && S.db.revision !== CFG.last.rev && Date.now() - new Date(CFG.last.at) > 30 * 60000) run({ quiet: true }); }, 10 * 60000);
  CP.afterRootLoad = (CP.afterRootLoad || []); CP.afterRootLoad.push(() => setTimeout(async () => { CFG = await cfgGet(); if (CFG?.last && S.db.revision !== CFG.last.rev && Date.now() - new Date(CFG.last.at) > 6 * 3600000) run({ quiet: true }); }, 8000));

  /* --- Iestatījumu kartīte --- */
  const faili = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'fails' : 'faili'}`;
  const fmtB = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';
  function card() {
    const c = CFG, L = c?.last;
    const st = running ? `<span class="spin"></span> Veido kopiju…${status.startsWith('run:') ? ` ${status.slice(4)} faili` : ''}`
      : status === 'perm' ? '<span class="warn">Kopijas mapei vajag atļauju — spied “Izveidot kopiju tagad”.</span>'
      : L ? `<span class="${L.failed ? 'warn' : 'okc'}">✓ Pēdējā kopija: ${esc(U.fmtDateTime(L.at))} · ${faili(L.files)} · ${fmtB(L.bytes)}${L.failed ? ` · ${L.failed} nav iekļauti` : ''}</span>` : '<span class="muted">Kopija vēl nav izveidota.</span>';
    return `<section class="card" id="encCard"><h3>${ic('shield', '🔐')}Šifrētā rezerves kopija</h3>
      <p class="small" style="margin-top:0">Viss datu mapes saturs (personas, dokumenti, veidlapas) šifrētā veidā citā mapē, piem., <b>Google Drive</b> mapē datorā. Darba mapes faili netiek mainīti. Pazaudējot datoru, visu var atjaunot ar paroli vai atkopšanas kodu.</p>
      ${c?.dir ? `${ui.dl([['Kopijas mape', `${esc(c.dir.name)} / ${DIRNAME}`, 1], ['Stāvoklis', st, 1], ['Paroles mājiens', c.hint ? esc(c.hint) : '<span class="muted">nav</span>', 1]])}
        <div class="actions" style="margin-top:10px"><button class="mainbtn" data-act="encRun" ${running ? 'disabled' : ''}>↻ Izveidot kopiju tagad</button><button data-act="encPw">Mainīt paroli</button><button data-act="encNewCode">Jauns atkopšanas kods</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button><button class="ghost danger" data-act="encOff">Atslēgt</button></div>
        <p class="small muted">Kopija tiek papildināta automātiski, kamēr rīks ir atvērts: tikai jaunie un mainītie faili. Google Drive tos sinhronizē pats.</p>`
      : `<div class="actions"><button class="mainbtn" data-act="encSetup">🔐 Iestatīt šifrēto kopiju</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button></div>`}</section>`;
  }
  const paint = () => { const el = U.$('encCard'); if (el) el.outerHTML = card(); };
  CP.encBackup = { card, run, paint };
  // brīdinājums pārskatā: kopija sen nav atjaunota vai gaida atļauju
  { const orig = D.alerts; D.alerts = () => { const out = orig(); if (CFG?.dir && S.root) { const age = CFG.last ? (Date.now() - new Date(CFG.last.at)) / 864e5 : 99; if (status === 'perm' || age > 7) out.push({ kind: 'backup', sev: 1, when: CFG.last?.at?.slice(0, 10) || '', msg: status === 'perm' ? 'Šifrētajai rezerves kopijai vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”' : `Šifrētā rezerves kopija nav atjaunota ${CFG.last ? Math.floor(age) + ' dienas' : 'ne reizi'} — Iestatījumos spied “Izveidot kopiju tagad”` }); } return out; }; }

  /* --- Iestatīšana --- */
  function dlg(id, html, cls = '') { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.className = cls; d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  const pwOk = (pw, hint) => pw.length < 8 ? 'Parolei jābūt vismaz 8 zīmes garai' : hint && U.norm(hint).includes(U.norm(pw)) ? 'Mājiens nedrīkst saturēt pašu paroli' : '';
  let setupDir = null;
  A.encSetup = () => {
    if (!S.root) return CP.needRoot?.();
    setupDir = null;
    const d = dlg('encDialog', `<form><header class="dlg-head"><h2>🔐 Šifrētās rezerves kopijas iestatīšana</h2><button type="button" class="ghost" data-close="encDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <div class="field"><label>1. Mape kopijai</label><div class="inline-form" style="margin:0"><button type="button" data-act="encPickDir">📁 Izvēlēties mapi</button><span id="encDirName" class="muted small">piem., Google Drive → “Mans disks” → CADET</span></div>
          <small class="muted">Izvēlies mapi Google Drive (vai citā diskā / zibatmiņā), <b>nevis</b> pašā datu mapē. Rīks tajā izveidos apakšmapi ${DIRNAME}.</small></div>
        <div class="fieldgrid"><div class="field"><label>2. Parole (vismaz 8 zīmes)</label><input type="password" name="pw" autocomplete="new-password" required></div>
          <div class="field"><label>Parole vēlreiz</label><input type="password" name="pw2" autocomplete="new-password" required></div>
          <div class="field wide"><label>Paroles mājiens (nav obligāts, redzams visiem, kam ir kopijas fails)</label><input name="hint" placeholder="piem., pirmā suņa vārds + gads" autocomplete="off"></div></div>
        <p class="small muted">Nākamajā solī rīks parādīs <b>atkopšanas kodu</b> — ar to kopiju var atvērt arī tad, ja aizmirsti paroli.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encDialog">Atcelt</button><button class="mainbtn" type="submit">Tālāk →</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      if (!setupDir) return ui.toast('Izvēlies mapi kopijai', 'warn');
      if (f.pw.value !== f.pw2.value) return ui.toast('Paroles nesakrīt', 'warn');
      const bad = pwOk(f.pw.value, f.hint.value.trim()); if (bad) return ui.toast(bad, 'warn');
      const existing = await backupDirOf(setupDir);
      if (existing && !confirm('Šajā mapē jau ir CADET rezerves kopija. Izveidot jaunu? Vecā kopija šajā mapē tiks aizstāta.')) return;
      try {
        const master = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']), code = newRecovery();
        const head = { format: FORMAT, v: 1, set: hex(rnd(8)), created: U.now(), updated: '', root: S.rootName, hint: f.hint.value.trim(), wraps: { pw: await wrap(master, f.pw.value), rc: await wrap(master, normRecovery(code)) }, index: '' };
        showCode(code, async () => {
          let bdir = await sub(setupDir, DIRNAME, true);
          if (existing) {
            for await (const [n] of bdir.entries()) if (n === 'dati') { try { await bdir.removeEntry('dati', { recursive: true }); } catch (x) { } }
          }
          await writeBytes(bdir, 'KOPIJA.json', JSON.stringify(head, null, 1));
          CFG = { dir: setupDir, master, set: head.set, hint: head.hint, created: head.created };
          await cfgSet(CFG); U.$('encDialog').close(); paint(); run({ ask: true });
        });
      } catch (x) { console.error(x); ui.toast('Neizdevās: ' + x.message, 'err'); }
    };
  };
  A.encPickDir = async () => {
    try {
      const h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'readwrite' });
      if (S.root && await S.root.resolve(h) !== null) return ui.toast('Šī mape ir datu mapē. Izvēlies citu vietu, piem., Google Drive mapi.', 'warn', 8000);
      if (S.root && await h.resolve(S.root) !== null) return ui.toast('Datu mape atrodas šajā mapē. Izvēlies atsevišķu mapi kopijai.', 'warn', 8000);
      setupDir = h; const el = U.$('encDirName'); if (el) { el.textContent = '✓ ' + h.name; el.className = 'okc small'; }
    } catch (e) { if (e.name !== 'AbortError') ui.toast('Mapi neizdevās izvēlēties: ' + e.message, 'err'); }
  };
  function codeSheet(code) {
    return `<div style="font:14px/1.5 Arial;padding:24mm;color:#000"><h1 style="font-size:20px">CADET PERSONĀLS — rezerves kopijas atkopšanas kods</h1>
      <p>Datu mape: <b>${esc(S.rootName || '')}</b> · Izveidots: ${esc(U.fmtDate(U.iso()))}</p>
      <p style="font:700 24px/1.6 monospace;letter-spacing:2px;border:2px solid #000;padding:12px 16px;display:inline-block">${esc(code)}</p>
      <p>Ar šo kodu var atvērt šifrēto rezerves kopiju, ja aizmirsta parole. Glabā drošā vietā (piem., aizslēgtā atvilktnē), atsevišķi no datora. Nefotografē un nesūti to.</p>
      <p>Atjaunošana: rīkā “Atjaunot no šifrētās kopijas” vai kopijas mapē atver failu ATJAUNOT.html.</p></div>`;
  }
  function showCode(code, onDone) {
    const d = dlg('encCodeDialog', `<form><header class="dlg-head"><h2>Atkopšanas kods</h2></header>
      <div class="dlg-body"><p style="margin-top:0">Ar šo kodu kopiju var atvērt, <b>ja aizmirsti paroli</b>. Tas tiek parādīts <b>tikai tagad</b>.</p>
        <div class="enc-code">${esc(code)}</div>
        <div class="actions"><button type="button" data-act="copy" data-arg="${esc(code)}">⧉ Kopēt</button><button type="button" id="encPrint">🖨 Izdrukāt / saglabāt PDF</button></div>
        <p class="small muted">Izdrukā vai pieraksti un glabā drošā vietā atsevišķi no datora. Nesūti to e-pastā un neliec Google Drive.</p>
        <label class="check" style="margin-top:10px"><input type="checkbox" name="ok"> Esmu kodu saglabājis drošā vietā</label></div>
      <footer class="dlg-foot"><span class="grow"></span><button class="mainbtn" type="submit" disabled>Pabeigt un izveidot kopiju</button></footer></form>`);
    const f = d.querySelector('form');
    f.ok.onchange = () => { f.querySelector('[type=submit]').disabled = !f.ok.checked; };
    d.addEventListener('cancel', e => e.preventDefault());
    U.$('encPrint').onclick = () => { const n = document.createElement('div'); n.innerHTML = codeSheet(code); CP.setPrintSource({ kind: 'html', node: n }); d.close(); A.printGo(); setTimeout(() => { if (!d.open) d.showModal(); }, 800); };
    f.onsubmit = async e => { e.preventDefault(); d.close(); await onDone(); };
  }
  async function editHead(fn) {
    CFG = CFG || await cfgGet(); if (!(await perm(CFG.dir, 'readwrite', true))) return ui.toast('Kopijas mapei nav atļaujas', 'warn');
    const bdir = await sub(CFG.dir, DIRNAME, false), head = JSON.parse(await readText(bdir, 'KOPIJA.json'));
    await fn(head); await writeBytes(bdir, 'KOPIJA.json', JSON.stringify(head, null, 1)); await cfgSet(CFG); paint();
  }
  A.encPw = () => {
    const d = dlg('encPwDialog', `<form><header class="dlg-head"><h2>Mainīt paroli</h2><button type="button" class="ghost" data-close="encPwDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Šajā datorā vecā parole nav vajadzīga. Atkopšanas kods paliek tas pats.</p><div class="fieldgrid">
        <div class="field"><label>Jaunā parole</label><input type="password" name="pw" autocomplete="new-password" required></div><div class="field"><label>Vēlreiz</label><input type="password" name="pw2" autocomplete="new-password" required></div>
        <div class="field wide"><label>Paroles mājiens (nav obligāts)</label><input name="hint" value="${esc(CFG?.hint || '')}" autocomplete="off"></div></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encPwDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`);
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target; if (f.pw.value !== f.pw2.value) return ui.toast('Paroles nesakrīt', 'warn');
      const bad = pwOk(f.pw.value, f.hint.value.trim()); if (bad) return ui.toast(bad, 'warn');
      try { await editHead(async h => { h.wraps.pw = await wrap(CFG.master, f.pw.value); h.hint = f.hint.value.trim(); CFG.hint = h.hint; }); d.close(); ui.toast('Parole nomainīta', 'ok'); } catch (x) { ui.toast('Neizdevās: ' + x.message, 'err'); }
    };
  };
  A.encNewCode = () => {
    if (!confirm('Izveidot jaunu atkopšanas kodu? Vecais kods vairs nederēs.')) return;
    const code = newRecovery();
    showCode(code, async () => { try { await editHead(async h => { h.wraps.rc = await wrap(CFG.master, normRecovery(code)); }); ui.toast('Jaunais atkopšanas kods saglabāts', 'ok'); } catch (x) { ui.toast('Neizdevās: ' + x.message, 'err'); } });
  };
  A.encRun = () => run({ ask: true });
  A.encOff = async () => { if (!confirm('Atslēgt šifrēto rezerves kopiju šajā datorā? Jau izveidotā kopija mapē paliek un to var atjaunot ar paroli vai atkopšanas kodu.')) return; CFG = null; await store.idbSet('encbak', null); paint(); };

  /* --- Atjaunošana (arī bez datu mapes — no sākuma lapas) --- */
  let R = null;
  A.encRestore = async () => {
    let h; try { h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'read' }); } catch (e) { return; }
    const bdir = await backupDirOf(h); if (!bdir) return ui.toast(`Šajā mapē nav CADET rezerves kopijas (meklē mapi ${DIRNAME} ar failu KOPIJA.json)`, 'warn', 9000);
    const head = JSON.parse(await readText(bdir, 'KOPIJA.json'));
    if (head.format !== FORMAT) return ui.toast('Neatpazīts kopijas formāts', 'err');
    R = { bdir, head, master: null };
    const d = dlg('encResDialog', `<form><header class="dlg-head"><h2>Atjaunot no šifrētās kopijas</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${ui.dl([['Datu mape kopijā', esc(head.root || '—'), 1], ['Pēdējā kopija', esc(U.fmtDateTime(head.updated || head.created)), 1], ['Faili', `${head.stats?.files ?? '—'}${head.stats ? ' · ' + fmtB(head.stats.bytes) : ''}`, 1]])}
        <div class="choice-list"><label class="choice"><input type="radio" name="how" value="pw" checked><div class="grow"><b>Parole</b>${head.hint ? `<div class="small muted">Mājiens: ${esc(head.hint)}</div>` : ''}<input type="password" name="pw" autocomplete="current-password" style="margin-top:8px"></div></label>
          <label class="choice"><input type="radio" name="how" value="rc"><div class="grow"><b>Aizmirsi paroli? Atkopšanas kods</b><input name="rc" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off" spellcheck="false" style="margin-top:8px;font-family:monospace"></div></label></div>
        <p class="small muted">Nākamajā solī izvēlies <b>tukšu mapi</b>, kur atjaunot. Esošie faili netiek pārrakstīti.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button><button class="mainbtn" type="submit">Pārbaudīt un izvēlēties mapi →</button></footer></form>`);
    const f = d.querySelector('form');
    f.pw.addEventListener('focus', () => { f.how.value = 'pw'; }); f.rc.addEventListener('focus', () => { f.how.value = 'rc'; });
    f.onsubmit = async e => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Pārbauda…';
      try { R.master = f.how.value === 'rc' ? await unwrap(head.wraps.rc, normRecovery(f.rc.value)) : await unwrap(head.wraps.pw, f.pw.value); }
      catch (x) { btn.disabled = false; btn.textContent = 'Pārbaudīt un izvēlēties mapi →'; return ui.toast(f.how.value === 'rc' ? 'Nepareizs atkopšanas kods' : 'Nepareiza parole', 'err', 6000); }
      btn.disabled = false; btn.textContent = '📁 Izvēlēties mapi, kur atjaunot'; btn.dataset.ready = '1';
      f.onsubmit = ev => { ev.preventDefault(); A.encRestoreTo(); };
      ui.toast('✓ Kopija atvērta. Tagad izvēlies tukšu mapi, kur atjaunot.', 'ok', 6000);
    };
  };
  A.encRestoreTo = async () => {
    let t; try { t = await showDirectoryPicker({ id: 'cadet-restore', mode: 'readwrite' }); } catch (e) { return; }
    for await (const [n] of t.entries()) if (!SKIP(n)) { return ui.toast('Izvēlētā mape nav tukša. Izveido jaunu, tukšu mapi un izvēlies to.', 'warn', 9000); }
    const d = U.$('encResDialog'), body = d.querySelector('.dlg-body'), foot = d.querySelector('.dlg-foot');
    foot.innerHTML = ''; body.innerHTML = '<p><span class="spin"></span> Atjauno… <b id="encResN">0</b> faili</p>';
    try {
      const n = await restoreInto(R.bdir, R.head, R.master, t, k => { const el = U.$('encResN'); if (el) el.textContent = k; });
      body.innerHTML = `<p class="okc"><b>✓ Atjaunoti ${n.ok} faili</b>${n.bad ? ` · <span class="red">${n.bad} ar kļūdu</span>` : ''}. Visi pārbaudīti ar kontrolsummu.</p><p>Mape “${esc(t.name)}” tagad tiks pieslēgta kā datu mape.</p>`;
      foot.innerHTML = '<span class="grow"></span><button class="mainbtn" data-close="encResDialog">Gatavs</button>';
      await store.connectRoot(t, 'atjaunots no šifrētās kopijas');
    } catch (x) { console.error(x); body.innerHTML = `<p class="red">Atjaunošana neizdevās: ${esc(x.message)}</p>`; foot.innerHTML = '<span class="grow"></span><button data-close="encResDialog">Aizvērt</button>'; }
  };
  /** Kopijas atšifrēšana mapē. Ārējo mapju dokumenti → _atjaunoti_no_arejam_mapem/<mape>/…, datu failā sasaiste pārlikta uz pamatmapi. */
  async function restoreInto(bdir, head, master, target, onProg) {
    const idx = await decJson(master, head.index), ddir = await bdir.getDirectoryHandle('dati');
    let ok = 0, bad = 0; const moved = {};
    for (const d of idx.dirs || []) { let dir = target; for (const p of d.split('/')) dir = await dir.getDirectoryHandle(p, { create: true }); }
    for (const [key, v] of Object.entries(idx.files)) {
      try {
        const data = await decBytes(master, await (await (await ddir.getFileHandle(v.id + '.bin')).getFile()).arrayBuffer());
        if (await sha(data) !== v.sha) throw Error('kontrolsumma nesakrīt');
        let rel = key.replace(/^main\//, '');
        if (key.startsWith('ext/')) { const [, sid, ...p] = key.split('/'); rel = `_atjaunoti_no_arejam_mapem/${String(v.src || sid).replace(/[\\/:*?"<>|]/g, '_')}/${p.join('/')}`; moved[sid + '|' + p.join('/')] = rel; }
        const parts = rel.split('/'); let dir = target; for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
        await writeBytes(dir, parts.at(-1), data);
        ok++; if (ok % 10 === 0) { onProg?.(ok); await new Promise(r => setTimeout(r, 0)); }
      } catch (e) { console.error(key, e); bad++; }
    }
    // datu fails: ārējo dokumentu sasaiste uz atjaunotajām kopijām pamatmapē
    if (Object.keys(moved).length) {
      const v = idx.files['main/' + CP.DATAFILE];
      if (v) {
        const db = JSON.parse(td.decode(await decBytes(master, await (await (await ddir.getFileHandle(v.id + '.bin')).getFile()).arrayBuffer())));
        for (const d of db.documents || []) { const m = moved[(d.sourceId || 'main') + '|' + d.path]; if (m) { d.sourceId = 'main'; d.path = m; } }
        await writeBytes(target, CP.DATAFILE, JSON.stringify(db, null, 2));
      }
    }
    onProg?.(ok);
    return { ok, bad };
  }
  CP.encBackup.restoreInto = restoreInto;

  /* --- Atjaunošanas lapa bez rīka (ATJAUNOT.html kopijas mapē) --- */
  const RESTORE_HTML = `<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CADET rezerves kopijas atjaunošana</title>
<style>body{font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;background:#0f1418;color:#e8eef2}h1{font-size:22px}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #3a5668;background:#1f3a4d;color:#fff;cursor:pointer}input{font:inherit;padding:8px;border-radius:8px;border:1px solid #3a5668;background:#0b1219;color:#fff;width:100%;box-sizing:border-box}.box{border:1px solid #2b3f4c;border-radius:12px;padding:14px 16px;margin:12px 0}.muted{color:#9fb3c3}.ok{color:#7fe0aa}.err{color:#f08a8a}</style></head><body>
<h1>CADET PERSONĀLS — šifrētās rezerves kopijas atjaunošana</h1>
<p class="muted">Šī lapa atšifrē kopiju arī bez rīka. Darbojas Chrome vai Edge pārlūkā. Nekas netiek sūtīts internetā.</p>
<div class="box"><b>1.</b> <button id="b1">Izvēlēties kopijas mapi (${DIRNAME})</button> <span id="s1" class="muted"></span></div>
<div class="box"><b>2.</b> Parole <span id="hint" class="muted"></span><input type="password" id="pw"><p class="muted">… vai atkopšanas kods (ja aizmirsi paroli):</p><input id="rc" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"></div>
<div class="box"><b>3.</b> <button id="b3">Izvēlēties tukšu mapi un atjaunot</button> <p id="s3"></p></div>
<script>
(function(){var te=new TextEncoder(),td=new TextDecoder(),bdir=null,head=null;
function unb64(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0)})}
function hex(u){return Array.prototype.map.call(u,function(x){return x.toString(16).padStart(2,'0')}).join('')}
async function kek(s,salt,it){var b=await crypto.subtle.importKey('raw',te.encode(s),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:it,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['unwrapKey'])}
async function unwrap(w,s){var k=await kek(s,unb64(w.salt),w.iter);return crypto.subtle.unwrapKey('raw',unb64(w.key),k,{name:'AES-GCM',iv:unb64(w.iv)},{name:'AES-GCM'},false,['decrypt'])}
async function dec(m,buf){var u=new Uint8Array(buf);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},m,u.subarray(12)))}
function norm(s){return String(s||'').toUpperCase().replace(/[IL]/g,'1').replace(/O/g,'0').replace(/[^0-9A-Z]/g,'')}
async function txt(d,n){try{return await (await (await d.getFileHandle(n)).getFile()).text()}catch(e){return null}}
document.getElementById('b1').onclick=async function(){try{var h=await showDirectoryPicker();var t=await txt(h,'KOPIJA.json');if(!t){try{h=await h.getDirectoryHandle('${DIRNAME}');t=await txt(h,'KOPIJA.json')}catch(e){}}if(!t)throw Error('mapē nav KOPIJA.json');bdir=h;head=JSON.parse(t);document.getElementById('s1').innerHTML='<span class=ok>✓ '+(head.root||'')+' · '+(head.stats?head.stats.files+' faili':'')+'</span>';if(head.hint)document.getElementById('hint').textContent='(mājiens: '+head.hint+')'}catch(e){document.getElementById('s1').innerHTML='<span class=err>'+e.message+'</span>'}};
document.getElementById('b3').onclick=async function(){var s=document.getElementById('s3');try{if(!head)throw Error('vispirms izvēlies kopijas mapi');var pw=document.getElementById('pw').value,rc=document.getElementById('rc').value,m;
try{m=rc?await unwrap(head.wraps.rc,norm(rc)):await unwrap(head.wraps.pw,pw)}catch(e){throw Error(rc?'nepareizs atkopšanas kods':'nepareiza parole')}
var out=await showDirectoryPicker({mode:'readwrite'});for await(var e of out.entries()){throw Error('izvēlētā mape nav tukša')}
var idx=JSON.parse(td.decode(await dec(m,unb64(head.index)))),dd=await bdir.getDirectoryHandle('dati'),ok=0,bad=0,moved={};
for(var di=0;di<(idx.dirs||[]).length;di++){var dp=idx.dirs[di].split('/'),dh=out;for(var j=0;j<dp.length;j++)dh=await dh.getDirectoryHandle(dp[j],{create:true})}
for(var key in idx.files){var v=idx.files[key];try{var data=await dec(m,await (await (await dd.getFileHandle(v.id+'.bin')).getFile()).arrayBuffer());var h=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));if(h!==v.sha)throw Error('kontrolsumma');
var rel=key.indexOf('main/')===0?key.slice(5):'_atjaunoti_no_arejam_mapem/'+String(v.src||key.split('/')[1]).replace(/[\\\\/:*?"<>|]/g,'_')+'/'+key.split('/').slice(2).join('/');if(key.indexOf('ext/')===0)moved[key.split('/')[1]+'|'+key.split('/').slice(2).join('/')]=rel;var p=rel.split('/'),d=out;for(var i=0;i<p.length-1;i++)d=await d.getDirectoryHandle(p[i],{create:true});
var fh=await d.getFileHandle(p[p.length-1],{create:true}),w=await fh.createWritable();await w.write(data);await w.close();ok++;s.textContent='Atjaunoti '+ok+' faili…'}catch(x){bad++}}
if(Object.keys(moved).length){try{var dfh=await out.getFileHandle('CADET_PERSONALS_DATI.json'),db=JSON.parse(await (await dfh.getFile()).text());(db.documents||[]).forEach(function(d){var k=(d.sourceId||'main')+'|'+d.path;if(moved[k]){d.sourceId='main';d.path=moved[k]}});var ww=await dfh.createWritable();await ww.write(JSON.stringify(db,null,2));await ww.close()}catch(x){}}
s.innerHTML='<span class=ok>✓ Atjaunoti '+ok+' faili'+(bad?'</span> <span class=err>('+bad+' ar kļūdu)':'')+'</span>. Atver rīku un izvēlies šo mapi kā datu mapi.'}catch(e){s.innerHTML='<span class=err>'+e.message+'</span>'}};})();
</script></body></html>`;
  CP.encBackup.RESTORE_HTML = RESTORE_HTML;
})(window.CP);
