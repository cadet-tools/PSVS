/* =====================================================================
   Šifrētā rezerves kopija — tieši Google Drive (caur Google kontu, bez programmas) vai mapē datorā.
   • Kopijā ir VISS datu mapes saturs (datu fails, dokumenti, veidlapas, veidnes) + ārējo mapju dokumenti.
     Darba mapes faili netiek mainīti — šifrēta ir tikai kopija.
   • Visi faili šifrēti ar vienu nejaušu galveno atslēgu (AES-GCM 256). Galvenā atslēga “ietīta” divreiz:
     ar paroli un ar atkopšanas kodu (PBKDF2-SHA-256, 600 000 iterācijas). Jebkurš no tiem atver kopiju.
   • Paroles mājiens glabājas atklāti (nedrīkst saturēt paroli). Savā datorā paroli var nomainīt bez vecās.
   • Papildu kopijas: tikai jaunie / mainītie faili. Kopijas mapē ir ATJAUNOT.html — atšifrē arī bez rīka.
   Kopijas struktūra (abos gadījumos):  CADET_rezerve/KOPIJA.json  +  CADET_rezerve/dati/<id>.bin  +  CADET_rezerve/ATJAUNOT.html
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


  /* --- Iestatījumi pārlūkā (IndexedDB): glabātuve (mape vai Google Drive), galvenā atslēga, pēdējās kopijas stāvoklis --- */
  const cfgGet = () => store.idbGet('encbak').catch(() => null);
  const cfgSet = v => store.idbSet('encbak', v);
  const G = () => CP.google;
  const isDrive = c => c?.kind === 'drive';
  const enabled = c => !!(c?.master && (c.dir || c.folderId));
  let CFG = null, running = false, status = '';
  /* --- Darbs uz vairākiem datoriem: katram pārlūkam savs ID; KOPIJA.json.writer = kurš pēdējais rakstīja --- */
  const DEV = (() => { try { let d = localStorage.getItem('cp.deviceId'); if (!d) { d = hex(rnd(8)); localStorage.setItem('cp.deviceId', d); } return d; } catch (e) { return 'nezinams'; } })();
  const devName = () => { const p = navigator.userAgentData?.platform || navigator.platform || ''; return /win/i.test(p) ? 'Windows dators' : /mac/i.test(p) ? 'Mac dators' : /linux|cros/i.test(p) ? 'Linux dators' : 'cits dators'; };
  let REMOTE = null, checked = false, remoteHidden = false;   // REMOTE: { at, name, root } — Drive ir jaunāka versija no cita datora
  /** Vai Drive kopiju pēdējo reizi rakstīja cits dators, un šis vēl nav to ielādējis */
  function newerElsewhere(head) {
    const w = head?.writer; if (!w || w.dev === DEV || !head.updated) return null;
    if (CFG?.syncHead && CFG.syncHead === head.updated) return null;
    return { at: head.updated, name: w.name || 'cits dators', root: head.root || '' };
  }
  (async () => { CFG = await cfgGet(); paint(); G()?.paintBanner(); CP.encBackup?.paintSync?.(); })();

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
  /** Paralēli (n vienlaikus); pirmā kļūda aptur pārējos */
  async function pool(items, n, fn) {
    let i = 0, err = null;
    const w = async () => { while (i < items.length && !err) { const it = items[i++]; try { await fn(it); } catch (e) { err = err || e; } } };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, w));
    if (err) throw err;
  }

  /* --- Glabātuves: mape datorā vai Google Drive. Abām viena struktūra: KOPIJA.json, ATJAUNOT.html, dati/<id>.bin --- */
  function localStore(bdir) {
    let ddir = null;
    return {
      kind: 'local', label: bdir.name,
      async open(create = true) { ddir = await sub(bdir, 'dati', create); return this; },
      readTop: n => readText(bdir, n),
      writeTop: (n, t) => writeBytes(bdir, n, t),
      hasTop: async n => (await readText(bdir, n)) !== null,
      async blobIds() { const s = new Set(); for await (const [n] of ddir.entries()) if (/\.bin$/.test(n)) s.add(n.slice(0, -4)); return s; },
      put: (id, bytes) => writeBytes(ddir, id + '.bin', bytes),
      async del(id) { try { await ddir.removeEntry(id + '.bin'); } catch (e) { } },
      async get(id) { return (await (await ddir.getFileHandle(id + '.bin')).getFile()).arrayBuffer(); },
      async wipe() { try { await bdir.removeEntry('dati', { recursive: true }); } catch (e) { } ddir = await sub(bdir, 'dati', true); }
    };
  }
  function driveStore(folderId) {
    const dr = G().drive; let did = '', top = new Map(), blobs = new Map();
    return {
      kind: 'drive', label: 'Google Drive', folderId,
      async open() {
        top = new Map(); blobs = new Map();
        for (const f of await dr.children(folderId)) top.set(f.name, f.id);
        did = top.get('dati') || await dr.mkdir('dati', folderId); top.set('dati', did);
        for (const f of await dr.children(did)) if (/\.bin$/.test(f.name)) blobs.set(f.name.slice(0, -4), f.id);
        return this;
      },
      async readTop(n) { const id = top.get(n); return id ? dr.text(id) : null; },
      async writeTop(n, t) { top.set(n, await dr.put(n, folderId, t, n.endsWith('.html') ? 'text/html' : 'application/json', top.get(n))); },
      hasTop: async n => top.has(n),
      async blobIds() { return new Set(blobs.keys()); },
      async put(id, bytes) { blobs.set(id, await dr.put(id + '.bin', did, bytes, 'application/octet-stream', blobs.get(id))); },
      async del(id) { const g = blobs.get(id); if (g) { await dr.del(g); blobs.delete(id); } },
      async get(id) { const g = blobs.get(id); if (!g) throw Error('fails nav atrasts Google Drive'); return dr.get(g); },
      async wipe() { if (did) await dr.del(did); did = await dr.mkdir('dati', folderId); top.set('dati', did); blobs = new Map(); }
    };
  }
  /** Piekļuve kopijas glabātuvei. ask=true → drīkst atvērt Google logu / prasīt mapes atļauju (tikai pēc klikšķa). */
  async function access(ask) {
    if (isDrive(CFG)) {
      if (!await G().token(['drive'], ask)) { status = 'auth'; paint(); G().paintBanner(); return null; }
      const m = await G().drive.meta(CFG.folderId);
      if (!m || m.trashed) throw Error(`Google Drive mape ${DIRNAME} nav atrasta (izdzēsta vai atkritnē). Atjauno to no Drive atkritnes vai iestati kopiju no jauna`);
      return driveStore(CFG.folderId).open();
    }
    if (!(await perm(CFG.dir, 'readwrite', ask))) { status = 'perm'; paint(); return null; }
    return localStore(await sub(CFG.dir, DIRNAME, true)).open(true);
  }

  /* --- Kopijas izveide / papildināšana --- */
  async function run({ ask = false, quiet = false, force = false } = {}) {
    if (running) return; if (!S.root) return;
    CFG = CFG || await cfgGet(); if (!enabled(CFG)) return;
    running = true; status = 'run'; paint();
    const t0 = Date.now(); let added = 0, kept = 0, removed = 0, bytes = 0, ext = 0, done = 0; const failed = [];
    try {
      const bs = await access(ask);
      if (!bs) { if (!quiet) ui.toast(status === 'auth' ? 'Pieslēdzies Google, lai nosūtītu rezerves kopiju — spied “Pieslēgties” joslā augšā vai “Izveidot kopiju tagad”.' : 'Rezerves kopijas mapei vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”.', 'warn', 9000); return; }
      status = 'run'; paint();
      if (S.dirty && !S.conflict) await store.save(true);
      const head = JSON.parse(await bs.readTop('KOPIJA.json') || 'null');
      if (!head || head.set !== CFG.set) throw Error('kopijas vietā ir citas kopijas fails — iestati kopiju no jauna');
      checked = true;
      const nw = isDrive(CFG) && !force && newerElsewhere(head);
      if (nw) {   // citā datorā jaunāki dati — nepārraksta tos, jautā instruktoram
        REMOTE = nw; CFG.multi = true; await cfgSet(CFG); status = 'newer';
        if (!quiet) ui.toast(`Google Drive ir jaunāki dati no cita datora (${nw.name}, ${U.fmtDateTime(nw.at)}). Kopija netika nosūtīta, lai tos nepārrakstītu — izvēlies joslā augšā.`, 'warn', 12000);
        return;
      }
      if (head.writer && head.writer.dev !== DEV) CFG.multi = true;
      const idx = head.index ? await decJson(CFG.master, head.index) : { files: {} };
      const before = await bs.blobIds();
      // 1) visa datu mape, 2) dokumenti no ārējām (papildu) mapēm — ja tās pieslēgtas
      const jobs = [], dirs = [];
      for await (const [rel, fh] of walk(S.root, '', dirs)) jobs.push(['main/' + rel, fh, {}, rel]);
      idx.dirs = dirs;
      for (const d of S.db.documents || []) {
        const sid = d.sourceId || 'main'; if (sid === 'main' || !d.path || String(sid).startsWith('fails:')) continue;
        const h = await store.handleFor(d.path, sid); if (!h) { failed.push(`(ārējā mape) ${d.path}`); continue; }
        const src = (S.db.sources || []).find(s => s.id === sid);
        jobs.push([`ext/${sid}/${d.path}`, h, { src: src?.name || sid }, d.path]); ext++;
      }
      const seen = new Set();
      await pool(jobs, isDrive(CFG) ? 4 : 1, async ([key, fh, meta, label]) => {
        seen.add(key);
        try {
          const f = await fh.getFile(), old = idx.files[key];
          if (old && old.size === f.size && old.lm === f.lastModified) kept++;
          else {
            // mainīts fails vienmēr iet jaunā blobā; vecais tiek dzēsts tikai pēc tam, kad KOPIJA.json saglabāts → pārtraukta kopija nekad nesabojā iepriekšējo
            const data = new Uint8Array(await f.arrayBuffer()), id = hex(rnd(12));
            await bs.put(id, await encBytes(CFG.master, data));
            idx.files[key] = { id, size: f.size, lm: f.lastModified, sha: await sha(data), ...meta }; added++; bytes += f.size;
          }
        } catch (e) { if (e.auth || e.api) throw e; console.error(key, e); failed.push(label); }
        if (++done % 10 === 0) { status = `run:${done}/${jobs.length}`; paint(); await new Promise(r => setTimeout(r, 0)); }
      });
      // 3) dzēstie faili → noņem no kopijas
      for (const k of Object.keys(idx.files)) if (!seen.has(k)) { delete idx.files[k]; removed++; }
      head.index = await encJson(CFG.master, idx); head.updated = U.now(); head.version = CP.VERSION;
      head.stats = { files: Object.keys(idx.files).length, bytes: Object.values(idx.files).reduce((a, f) => a + f.size, 0) };
      head.root = S.rootName; head.store = isDrive(CFG) ? 'drive' : 'local';
      head.writer = { dev: DEV, name: devName(), at: head.updated };
      await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1));
      CFG.syncHead = head.updated; REMOTE = null;
      const rh = await sha(te.encode(RESTORE_HTML));
      if (CFG.rh !== rh || !(await bs.hasTop('ATJAUNOT.html'))) { await bs.writeTop('ATJAUNOT.html', RESTORE_HTML); CFG.rh = rh; }
      // 4) vecās versijas un pārtraukto kopiju atliekas
      const keep = new Set(Object.values(idx.files).map(f => f.id));
      await pool([...before].filter(id => !keep.has(id)), isDrive(CFG) ? 4 : 1, id => bs.del(id).catch(() => { }));
      CFG.last = { at: U.now(), rev: S.db.revision, files: head.stats.files, bytes: head.stats.bytes, added, removed, failed: failed.length, ms: Date.now() - t0 };
      delete CFG.lastErr; await cfgSet(CFG); status = failed.length ? 'partial' : 'ok';
      if (!quiet || failed.length) ui.toast(failed.length ? `Rezerves kopija izveidota, bet ${failed.length} faili netika iekļauti (piem., ${failed[0]})` : `🔐 Rezerves kopija${isDrive(CFG) ? ' Google Drive' : ''} atjaunināta: ${faili(head.stats.files)} (${added} jauni/mainīti${removed ? `, ${removed} noņemti` : ''})`, failed.length ? 'warn' : 'ok', 7000);
    } catch (e) {
      console.error(e);
      if (e.auth) { status = 'auth'; G().paintBanner(); if (!quiet) ui.toast(e.message, 'warn', 9000); }
      else { status = 'err'; CFG.lastErr = { at: U.now(), msg: e.message }; await cfgSet(CFG); ui.toast('Rezerves kopiju neizdevās izveidot: ' + e.message, 'err', 12000); }
    }
    finally { running = false; paint(); G()?.paintBanner(); paintRemote(); }
  }
  /** Tikai nolasa KOPIJA.json un pārbauda, vai citā datorā nav jaunāku datu (bez sūtīšanas) */
  async function checkRemote(ask = false) {
    if (!isDrive(CFG) || !S.root || running) return null;
    try {
      const bs = await access(ask); if (!bs) return null;
      const head = JSON.parse(await bs.readTop('KOPIJA.json') || 'null'); if (!head || head.set !== CFG.set) return null;
      checked = true; REMOTE = newerElsewhere(head); if (REMOTE) { CFG.multi = true; await cfgSet(CFG); status = 'newer'; } else if (status === 'newer') status = '';
    } catch (e) { console.error(e); }
    paint(); paintRemote(); return REMOTE;
  }
  /** Ielādē datus no Google Drive kopijas šajā datu mapē. Nekas netiek zaudēts: pašreizējais datu fails → _rezerves,
      dokumenti, kas Drive ir jaunāki, aizstāj vietējos (vecie → _rezerves/aizvietoti_…); vietēji jaunākie un tikai šeit esošie paliek. */
  async function pull() {
    if (running || !S.root) return;
    running = true; status = 'pull'; paint(); paintRemote();
    const n = { added: 0, replaced: 0, same: 0, kept: 0, bad: 0 };
    try {
      const bs = await access(true); if (!bs) throw Error('nav Google savienojuma');
      const head = JSON.parse(await bs.readTop('KOPIJA.json') || 'null');
      if (!head || head.set !== CFG.set || !head.index) throw Error('Google Drive kopija nav nolasāma');
      const idx = await decJson(CFG.master, head.index), stamp = U.stamp();
      if (S.dirty && !S.conflict) await store.save(true);
      const rz = await sub(S.root, '_rezerves', true);
      const curText = await readText(S.root, CP.DATAFILE);
      if (curText) await writeBytes(rz, `PIRMS_IELADES_NO_DRIVE_${stamp}.json`, curText);
      const dirOf = async (root, parts, create) => { let d = root; for (const x of parts) d = await d.getDirectoryHandle(x, { create }); return d; };
      for (const d of idx.dirs || []) { try { await dirOf(S.root, d.split('/'), true); } catch (e) { } }
      let dataBytes = null;
      await pool(Object.entries(idx.files).filter(([k]) => k.startsWith('main/')), 4, async ([key, v]) => {
        const rel = key.slice(5), parts = rel.split('/');
        if (parts.some(x => x === '..' || x === '.')) return;
        try {
          const get = async () => { const b = await decBytes(CFG.master, await bs.get(v.id)); if (await sha(b) !== v.sha) throw Error('kontrolsumma nesakrīt'); return b; };
          if (rel === CP.DATAFILE) { dataBytes = await get(); return; }
          const dir = await dirOf(S.root, parts.slice(0, -1), true); let local = null;
          try { local = await (await dir.getFileHandle(parts.at(-1))).getFile(); } catch (e) { if (e.name !== 'NotFoundError') throw e; }
          if (local) {
            if (local.size === v.size && await sha(new Uint8Array(await local.arrayBuffer())) === v.sha) { n.same++; return; }
            if (!(v.lm > local.lastModified)) { n.kept++; return; }   // šeit jaunāks — paliek
            const keep = await dirOf(rz, [`aizvietoti_${stamp}`, ...parts.slice(0, -1)], true);
            await writeBytes(keep, parts.at(-1), await local.arrayBuffer());
            await writeBytes(dir, parts.at(-1), await get()); n.replaced++;
          } else { await writeBytes(dir, parts.at(-1), await get()); n.added++; }
        } catch (e) { if (e.auth) throw e; console.error(key, e); n.bad++; }
      });
      if (!dataBytes) throw Error('kopijā nav datu faila');
      const parsed = JSON.parse(td.decode(dataBytes)); CP.validateDb(parsed);
      const db = CP.migrate(parsed); CP.validateDb(db);
      S.db = db; S.conflict = false; S.conflictNotified = false; S.dirty = true; S.rev = (S.rev || 0) + 1;
      CP.changelog?.rebase();
      if (!await store.save(false)) throw Error('datus neizdevās saglabāt datu mapē (iepriekšējā versija ir mapē _rezerves)');
      CFG.syncHead = head.updated; CFG.multi = true; CFG.last = { ...(CFG.last || {}), at: U.now(), rev: S.db.revision, pulled: true };
      await cfgSet(CFG); REMOTE = null; status = 'ok';
      S.selected = S.db.people.find(D.isCurrent)?.id || '';
      try { await store.scanAll(); } catch (e) { }
      CP.render();
      ui.toast(`⬇ Ielādēti dati no ${head.writer?.name || 'cita datora'} (${U.fmtDateTime(head.updated)}). Dokumenti: ${n.added} jauni, ${n.replaced} atjaunoti${n.kept ? `, ${n.kept} šeit jaunāki — paturēti` : ''}${n.bad ? `, ${n.bad} neizdevās` : ''}. Iepriekšējā versija — mapē _rezerves.`, n.bad ? 'warn' : 'ok', 14000);
    } catch (e) { console.error(e); status = e.auth ? 'auth' : 'err'; ui.toast('Ielāde no Google Drive neizdevās: ' + e.message, 'err', 12000); }
    finally { running = false; paint(); paintRemote(); }
  }
  /* --- Josla augšā: citā datorā jaunāki dati --- */
  function paintRemote() {
    let b = U.$('remoteBar');
    if (!REMOTE || remoteHidden || !S.root) { b?.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'remoteBar'; b.className = 'gbanner'; b.setAttribute('role', 'alert'); ui.topHost?.().appendChild(b); }
    const pend = pending();
    b.innerHTML = `<span>☁ Google Drive ir jaunāki dati no cita datora (${esc(REMOTE.name)}, ${esc(U.fmtDateTime(REMOTE.at))}).${pend ? ' Arī šajā datorā ir izmaiņas, kas nav Drive — ielādējot tās saglabāsies mapē _rezerves.' : ''}</span>
      <button type="button" data-act="encPull" ${running ? 'disabled' : ''}>⬇ Ielādēt</button><button type="button" class="ghost" data-act="encKeepLocal" ${running ? 'disabled' : ''}>Paturēt šī datora datus</button><button type="button" class="gb-x" data-act="encRemoteHide" title="Paslēpt līdz nākamajai atvēršanai" aria-label="Paslēpt">✕</button>`;
  }
  A.encPull = () => { if (confirm(`Ielādēt datus no Google Drive (${REMOTE?.name || 'cits dators'})?\n\nŠī datora pašreizējais datu fails tiks saglabāts mapē _rezerves. Dokumenti netiek dzēsti: jaunāki no Drive aizstāj vecākos (vecie paliek _rezerves), pārējie paliek.`)) pull(); };
  A.encKeepLocal = () => { if (confirm('Paturēt šī datora datus un nosūtīt tos uz Google Drive?\n\nOtrā datora jaunākās izmaiņas Drive kopijā tiks aizstātas (tās paliks tikai tajā datorā).')) { REMOTE = null; paintRemote(); run({ ask: true, force: true }); } };
  A.encRemoteHide = () => { remoteHidden = true; paintRemote(); };
  A.encCheck = () => checkRemote(true).then(r => { if (!r && checked) ui.toast('✓ Google Drive nav jaunāku datu no cita datora', 'ok'); });
  const pending = () => !!(S.db && enabled(CFG) && (!CFG.last || S.db.revision !== CFG.last.rev));
  // automātiski: ik 10 min pārbauda; ja datos ir izmaiņas un kopija vecāka par 30 min
  setInterval(() => { if (CFG?.last && S.root && !running && pending() && Date.now() - new Date(CFG.last.at) > 30 * 60000) run({ quiet: true }); else if (isDrive(CFG) && G()?.has('drive') && !running) checkRemote(); }, 10 * 60000);
  CP.afterRootLoad = (CP.afterRootLoad || []); CP.afterRootLoad.push(() => setTimeout(async () => { CFG = await cfgGet(); checked = false; REMOTE = null; remoteHidden = false; G()?.paintBanner(); paintSync(); if (isDrive(CFG) && G()?.has('drive') && await checkRemote()) return; if (CFG?.last && pending() && Date.now() - new Date(CFG.last.at) > 6 * 3600000) run({ quiet: true }); }, 8000));
  // Google josla: kopija Google Drive, ir nenosūtītas izmaiņas, savienojums beidzies
  G()?.needs.push(() => isDrive(CFG) && S.root && pending() ? { what: 'rezerves kopija', scope: 'drive' } : null);
  // tikko pieslēdzās Google (josla “Pieslēgties”) → nosūta uzreiz
  G()?.onToken(async () => { if (!(isDrive(CFG) && S.root && G().has('drive') && !running)) return; if (await checkRemote()) return; if (pending() || status === 'auth') run({ quiet: false }); });

  /* --- Iestatījumu kartīte --- */
  const faili = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'fails' : 'faili'}`;
  const fmtB = n => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';
  const hhmm = t => new Date(t).toTimeString().slice(0, 5);
  function card() {
    const c = CFG, L = c?.last, drv = isDrive(c);
    const st = running ? `<span class="spin"></span> ${drv ? 'Sūta uz Google Drive' : 'Veido kopiju'}…${status.startsWith('run:') ? ` ${status.slice(4)} faili` : ''}`
      : status === 'perm' ? '<span class="warn">Kopijas mapei vajag atļauju — spied “Izveidot kopiju tagad”.</span>'
      : status === 'auth' ? '<span class="warn">Google savienojums beidzies — spied “Izveidot kopiju tagad” vai “Pieslēgties” joslā augšā.</span>'
      : L ? `<span class="${L.failed ? 'warn' : 'okc'}">✓ Pēdējā kopija: ${esc(U.fmtDateTime(L.at))} · ${faili(L.files)} · ${fmtB(L.bytes)}${L.failed ? ` · ${L.failed} nav iekļauti` : ''}</span>` : '<span class="muted">Kopija vēl nav izveidota.</span>';
    const where = drv ? `☁ Google Drive / ${DIRNAME} <a class="small" href="https://drive.google.com/drive/folders/${encodeURIComponent(c.folderId)}" target="_blank" rel="noopener noreferrer">↗ atvērt</a>` : c?.dir ? `📁 ${esc(c.dir.name)} / ${DIRNAME}` : '';
    const gstate = drv ? (G().has('drive') ? `<span class="okc">✓ pieslēgts līdz ${hhmm(G().expiresAt())}</span>` : '<span class="muted">nav pieslēgts — pieslēgsies, spiežot “Izveidot kopiju tagad”</span>') : '';
    return `<section class="card" id="encCard"><h3>${ic('shield', '🔐')}Šifrētā rezerves kopija</h3>
      <p class="small" style="margin-top:0">Viss datu mapes saturs (personas, dokumenti, veidlapas) šifrētā veidā <b>Google Drive</b> vai citā mapē. Darba mapes faili netiek mainīti. Pazaudējot datoru, visu var atjaunot ar paroli vai atkopšanas kodu.</p>
      ${enabled(c) ? `${ui.dl([['Kopijas vieta', where, 1], ...(drv ? [['Google', gstate, 1]] : []), ['Stāvoklis', st, 1], ['Paroles mājiens', c.hint ? esc(c.hint) : '<span class="muted">nav</span>', 1]])}
        <div class="actions" style="margin-top:10px"><button class="mainbtn" data-act="encRun" ${running ? 'disabled' : ''}>↻ Izveidot kopiju tagad</button><button data-act="encPw">Mainīt paroli</button><button data-act="encNewCode">Jauns atkopšanas kods</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button><button class="ghost danger" data-act="encOff">Atslēgt</button></div>
        <p class="small muted">${drv ? 'Kamēr rīks ir atvērts un esi pieslēdzies Google, kopija tiek papildināta automātiski: tikai jaunie un mainītie faili. Google savienojums ir derīgs apmēram 1 stundu; kad tas beidzas un ir ko sūtīt, augšā parādās josla ar pogu “Pieslēgties”.' : 'Kopija tiek papildināta automātiski, kamēr rīks ir atvērts: tikai jaunie un mainītie faili. Google Drive tos sinhronizē pats.'}</p>`
      : `<div class="actions"><button class="mainbtn" data-act="encSetup">🔐 Iestatīt šifrēto kopiju</button><button class="ghost" data-act="encRestore">Atjaunot no kopijas…</button></div>`}</section>`;
  }
  /* --- Stāvoklis sānjoslā zem datu mapes nosaukuma: vai dati sinhronizēti ar Google Drive --- */
  function syncHtml() {
    if (!S.root) return '';
    const c = CFG, drv = isDrive(c);
    const warn = (msg, btn) => `<span class="sl-warn" title="Šifrētā rezerves kopija Google Drive">⚠ ${msg}</span>${btn}`;
    if (!enabled(c)) return warn('Nav sinhronizēts ar Google Drive', `<button class="sl-btn" data-act="encGoSet">Iestatīt</button>`);
    if (!drv) return `<span class="sl-ok" title="Šifrētā rezerves kopija mapē ${esc(c.dir?.name || '')}">🔐 Kopija mapē${c.last ? ' · ' + hhmmDay(c.last.at) : ''}</span>`;
    if (running) return `<span class="sl-run"><span class="spin"></span> ${status === 'pull' ? 'Ielādē no Google Drive…' : 'Sūta uz Google Drive…'}</span>`;
    if (REMOTE) return warn(`Citā datorā jaunāki dati (${esc(U.fmtDateTime(REMOTE.at))})`, `<button class="sl-btn" data-act="encPull">Ielādēt</button>`);
    if (c.multi && !checked && !G()?.has('drive')) return warn('Nav pārbaudīts, vai otrā datorā nav jaunāku datu', `<button class="sl-btn" data-act="gConnect">Pieslēgties</button>`);
    if (status === 'perm' || status === 'err') return warn('Google Drive: kopija neizdevās', `<button class="sl-btn" data-act="encRun">Mēģināt vēlreiz</button>`);
    if (!c.last) return warn('Google Drive: kopija vēl nav izveidota', `<button class="sl-btn" data-act="encRun">Sinhronizēt</button>`);
    if ((pending() || status === 'auth') && !G()?.has('drive')) return warn('Nav sinhronizēts ar Google Drive — savienojums beidzies', `<button class="sl-btn" data-act="gConnect">Pieslēgties</button>`);
    if (pending()) return `<span class="sl-ok" title="Jaunās izmaiņas tiek nosūtītas automātiski ik pēc 30 min; var nosūtīt arī tagad">☁ Google Drive · ${hhmmDay(c.last.at)} · izmaiņas gaida nosūtīšanu</span><button class="sl-btn ghost" data-act="encRun" title="Nosūtīt tagad">⟳</button>`;
    return `<span class="sl-ok" title="Šifrētā rezerves kopija Google Drive ir aktuāla">☁ Google Drive · sinhronizēts ${hhmmDay(c.last.at)}</span>`;
  }
  const hhmmDay = t => { const d = new Date(t); return U.iso(d) === U.iso() ? hhmm(t) : U.fmtDate(U.iso(d)); };
  const paintSync = () => { const el = U.$('syncLine'); if (!el) return; const h = syncHtml(); if (el.innerHTML !== h) el.innerHTML = h; el.hidden = !h; };
  setInterval(paintSync, 60000);
  G()?.onToken(() => setTimeout(paintSync, 50));
  A.encGoSet = () => CP.ui.goSettingsCard('encCard');
  const paint = () => { const el = U.$('encCard'); if (el) el.outerHTML = card(); paintSync(); };
  CP.encBackup = { card, run, paint, paintSync, checkRemote, pull, state: () => ({ enabled: enabled(CFG), drive: isDrive(CFG), last: CFG?.last || null, remote: REMOTE, multi: !!CFG?.multi, device: DEV }) };
  // brīdinājums pārskatā: kopija sen nav atjaunota vai gaida atļauju
  { const orig = D.alerts; D.alerts = () => { const out = orig(); if (enabled(CFG) && S.root) { const age = CFG.last ? (Date.now() - new Date(CFG.last.at)) / 864e5 : 99; if (status === 'perm' || age > 7) out.push({ kind: 'backup', sev: 1, when: CFG.last?.at?.slice(0, 10) || '', msg: status === 'perm' ? 'Šifrētajai rezerves kopijai vajag atļauju — Iestatījumos spied “Izveidot kopiju tagad”' : `Šifrētā rezerves kopija nav atjaunota ${CFG.last ? Math.floor(age) + ' dienas' : 'ne reizi'} — Iestatījumos spied “Izveidot kopiju tagad”` }); } return out; }; }

  /* --- Iestatīšana --- */
  function dlg(id, html, cls = '') { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.className = cls; d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  const pwOk = (pw, hint) => pw.length < 8 ? 'Parolei jābūt vismaz 8 zīmes garai' : hint && U.norm(hint).includes(U.norm(pw)) ? 'Mājiens nedrīkst saturēt pašu paroli' : '';
  const CID_RE = /\.apps\.googleusercontent\.com$/;
  const cidField = (id, v) => `<div class="enc-cid"><label class="small">Google OAuth Client ID <button type="button" class="sm ghost" data-act="gcalHelp" data-arg="drive">? Kā iegūt</button></label>
    <input id="${id}" value="${esc(v)}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div>`;
  let setupDir = null;
  A.encSetup = () => {
    if (!S.root) return CP.needRoot?.();
    setupDir = null;
    const cid = G().clientId();
    const d = dlg('encDialog', `<form><header class="dlg-head"><h2>🔐 Šifrētās rezerves kopijas iestatīšana</h2><button type="button" class="ghost" data-close="encDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <div class="field"><label>1. Kur glabāt kopiju</label>
          <div class="choice-list">
            <label class="choice"><input type="radio" name="where" value="drive" checked><div class="grow"><b>☁ Google Drive — tieši no rīka</b><div class="small muted">Nekas nav jāinstalē. Rīks pieslēdzas tavam Google kontam un Drive izveido mapi ${DIRNAME}. Rīks redz tikai savus failus, nevis visu tavu Drive.</div>
              ${cid ? `<div class="small okc" id="encCidOk">✓ Google Client ID jau iestatīts (tas pats, kas kalendāram). Ja kalendāram Drive API vēl nav ieslēgts: <a href="#" data-act="gcalHelp" data-arg="drive">2. solis</a>.</div><input type="hidden" id="encCid" value="${esc(cid)}">` : cidField('encCid', '')}</div></label>
            <label class="choice"><input type="radio" name="where" value="local"><div class="grow"><b>📁 Mape datorā / zibatmiņā</b><div class="small muted">Mape, ko sinhronizē Google Drive programma, ārējs disks vai zibatmiņa (ne pati datu mape).</div>
              <div class="inline-form" style="margin:6px 0 0"><button type="button" data-act="encPickDir">📁 Izvēlēties mapi</button><span id="encDirName" class="muted small"></span></div></div></label>
          </div></div>
        <div class="fieldgrid"><div class="field"><label>2. Parole (vismaz 8 zīmes)</label><input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" name="pw" autocomplete="off" required></div>
          <div class="field"><label>Parole vēlreiz</label><input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" name="pw2" autocomplete="off" required></div>
          <div class="field wide"><label>Paroles mājiens (nav obligāts, redzams visiem, kam ir kopijas fails)</label><input name="hint" placeholder="piem., pirmā suņa vārds + gads" autocomplete="off"></div></div>
        <p class="small muted">Nākamajā solī rīks parādīs <b>atkopšanas kodu</b> — ar to kopiju var atvērt arī tad, ja aizmirsti paroli.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encDialog">Atcelt</button><button class="mainbtn" type="submit">Tālāk →</button></footer></form>`);
    const f = d.querySelector('form');
    d.querySelector('.dlg-body').addEventListener('focusin', e => { if (e.target.id === 'encCid') f.where.value = 'drive'; });
    // viena iestatīšana vienlaikus: atkārtots “Tālāk” klikšķis, kamēr gaida Google, neizveido otru kodu
    f.onsubmit = async e => {
      e.preventDefault(); if (f.dataset.busy) return;
      const btn = f.querySelector('[type=submit]'), txt = btn.textContent; f.dataset.busy = '1'; btn.disabled = true; btn.textContent = 'Gaida…';
      try { await setupGo(); } finally { delete f.dataset.busy; btn.disabled = false; btn.textContent = txt; }
    };
    const setupGo = async () => {
      const drv = f.where.value === 'drive', cid = (U.$('encCid')?.value || '').trim();
      if (!drv && !setupDir) return ui.toast('Izvēlies mapi kopijai', 'warn');
      if (drv && !CID_RE.test(cid)) return ui.toast('Ielīmē Google Client ID (beidzas ar .apps.googleusercontent.com). Kā to iegūt — spied “? Kā iegūt”.', 'warn', 9000);
      if (f.pw.value !== f.pw2.value) return ui.toast('Paroles nesakrīt', 'warn');
      const bad = pwOk(f.pw.value, f.hint.value.trim()); if (bad) return ui.toast(bad, 'warn');
      let existing = null;
      if (drv) {
        const gcs = S.db.settings.gcal = S.db.settings.gcal || { clientId: '', calendarId: '', lastSync: '' };
        if (!gcs.clientId) { gcs.clientId = cid; store.changed({ silent: true }); }
        if (!await G().token(['drive'], true, cid)) return;
        try {
          for (const fo of await G().drive.findFolders(DIRNAME, 'root')) { const k = await G().drive.children(fo.id, " and name='KOPIJA.json'"); if (k.length) { existing = fo.id; break; } }
        } catch (x) { return ui.toast(x.message, 'err', 12000); }
        if (existing && !confirm(`Tavā Google Drive jau ir CADET rezerves kopija (mape ${DIRNAME}).\n\nJa tā ir no cita tava datora un gribi strādāt ar tiem pašiem datiem — spied “Atcelt” un izvēlies “Atjaunot no kopijas…”.\n\nIzveidot jaunu kopiju? Vecā tiks aizstāta.`)) return;
      } else {
        existing = await backupDirOf(setupDir);
        if (existing && !confirm('Šajā mapē jau ir CADET rezerves kopija. Izveidot jaunu? Vecā kopija šajā mapē tiks aizstāta.')) return;
      }
      try {
        const master = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']), code = newRecovery();
        const head = { format: FORMAT, v: 1, set: hex(rnd(8)), created: U.now(), updated: '', root: S.rootName, hint: f.hint.value.trim(), store: drv ? 'drive' : 'local', wraps: { pw: await wrap(master, f.pw.value), rc: await wrap(master, normRecovery(code)) }, index: '' };
        U.$('encDialog')?.close();   // iestatīšanas logs pazūd — uz tā vairs nevar uzspiest un izveidot vēl vienu kodu
        showCode(code, async () => {
          try {
            if (drv) {
              if (!await G().token(['drive'], true, cid)) return ui.toast('Bez Google savienojuma kopiju nevar izveidot. Mēģini vēlreiz.', 'warn');
              const fid = existing || await G().drive.mkdir(DIRNAME);
              const bs = await driveStore(fid).open(); if (existing) await bs.wipe();
              await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1));
              CFG = { kind: 'drive', folderId: fid, master, set: head.set, hint: head.hint, created: head.created };
            } else {
              const bdir = await sub(setupDir, DIRNAME, true);
              if (existing) await localStore(bdir).wipe();
              await writeBytes(bdir, 'KOPIJA.json', JSON.stringify(head, null, 1));
              CFG = { dir: setupDir, master, set: head.set, hint: head.hint, created: head.created };
            }
            await cfgSet(CFG); U.$('encDialog').close(); status = ''; paint(); run({ ask: true });
          } catch (x) { console.error(x); ui.toast('Neizdevās: ' + x.message, 'err', 12000); }
        }, drv ? cid : '');
      } catch (x) { console.error(x); ui.toast('Neizdevās: ' + x.message, 'err'); }
    };
  };
  // Client ID saglabāts palīga logā → ieliek iestatīšanas logā
  CP.encBackup.clientSaved = v => { const i = U.$('encCid'); if (i) i.value = v; const f = U.$('encDialog')?.querySelector('form'); if (f?.where) f.where.value = 'drive'; const r = U.$('encResCid'); if (r) r.value = v; ui.toast('✓ Client ID saglabāts', 'ok', 3000); };
  A.encPickDir = async () => {
    const f = U.$('encDialog')?.querySelector('form'); if (f?.where) f.where.value = 'local';
    try {
      const h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'readwrite' });
      if (S.root && await S.root.resolve(h) !== null) return ui.toast('Šī mape ir datu mapē. Izvēlies citu vietu.', 'warn', 8000);
      if (S.root && await h.resolve(S.root) !== null) return ui.toast('Datu mape atrodas šajā mapē. Izvēlies atsevišķu mapi kopijai.', 'warn', 8000);
      setupDir = h; const el = U.$('encDirName'); if (el) { el.textContent = '✓ ' + h.name; el.className = 'okc small'; }
    } catch (e) { if (e.name !== 'AbortError') ui.toast('Mapi neizdevās izvēlēties: ' + e.message, 'err'); }
  };
  function codeSheet(code, cid) {
    return `<div style="font:14px/1.5 Arial;padding:24mm;color:#000"><h1 style="font-size:20px">CADET PERSONĀLS — rezerves kopijas atkopšanas kods</h1>
      <p>Datu mape: <b>${esc(S.rootName || '')}</b> · Izveidots: ${esc(U.fmtDate(U.iso()))}</p>
      <p style="font:700 24px/1.6 monospace;letter-spacing:2px;border:2px solid #000;padding:12px 16px;display:inline-block">${esc(code)}</p>
      <p>Ar šo kodu var atvērt šifrēto rezerves kopiju, ja aizmirsta parole. Glabā drošā vietā (piem., aizslēgtā atvilktnē), atsevišķi no datora. Nefotografē un nesūti to.</p>
      ${cid ? `<p><b>Kopija glabājas Google Drive</b> (mape ${DIRNAME}). Atjaunojot citā datorā, vajadzēs šo Google Client ID (tas nav slepens):<br><span style="font:12px monospace;word-break:break-all">${esc(cid)}</span><br>To var atrast arī console.cloud.google.com → Google Auth Platform → Clients.</p>` : ''}
      <p>Atjaunošana: rīkā “Atjaunot no šifrētās kopijas” vai kopijas mapē atver failu ATJAUNOT.html.</p></div>`;
  }
  function showCode(code, onDone, cid = '') {
    const d = dlg('encCodeDialog', `<form><header class="dlg-head"><h2>Atkopšanas kods</h2></header>
      <div class="dlg-body"><p style="margin-top:0">Ar šo kodu kopiju var atvērt, <b>ja aizmirsti paroli</b>. Tas tiek parādīts <b>tikai tagad</b>.</p>
        <div class="enc-code">${esc(code)}</div>
        <div class="actions"><button type="button" data-act="copy" data-arg="${esc(code)}">⧉ Kopēt</button><button type="button" id="encSave">💾 Saglabāt failā</button><button type="button" id="encPrint">🖨 Izdrukāt / saglabāt PDF</button></div>
        <p class="small muted">Izdrukā, pieraksti vai saglabā failā un glabā drošā vietā atsevišķi no datora (piem., zibatmiņā). Nesūti to e-pastā un neliec Google Drive.${cid ? ' Izdrukā un failā ir arī Google Client ID, kas vajadzīgs atjaunošanai citā datorā.' : ''}</p>
        <label class="check" style="margin-top:10px"><input type="checkbox" name="ok"> Esmu kodu saglabājis drošā vietā</label></div>
      <footer class="dlg-foot"><span class="grow"></span><button class="mainbtn" type="submit" disabled>Pabeigt un izveidot kopiju</button></footer></form>`);
    const f = d.querySelector('form');
    f.ok.onchange = () => { f.querySelector('[type=submit]').disabled = !f.ok.checked; };
    d.addEventListener('cancel', e => e.preventDefault());
    U.$('encSave').onclick = () => {
      const txt = ['CADET PERSONĀLS — šifrētās rezerves kopijas atkopšanas kods', '', 'Kods: ' + code, '', 'Datu mape: ' + (S.rootName || ''), 'Izveidots: ' + U.fmtDate(U.iso()),
        cid ? `Kopija: Google Drive, mape ${DIRNAME}\r\nGoogle Client ID (vajadzīgs atjaunošanai citā datorā): ${cid}` : `Kopija: mapē ${DIRNAME}`, '',
        'Ar šo kodu kopiju var atvērt, ja aizmirsta parole: rīkā “Atjaunot no kopijas…” → “Aizmirsi paroli? Atkopšanas kods”.',
        'Glabā šo failu atsevišķi no datora un no kopijas (piem., zibatmiņā vai ārējā diskā). Neliec to Google Drive.'].join('\r\n');
      U.download(new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' }), `CADET_atkopsanas_kods_${String(S.rootName || 'dati').replace(/[^\p{L}\p{N}_-]+/gu, '_')}_${U.iso()}.txt`);
      ui.toast('Fails lejupielādēts. Pārvieto to uz zibatmiņu vai citu drošu vietu — ne Google Drive.', 'ok', 9000);
    };
    U.$('encPrint').onclick = () => { const n = document.createElement('div'); n.innerHTML = codeSheet(code, cid); CP.setPrintSource({ kind: 'html', node: n }); d.close(); A.printGo(); setTimeout(() => { if (!d.open) d.showModal(); }, 800); };
    let done = false;
    f.onsubmit = async e => { e.preventDefault(); if (done) return; done = true; d.close(); await onDone(); };
  }
  async function editHead(fn) {
    CFG = CFG || await cfgGet();
    const bs = await access(true); if (!bs) throw Error(isDrive(CFG) ? 'nav Google savienojuma' : 'kopijas mapei nav atļaujas');
    const head = JSON.parse(await bs.readTop('KOPIJA.json'));
    await fn(head); await bs.writeTop('KOPIJA.json', JSON.stringify(head, null, 1)); await cfgSet(CFG); status = ''; paint();
  }
  A.encPw = () => {
    const d = dlg('encPwDialog', `<form><header class="dlg-head"><h2>Mainīt paroli</h2><button type="button" class="ghost" data-close="encPwDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Šajā datorā vecā parole nav vajadzīga. Atkopšanas kods paliek tas pats.</p><div class="fieldgrid">
        <div class="field"><label>Jaunā parole</label><input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" name="pw" autocomplete="off" required></div><div class="field"><label>Vēlreiz</label><input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" name="pw2" autocomplete="off" required></div>
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
    showCode(code, async () => { try { await editHead(async h => { h.wraps.rc = await wrap(CFG.master, normRecovery(code)); }); ui.toast('Jaunais atkopšanas kods saglabāts', 'ok'); } catch (x) { ui.toast('Neizdevās: ' + x.message, 'err'); } }, isDrive(CFG) ? G().clientId() : '');
  };
  A.encRun = () => run({ ask: true });
  A.encOff = async () => { if (!confirm(`Atslēgt šifrēto rezerves kopiju šajā datorā? Jau izveidotā kopija ${isDrive(CFG) ? 'Google Drive' : 'mapē'} paliek, un to var atjaunot ar paroli vai atkopšanas kodu.`)) return; CFG = null; status = ''; await store.idbSet('encbak', null); paint(); G()?.paintBanner(); };

  /* --- Atjaunošana (arī bez datu mapes — no sākuma lapas) --- */
  let R = null;
  A.encRestore = () => {
    const cid = G()?.clientId() || '';
    dlg('encResDialog', `<header class="dlg-head"><h2>Atjaunot no šifrētās kopijas</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p style="margin-top:0">Kur ir kopija?</p>
        <div class="choice-list">
          <div class="choice"><div class="grow"><b>☁ Google Drive</b><div class="small muted">Kopija, ko rīks sūtīja tieši uz Google Drive. Vajag to pašu Google Client ID (tas ir uz izdrukātās atkopšanas koda lapas).</div>
            <div class="enc-cid"><label class="small">Google OAuth Client ID</label><input id="encResCid" value="${esc(cid)}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false" autocomplete="off"></div>
            <div class="actions" style="margin-top:8px"><button type="button" class="mainbtn" data-act="encRestoreDrive">☁ Pieslēgties Google un atrast kopiju</button></div></div></div>
          <div class="choice"><div class="grow"><b>📁 Mape datorā / zibatmiņā</b><div class="small muted">Mape ${DIRNAME} — arī tāda, kas lejupielādēta no Google Drive un atarhivēta.</div>
            <div class="actions" style="margin-top:8px"><button type="button" data-act="encRestoreLocal">📁 Izvēlēties kopijas mapi</button></div></div></div>
        </div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button></footer>`);
  };
  A.encRestoreLocal = async () => {
    let h; try { h = await showDirectoryPicker({ id: 'cadet-encbak', mode: 'read' }); } catch (e) { return; }
    const bdir = await backupDirOf(h); if (!bdir) return ui.toast(`Šajā mapē nav CADET rezerves kopijas (meklē mapi ${DIRNAME} ar failu KOPIJA.json)`, 'warn', 9000);
    const head = JSON.parse(await readText(bdir, 'KOPIJA.json'));
    if (head.format !== FORMAT) return ui.toast('Neatpazīts kopijas formāts', 'err');
    pwDialog(() => localStore(bdir).open(false), head);
  };
  A.encRestoreDrive = async (arg, el) => {
    const cid = (U.$('encResCid')?.value || '').trim();
    if (!CID_RE.test(cid)) return ui.toast('Ielīmē Google Client ID (beidzas ar .apps.googleusercontent.com)', 'warn', 8000);
    if (!await G().token(['drive'], true, cid)) return;
    if (el) { el.disabled = true; el.innerHTML = '<span class="spin"></span> Meklē Google Drive…'; }
    const found = [];
    try {
      for (const fo of await G().drive.findFolders(DIRNAME)) {
        const k = await G().drive.children(fo.id, " and name='KOPIJA.json'"); if (!k.length) continue;
        try { const head = JSON.parse(await G().drive.text(k[0].id)); if (head.format === FORMAT && head.index) found.push({ id: fo.id, head }); } catch (e) { }
      }
    } catch (x) { if (el) { el.disabled = false; el.textContent = '☁ Pieslēgties Google un atrast kopiju'; } return ui.toast(x.message, 'err', 12000); }
    if (el) { el.disabled = false; el.textContent = '☁ Pieslēgties Google un atrast kopiju'; }
    if (!found.length) return ui.toast(`Šajā Google kontā nav atrasta CADET rezerves kopija, ko izveidojis rīks ar šo Client ID. Pārbaudi kontu un Client ID; ja kopiju lejupielādēji, izvēlies “Mape datorā”.`, 'warn', 12000);
    found.sort((a, b) => String(b.head.updated || b.head.created).localeCompare(String(a.head.updated || a.head.created)));
    if (found.length === 1) return pwDialog(() => driveStore(found[0].id).open(), found[0].head, found[0].id);
    // vairākas kopijas → izvēle
    const d = dlg('encResDialog', `<form><header class="dlg-head"><h2>Kuru kopiju atjaunot?</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="choice-list">${found.map((x, i) => `<label class="choice"><input type="radio" name="k" value="${i}" ${i ? '' : 'checked'}><div class="grow"><b>${esc(x.head.root || 'Datu mape')}</b><div class="small muted">Pēdējā kopija: ${esc(U.fmtDateTime(x.head.updated || x.head.created))} · ${x.head.stats ? faili(x.head.stats.files) + ' · ' + fmtB(x.head.stats.bytes) : ''}</div></div></label>`).join('')}</div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="encResDialog">Atcelt</button><button class="mainbtn" type="submit">Tālāk →</button></footer></form>`);
    d.querySelector('form').onsubmit = e => { e.preventDefault(); const x = found[+e.target.k.value]; pwDialog(() => driveStore(x.id).open(), x.head, x.id); };
  };
  function pwDialog(open, head, folderId = '') {
    R = { open, head, master: null, folderId };
    const d = dlg('encResDialog', `<form><header class="dlg-head"><h2>Atjaunot no šifrētās kopijas</h2><button type="button" class="ghost" data-close="encResDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">${ui.dl([['Kopija', head.store === 'drive' ? '☁ Google Drive' : '📁 Mape', 1], ['Datu mape kopijā', esc(head.root || '—'), 1], ['Pēdējā kopija', esc(U.fmtDateTime(head.updated || head.created)), 1], ['Faili', `${head.stats?.files ?? '—'}${head.stats ? ' · ' + fmtB(head.stats.bytes) : ''}`, 1]])}
        <div class="choice-list"><label class="choice"><input type="radio" name="how" value="pw" checked><div class="grow"><b>Parole</b>${head.hint ? `<div class="small muted">Mājiens: ${esc(head.hint)}</div>` : ''}<input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" name="pw" autocomplete="off" style="margin-top:8px"></div></label>
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
  }
  A.encRestoreTo = async () => {
    let t; try { t = await showDirectoryPicker({ id: 'cadet-restore', mode: 'readwrite' }); } catch (e) { return; }
    for await (const [n] of t.entries()) if (!SKIP(n)) { return ui.toast('Izvēlētā mape nav tukša. Izveido jaunu, tukšu mapi un izvēlies to.', 'warn', 9000); }
    const d = U.$('encResDialog'), body = d.querySelector('.dlg-body'), foot = d.querySelector('.dlg-foot');
    foot.innerHTML = ''; body.innerHTML = `<p><span class="spin"></span> Atjauno${R.head.store === 'drive' ? ' no Google Drive' : ''}… <b id="encResN">0</b> faili</p>`;
    try {
      const n = await restoreInto(await R.open(), R.head, R.master, t, k => { const el = U.$('encResN'); if (el) el.textContent = k; });
      body.innerHTML = `<p class="okc"><b>✓ Atjaunoti ${n.ok} faili</b>${n.bad ? ` · <span class="red">${n.bad} ar kļūdu</span>` : ''}. Visi pārbaudīti ar kontrolsummu.</p><p>Mape “${esc(t.name)}” tagad tiks pieslēgta kā datu mape.</p>${R.head.store === 'drive' && R.folderId ? '<p class="small muted">Šis dators turpmāk izmantos to pašu Google Drive kopiju. Ja strādā uz diviem datoriem, rīks atverot pārbaudīs, vai otrā nav jaunāku datu, un piedāvās tos ielādēt.</p>' : ''}`;
      foot.innerHTML = '<span class="grow"></span><button class="mainbtn" data-close="encResDialog">Gatavs</button>';
      await store.connectRoot(t, 'atjaunots no šifrētās kopijas');
      if (R.folderId && R.head.store === 'drive') {   // otrs dators: turpina to pašu Google Drive kopiju (bez jaunas iestatīšanas)
        CFG = { kind: 'drive', folderId: R.folderId, master: R.master, set: R.head.set, hint: R.head.hint, created: R.head.created, syncHead: R.head.updated, multi: true, last: { at: U.now(), rev: S.db.revision, files: R.head.stats?.files || 0, bytes: R.head.stats?.bytes || 0, pulled: true } };
        await cfgSet(CFG); checked = true; REMOTE = null; status = 'ok'; paint();
      }
    } catch (x) { console.error(x); body.innerHTML = `<p class="red">Atjaunošana neizdevās: ${esc(x.message)}</p>`; foot.innerHTML = '<span class="grow"></span><button data-close="encResDialog">Aizvērt</button>'; }
  };
  /** Kopijas atšifrēšana mapē. src: glabātuve (localStore/driveStore) vai kopijas mapes rokturis.
      Ārējo mapju dokumenti → _atjaunoti_no_arejam_mapem/<mape>/…, datu failā sasaiste pārlikta uz pamatmapi. */
  async function restoreInto(src, head, master, target, onProg) {
    const bs = src.kind ? src : await localStore(src).open(false);
    const idx = await decJson(master, head.index);
    let ok = 0, bad = 0; const moved = {};
    for (const d of idx.dirs || []) { let dir = target; for (const p of d.split('/')) dir = await dir.getDirectoryHandle(p, { create: true }); }
    const mkdirs = async parts => { let dir = target; for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true }); return dir; };
    await pool(Object.entries(idx.files), bs.kind === 'drive' ? 4 : 1, async ([key, v]) => {
      try {
        const data = await decBytes(master, await bs.get(v.id));
        if (await sha(data) !== v.sha) throw Error('kontrolsumma nesakrīt');
        let rel = key.replace(/^main\//, '');
        if (key.startsWith('ext/')) { const [, sid, ...p] = key.split('/'); rel = `_atjaunoti_no_arejam_mapem/${String(v.src || sid).replace(/[\\/:*?"<>|]/g, '_')}/${p.join('/')}`; moved[sid + '|' + p.join('/')] = rel; }
        const parts = rel.split('/');
        await writeBytes(await mkdirs(parts.slice(0, -1)), parts.at(-1), data);
        ok++; if (ok % 10 === 0) { onProg?.(ok); await new Promise(r => setTimeout(r, 0)); }
      } catch (e) { if (e.auth) throw e; console.error(key, e); bad++; }
    });
    // datu fails: ārējo dokumentu sasaiste uz atjaunotajām kopijām pamatmapē
    if (Object.keys(moved).length) {
      const v = idx.files['main/' + CP.DATAFILE];
      if (v) {
        const db = JSON.parse(td.decode(await decBytes(master, await bs.get(v.id))));
        for (const d of db.documents || []) { const m = moved[(d.sourceId || 'main') + '|' + d.path]; if (m) { d.sourceId = 'main'; d.path = m; } }
        await writeBytes(target, CP.DATAFILE, JSON.stringify(db, null, 2));
      }
    }
    onProg?.(ok);
    return { ok, bad };
  }
  CP.encBackup.restoreInto = restoreInto;
  CP.encBackup._stores = { localStore, driveStore };


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
