/* =====================================================================
   Datu glabāšana: datu mape, JSON fails, rezerves kopijas, failu indekss.
   Strādā ar File System Access API (Chrome / Edge).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state;
  const store = {};
  const TMP = CP.DATAFILE + '.raksta';

  /* --- Mapes atcerēšanās starp sesijām (IndexedDB) --- */
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('cadet-personals' + (CP.CHANNEL === 'test' ? '-test' : ''), 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || Error('IndexedDB nav pieejama'));
    });
  }
  store.idbSet = async (k, v) => {
    const d = await idb();
    await new Promise((res, rej) => {
      const t = d.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error || Error('IndexedDB ieraksts neizdevās'));
    });
  };
  store.idbGet = async k => {
    const d = await idb();
    return await new Promise((res, rej) => {
      const r = d.transaction('kv').objectStore('kv').get(k);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || Error('IndexedDB lasīšana neizdevās'));
    });
  };

  async function ensurePerm(ask) {
    if (!S.root) return false;
    if (await S.root.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    if (!ask) return false;
    return (await S.root.requestPermission({ mode: 'readwrite' })) === 'granted';
  }
  store.ensurePerm = ensurePerm;

  /* --- Izmaiņu reģistrēšana un saglabāšana --- */
  store.changed = (opts = {}) => {
    if (S.db && CP.flushNotes) CP.flushNotes(S.db);
    S.dirty = true;
    S.rev = (S.rev || 0) + 1;
    if (!opts.silent) CP.render();
    else CP.ui.updateSaveState();
    store.schedule();
  };
  const autosave = U.debounce(() => store.save(true), 1000);
  store.schedule = () => { if (S.root && S.db.settings.autosave && !S.conflict && !S.newerFile) autosave(); };

  /** Cita cilne vai ārējs labojums: laika zīmogs vai revīzijas numurs nesakrīt. */
  store.fileChanged = (loadedStamp, loadedRev, fileStamp, fileRev) => {
    if (!loadedStamp) return false;
    if (fileStamp !== loadedStamp) return true;
    if (loadedRev != null && fileRev != null && Number(fileRev) !== Number(loadedRev)) return true;
    return false;
  };

  let chain = Promise.resolve();
  store.save = silent => {
    const job = chain.then(() => performSave(!!silent));
    chain = job.then(() => true, () => false);
    return job;
  };

  async function readStamp(handle) {
    const f = await handle.getFile();
    const text = await f.text();
    let revision = null, parseOk = false;
    if (text) {
      try {
        const parsed = JSON.parse(text);
        revision = parsed && typeof parsed.revision === 'number' ? parsed.revision : null;
        parseOk = !!(parsed && Array.isArray(parsed.people));
      } catch (e) { parseOk = false; }
    }
    return { lastModified: f.lastModified, revision, parseOk, text, empty: !text };
  }

  async function writeExact(fh, text) {
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
    const got = await (await fh.getFile()).text();
    if (got !== text) throw Error('fails pēc ieraksta nesakrīt ar saglabāto tekstu');
    const parsed = JSON.parse(got);
    CP.validateDb(parsed);
    return fh;
  }

  async function backupText(text, opts = {}) {
    if (!text) return { ok: true, skipped: true };
    try {
      const dir = await S.root.getDirectoryHandle('_rezerves', { create: true });
      if (opts.daily) {
        const day = U.iso();
        if (S.backupDay === day) return { ok: true, skipped: true };
        let exists = false;
        for await (const [n, h] of dir.entries()) if (h.kind === 'file' && n.startsWith('DATI_' + day)) { exists = true; break; }
        if (exists) { S.backupDay = day; return { ok: true, skipped: true }; }
      }
      const name = opts.name || `DATI_${U.stamp()}.json`;
      const fh = await dir.getFileHandle(name, { create: true });
      await writeExact(fh, text);
      if (opts.daily) S.backupDay = U.iso();
      return { ok: true, name };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  function noteBackup(result) {
    if (!result || result.ok || result.skipped) return;
    if (S.backupError === result.error) return;
    S.backupError = result.error;
    CP.ui.toast('Rezerves kopija neizdevās: ' + result.error, 'warn', 12000);
  }

  async function performSave(silent) {
    if (S.newerFile) {
      CP.ui.toast(`Datu failu saglabājusi jaunāka CADET PERSONĀLS versija. Lai dati netiktu sabojāti, saglabāšana ir atslēgta. Pārlādē lapu (Ctrl+F5) vai atver jaunāko versiju.`, 'err', 20000);
      return false;
    }
    if (!S.root) {
      CP.ui.toast(silent ? 'Dati nav saglabāti — nav piekļuves datu mapei' : 'Vispirms izvēlies datu mapi', silent ? 'err' : 'warn', 8000);
      CP.ui.updateSaveState();
      return false;
    }
    const prevRev = S.db.revision || 0;
    const prevUpdated = S.db.updatedAt;
    const wasDirty = S.dirty;
    const revAtStart = S.rev;
    try {
      if (!(await ensurePerm(!silent))) {
        CP.ui.toast('Dati nav saglabāti: nav rakstīšanas atļaujas datu mapei', 'err', 9000);
        CP.ui.updateSaveState();
        return false;
      }
      let existing = null;
      try { existing = await S.root.getFileHandle(CP.DATAFILE); }
      catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (existing) {
        const stamp = await readStamp(existing);
        const external = !stamp.parseOk || store.fileChanged(S.fileStamp, S.loadedRevision, stamp.lastModified, stamp.revision);
        if (S.fileStamp && external) {
          S.conflict = true;
          CP.ui.updateSaveState();
          if (silent) {
            if (!S.conflictNotified) {
              S.conflictNotified = true;
              CP.ui.toast('Datu fails ir mainīts ārpus šī loga (cita cilne vai dators). Automātiskā saglabāšana apturēta — pārbaudi un spied “Saglabāt”.', 'warn', 12000);
            }
            return false;
          }
          if (!confirm('Datu fails kopš ielādes ir mainīts ārpus šī loga (cita cilne vai dators).\n\nPārrakstīt to ar šajā logā redzamajiem datiem?')) return false;
        }
        if (stamp.text) noteBackup(await backupText(stamp.text, { daily: true }));
      }
      const seen = S.rev;
      S.db.revision = prevRev + 1;
      S.db.updatedAt = U.now();
      try { CP.changelog?.capture(S.db); } catch (e) { console.error('žurnāls', e); }
      CP.validateDb(S.db);
      let text = JSON.stringify(S.db, null, 2);
      const tmp = await S.root.getFileHandle(TMP, { create: true });
      await writeExact(tmp, text);
      if (existing) {
        const again = await readStamp(existing);
        const external = !again.parseOk || store.fileChanged(S.fileStamp, S.loadedRevision, again.lastModified, again.revision);
        if (S.fileStamp && external) {
          S.db.revision = prevRev;
          S.db.updatedAt = prevUpdated;
          S.conflict = true;
          CP.ui.updateSaveState();
          if (silent || !confirm('Kamēr dati tika sagatavoti, fails paspēja mainīties citā logā.\n\nTomēr pārrakstīt ar šī loga datiem?')) {
            CP.ui.toast('Saglabāšana apturēta — datu fails ir mainīts citur. Nesaglabātās izmaiņas ir paturētas.', 'warn', 12000);
            return false;
          }
          S.db.revision = prevRev + 1;
          S.db.updatedAt = U.now();
          text = JSON.stringify(S.db, null, 2);
          await writeExact(tmp, text);
        }
      }
      const fh = existing || await S.root.getFileHandle(CP.DATAFILE, { create: true });
      await writeExact(fh, text);
      const file = await fh.getFile();
      S.fileStamp = file.lastModified;
      S.loadedRevision = S.db.revision;
      S.conflict = false;
      S.conflictNotified = false;
      if (S.rev !== seen) S.dirty = true;
      else S.dirty = false;
      CP.ui.updateSaveState();
      try { await S.root.removeEntry(TMP); }
      catch (e) { CP.ui.toast('Dati saglabāti, bet pagaidu failu neizdevās izdzēst: ' + e.message, 'warn'); }
      if (!silent) CP.ui.toast('Saglabāts', 'ok');
      if (S.dirty && S.db.settings.autosave && !S.conflict) store.schedule();
      return true;
    } catch (e) {
      S.db.revision = prevRev;
      S.db.updatedAt = prevUpdated;
      S.dirty = wasDirty || S.rev !== revAtStart;
      CP.ui.updateSaveState();
      CP.ui.toast('Saglabāšana neizdevās: ' + (e.message || e) + '. Nesaglabātās izmaiņas ir paturētas.', 'err', 12000);
      return false;
    }
  }

  /* --- Rezerves kopijas un arhīvs --- */
  store.backupNow = async () => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return { ok: false }; }
    if (!(await ensurePerm(true))) { CP.ui.toast('Nav rakstīšanas atļaujas — kopija netika izveidota', 'err'); return { ok: false }; }
    try { CP.validateDb(S.db); }
    catch (e) { CP.ui.toast('Kopija netika veidota: ' + e.message, 'err'); return { ok: false, error: e.message }; }
    const result = await backupText(JSON.stringify(S.db, null, 2), { name: `DATI_${U.stamp()}.json` });
    if (!result.ok) CP.ui.toast('Rezerves kopija neizdevās: ' + result.error, 'err', 12000);
    else CP.ui.toast('Izveidota JSON kopija ' + result.name + '. Tajā nav pašu dokumentu failu.', 'ok', 9000);
    return result;
  };
  store.listBackups = async () => {
    if (!S.root) return [];
    try {
      const dir = await S.root.getDirectoryHandle('_rezerves');
      const out = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'file' || !name.endsWith('.json')) continue;
        const f = await h.getFile();
        out.push({ name, size: f.size, modified: f.lastModified });
      }
      return out.sort((a, b) => b.modified - a.modified || b.name.localeCompare(a.name));
    } catch (e) {
      if (e.name === 'NotFoundError') return [];
      throw e;
    }
  };
  store.verifyBackup = async name => {
    const text = await readBackup(name);
    try {
      const parsed = JSON.parse(text);
      CP.validateDb(parsed);
      return { ok: true, people: parsed.people.length, documents: (parsed.documents || []).length, version: parsed.version, bytes: text.length };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  };
  async function readBackup(name) {
    if (!S.root) throw Error('nav datu mapes');
    if (!/^[\w.\-]+\.json$/.test(name)) throw Error('nederīgs kopijas nosaukums');
    const dir = await S.root.getDirectoryHandle('_rezerves');
    const fh = await dir.getFileHandle(name);
    return (await fh.getFile()).text();
  }
  store.restoreBackup = async name => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return false; }
    if (!confirm(`Atjaunot datubāzi no kopijas ${name}?\n\nPašreizējie dati vispirms tiks saglabāti mapē _rezerves. Dokumentu faili un iepriekšējās kopijas netiks dzēsti.`)) return false;
    let parsed;
    try {
      parsed = JSON.parse(await readBackup(name));
      CP.validateDb(parsed);
    } catch (e) { CP.ui.toast('Kopija nav derīga, atjaunošana netika sākta: ' + e.message, 'err', 12000); return false; }
    let currentText = '';
    try {
      const cur = await S.root.getFileHandle(CP.DATAFILE);
      currentText = await (await cur.getFile()).text();
    } catch (e) {
      if (e.name !== 'NotFoundError') { CP.ui.toast('Atjaunošana apturēta — neizdevās nolasīt pašreizējos datus: ' + e.message, 'err'); return false; }
    }
    if (currentText) {
      const pre = await backupText(currentText, { name: `PIRMS_ATJAUNOSANAS_${U.stamp()}.json` });
      if (!pre.ok) { CP.ui.toast('Atjaunošana apturēta — neizdevās saglabāt pašreizējo versiju: ' + pre.error, 'err', 12000); return false; }
    }
    const db = CP.migrate(parsed);
    try { CP.validateDb(db); }
    catch (e) { CP.ui.toast('Atjaunotie dati nav derīgi: ' + e.message, 'err'); return false; }
    S.db = db;
    S.conflict = false;
    S.conflictNotified = false;
    S.dirty = true;
    S.rev = (S.rev || 0) + 1;
    const ok = await store.save(false);
    if (!ok) {
      CP.ui.toast('Atjaunošana nav pabeigta. Pašreizējā versija, ja tā tika izveidota, ir mapē _rezerves.', 'err', 12000);
      return false;
    }
    S.selected = db.people.find(CP.data.isCurrent)?.id || '';
    await restoreSources();
    CP.render();
    CP.ui.toast('Datubāze atjaunota no ' + name, 'ok');
    return true;
  };

  store.listArchives = async () => {
    if (!S.root) return [];
    try {
      const dir = await S.root.getDirectoryHandle('_arhivi');
      const out = [];
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'directory') continue;
        let manifest = null, error = '';
        try {
          const mf = await h.getFileHandle('MANIFESTS.json');
          manifest = JSON.parse(await (await mf.getFile()).text());
        } catch (e) { error = e.message; }
        out.push({ name, manifest, error });
      }
      return out.sort((a, b) => b.name.localeCompare(a.name));
    } catch (e) {
      if (e.name === 'NotFoundError') return [];
      throw e;
    }
  };

  function isExternalSource(id) {
    return !!(id && id !== 'main' && !String(id).startsWith('fails:'));
  }
  store.createArchive = async ({ copyExternal = false } = {}) => {
    if (!S.root) { CP.ui.toast('Vispirms izvēlies datu mapi', 'warn'); return null; }
    if (!(await ensurePerm(true))) { CP.ui.toast('Nav rakstīšanas atļaujas — arhīvs netika veidots', 'err'); return null; }
    CP.validateDb(S.db);
    const stamp = U.stamp();
    const root = await S.root.getDirectoryHandle('_arhivi', { create: true });
    const dir = await root.getDirectoryHandle('ARHIVS_' + stamp, { create: true });
    const jsonName = CP.DATAFILE;
    const text = JSON.stringify(S.db, null, 2);
    await writeExact(await dir.getFileHandle(jsonName, { create: true }), text);
    const files = [];
    let missing = 0;
    const docs = S.db.documents.filter(d => d && d.path);
    for (const d of docs) {
      await new Promise(r => setTimeout(r, 0));
      const sid = d.sourceId || 'main';
      const row = { id: d.id, personId: d.personId, kind: d.kind, sourceId: sid, path: d.path, size: null, sha256: '', included: false, reason: '' };
      if (isExternalSource(sid) && !copyExternal) {
        row.reason = 'Ārējā mape — fails nav iekopēts, jo nebija piekrišanas';
        missing++;
        files.push(row);
        continue;
      }
      const h = await store.handleFor(d.path, sid);
      if (!h) {
        row.reason = isExternalSource(sid) ? 'Ārējā mape nav pieslēgta — fails nav iekopēts' : 'Fails pamatmapē nav atrasts';
        missing++;
        files.push(row);
        continue;
      }
      try {
        const file = await h.getFile();
        row.size = file.size;
        row.sha256 = await U.sha256Blob(file);
        const parts = d.path.split('/').filter(Boolean);
        let dest = await dir.getDirectoryHandle('dokumenti', { create: true });
        dest = await dest.getDirectoryHandle(sid.replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        for (let i = 0; i < parts.length - 1; i++) dest = await dest.getDirectoryHandle(parts[i].replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        const out = await dest.getFileHandle(parts.at(-1).replace(/[\\/:*?"<>|]/g, '_'), { create: true });
        const w = await out.createWritable();
        await w.write(file);
        await w.close();
        const copied = await out.getFile();
        if (copied.size !== file.size) throw Error('nokopētais izmērs nesakrīt');
        row.included = true;
      } catch (e) {
        row.included = false;
        row.reason = e.message || String(e);
        missing++;
      }
      files.push(row);
    }
    const paper = S.db.documents.filter(d => d && !d.path).length;
    const pilns = missing === 0 && docs.length > 0;
    const manifest = {
      veids: pilns ? 'pilns-registrēto-dokumentu-arhivs' : 'dalejs-arhivs',
      pilns,
      izveidots: U.now(),
      versija: CP.VERSION,
      json: jsonName,
      piezime: pilns
        ? 'Iekļauta JSON datubāze un visi reģistrētie dokumentu faili.'
        : 'Šis nav pilns dokumentu arhīvs. JSON datubāze ir iekļauta. Faili ar included:false nav iekopēti.',
      paperWithoutFile: paper,
      navIeklauti: files.filter(f => !f.included).map(f => ({ path: f.path, sourceId: f.sourceId, reason: f.reason })),
      faili: files
    };
    const manText = JSON.stringify(manifest, null, 2);
    const man = await dir.getFileHandle('MANIFESTS.json', { create: true });
    const mw = await man.createWritable();
    await mw.write(manText);
    await mw.close();
    const back = await (await man.getFile()).text();
    if (back !== manText) throw Error('manifests pēc ieraksta nesakrīt');
    const title = pilns ? 'Pilns reģistrēto dokumentu arhīvs' : 'Daļējs arhīvs — nav visi dokumenti';
    CP.ui.toast(title + ': _arhivi/ARHIVS_' + stamp + (missing ? ` (${missing} faili nav iekļauti)` : ''), pilns ? 'ok' : 'warn', 12000);
    return manifest;
  };

  /* --- Datu mapes izvēle un ielāde --- */
  /* Divi pieslēgšanas veidi:
     1) dialogs showDirectoryPicker() — izsaukts kā PIRMĀ darbība klikšķī (bez confirm/await pirms tā),
        lai netiktu zaudēta lietotāja aktivācija; bez "id" (atcerētā sākuma mape var būt nepieejams tīkla ceļš);
     2) mapes ievilkšana no File Explorer (DataTransferItem.getAsFileSystemHandle) — darbojas arī tad,
        ja Chrome dialogā izvēlēto vietu uzskata par sistēmas mapi (tīkla/roaming profils) un atgriež AbortError.
     Abi veidi nonāk store.connectRoot(): rakstīšanas atļauja → rakstīšanas pārbaude → loadRoot → IndexedDB. */
  /* Ja index.html atvērts no tīkla ceļa (file://jicfs01/...), adresei ir "host". Chrome tad lapas izcelsmi
     neuzskata par to pašu, kam pieder mapes atļauja, un rakstīšanas atļauju nepiešķir:
     requestPermission → SecurityError "Not allowed to request permissions in this context",
     showDirectoryPicker({mode:'readwrite'}) → AbortError. No lokāla ceļa vai diska burta (file:///C:/…, file:///H:/…) tas strādā. */
  store.netPath = location.protocol === 'file:' && !!location.hostname;
  store.netPathMsg = () => `Programma atvērta no tīkla ceļa \\\\${location.hostname}\\… — no šādas vietas Chrome neļauj piešķirt rakstīšanas atļauju nevienai mapei. Pārkopē programmas mapi uz lokālu vietu (piem. Lejupielādes / Downloads vai C:\\…) vai atver to caur diska burtu (piem. H:\\…) un atver index.html no turienes. Datu mape var palikt, kur ir.`;
  const ctxErr = e => e && e.name === 'SecurityError' && /this context/i.test(e.message || '');
  store.diag = { protocol: location.protocol, host: location.hostname || '(lokāls)', secure: window.isSecureContext, secure: window.isSecureContext, picker: typeof window.showDirectoryPicker, dropHandle: typeof (window.DataTransferItem && DataTransferItem.prototype.getAsFileSystemHandle), last: null };
  const errText = e => (e && (e.name ? e.name + ': ' : '') + (e.message || e)) || 'nezināma kļūda';
  function note(via, step, e, extra) {
    store.diag.last = { via, step, error: e ? errText(e) : '', at: new Date().toLocaleString('lv-LV'), ...(extra || {}) };
    if (e) console.warn('[CADET mape]', via, step, e);
  }
  let picking = false;
  store.pickRoot = () => {
    if (!window.showDirectoryPicker) { CP.ui.toast('Šim pārlūkam nav mapju izvēles dialoga. Ievelc datu mapi no File Explorer laukā “Datu mape”.', 'err', 12000); return; }
    if (picking) return;                     // dubultklikšķis — otrs dialogs netiek atvērts
    picking = true;
    const t0 = performance.now();
    let pr;
    try { pr = window.showDirectoryPicker({ mode: 'readwrite' }); }   // sinhroni, tieši klikšķa apstrādē
    catch (e) { picking = false; pickFailed(e, 0); return; }
    return pr.then(async h => {
      picking = false;
      if (S.dirty && S.root && !confirm('Ir nesaglabātas izmaiņas. Mainīt datu mapi?')) return;
      await store.connectRoot(h, 'dialogs');
    }, e => { picking = false; pickFailed(e, Math.round(performance.now() - t0)); });
  };
  function pickFailed(e, ms) {
    note('dialogs', 'showDirectoryPicker', e, { ms });
    const drop = ' Droši strādājošs veids: atver File Explorer un IEVELC datu mapi laukā “Datu mape” (pārskatā vai Iestatījumos).';
    let msg;
    if (store.netPath && e.name === 'AbortError') msg = 'Mape netika pieslēgta (AbortError). ' + store.netPathMsg();
    else if (e.name === 'AbortError') msg = ms < 600
      ? `Chrome aizvēra mapes dialogu, pirms to varēja izmantot (${ms} ms).` + drop
      : 'Mape netika pieslēgta (Chrome atgrieza AbortError). Ja tu mapi izvēlējies, nevis atcēli, Chrome šo atrašanās vietu uzskata par aizsargātu sistēmas mapi — tā mēdz būt ar tīkla (roaming) profilu, piem. \\\\jicfs01\\Profiles\\…\\Desktop.' + drop;
    else if (e.name === 'SecurityError' || e.name === 'NotAllowedError') msg = 'Chrome neļāva atvērt mapes dialogu (' + errText(e) + '). Spied pogu vēlreiz ar peli.' + drop;
    else msg = 'Mapes dialoga kļūda: ' + errText(e) + '.' + drop;
    CP.ui.toast(msg, 'err', 25000);
    CP.render();
  }

  /** Ievilkšana: items[i].getAsFileSystemHandle() jāizsauc sinhroni drop notikumā, šeit nonāk jau solījums. */
  store.dropRoot = async (pr, count) => {
    if (!pr) { note('ievilkšana', 'getAsFileSystemHandle', Error('pārlūks neatbalsta')); CP.ui.toast('Šis pārlūks neatbalsta mapes ievilkšanu. Lieto Google Chrome vai Microsoft Edge.', 'err', 12000); return; }
    let h;
    try { h = await pr; }
    catch (e) { note('ievilkšana', 'getAsFileSystemHandle', e); CP.ui.toast('Ievilkto mapi neizdevās nolasīt: ' + errText(e), 'err', 15000); return; }
    if (!h) { note('ievilkšana', 'getAsFileSystemHandle', Error('null')); CP.ui.toast('Ievilktais objekts nav mape vai fails datorā (piem., saite vai e-pasta pielikums). Ievelc mapi no File Explorer.', 'err', 12000); return; }
    if (h.kind !== 'directory') { note('ievilkšana', 'kind', Error('fails: ' + h.name)); CP.ui.toast(`Ievilki failu “${h.name}”, nevis mapi. Ievelc pašu datu mapi (piem. “CADET PERSONALS”).`, 'warn', 12000); return; }
    if (count > 1) CP.ui.toast('Ievilkti vairāki objekti — tiek izmantota tikai mape “' + h.name + '”.', 'warn', 8000);
    if (S.root && S.root.isSameEntry && await S.root.isSameEntry(h).catch(() => false)) { CP.ui.toast('Šī mape jau ir pieslēgta: ' + h.name, 'ok'); return; }
    if (S.dirty && S.root && !confirm('Ir nesaglabātas izmaiņas. Mainīt datu mapi uz “' + h.name + '”?')) return;
    await store.connectRoot(h, 'ievilkšana');
  };

  /** Pārbauda rakstīšanu ar īslaicīgu pārbaudes failu (tiek izdzēsts; esošie faili netiek skarti). */
  async function writeProbe(h) {
    const name = '.cadet_rakstisanas_parbaude.tmp', txt = 'ok ' + Date.now();
    const fh = await h.getFileHandle(name, { create: true });
    const w = await fh.createWritable(); await w.write(txt); await w.close();
    const back = await (await fh.getFile()).text();
    try { await h.removeEntry(name); } catch (e) { /* atstāts pārbaudes fails netraucē — tiek ignorēts indeksā */ }
    if (back !== txt) throw Error('ierakstītais saturs nesakrīt');
  }

  /** Kopējais pieslēgšanas ceļš abiem veidiem. Ja rakstīšanas atļauju nevar pieprasīt bez klikšķa, rāda pogu. */
  store.connectRoot = async (h, via) => {
    let perm = 'prompt';
    try { perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { note(via, 'queryPermission', e); }
    if (perm !== 'granted') {
      try { perm = await h.requestPermission({ mode: 'readwrite' }); }
      catch (e) { console.info('[CADET mape] rakstīšanas atļaujai vajag klikšķi:', e.message); note(via, 'gaida klikšķi uz “Atļaut piekļuvi”'); perm = 'needs-click'; }   // ievilkšana nav lietotāja aktivācija
    }
    if (perm !== 'granted') {
      S.pendingRoot = h; S.pendingVia = via;
      try { await store.idbSet('root', h); } catch (e) { /* tikai atcerēšanās */ }
      CP.render();
      CP.ui.toast(perm === 'needs-click'
        ? `Mape “${h.name}” saņemta. Spied “🔓 Atļaut piekļuvi” un Chrome logā izvēlies “Rediģēt failus” / “Atļaut”, lai varētu saglabāt datus.`
        : `Rakstīšana mapē “${h.name}” netika atļauta. Spied “🔓 Atļaut piekļuvi” un Chrome logā izvēlies “Atļaut”.`, 'warn', 15000);
      return false;
    }
    try { await writeProbe(h); }
    catch (e) {
      note(via, 'rakstīšanas pārbaude', e);
      CP.ui.toast(`Mapē “${h.name}” nevar rakstīt (${errText(e)}). Iespējams, mape ir tikai lasāma vai tīkla disks nav pieejams. Izvēlies citu mapi. Nekas netika mainīts.`, 'err', 20000);
      return false;
    }
    note(via, 'pieslēgta', null, { folder: h.name });
    await store.loadRoot(h);
    return true;
  };
  store.loadRoot = async h => {
    let db, isNew = false;
    if (!S.boot || S.boot.error) S.boot = { name: h.name };
    S.boot.name = h.name; S.boot.error = null;
    store.bootStep(50, `Nolasa datu failu no “${h.name}”…`);
    try {
      const fh = await h.getFileHandle(CP.DATAFILE);
      const stamp = await readStamp(fh);
      if (!stamp.parseOk) throw Error(stamp.empty ? 'datu fails ir tukšs' : 'neatbilstošs datu faila formāts');
      const parsed = JSON.parse(stamp.text);
      const fileVer = parsed.version || 0;
      // Datu fails no JAUNĀKAS rīka versijas — atver tikai lasīšanai, lai vecāks kods to nesabojātu
      S.newerFile = fileVer > CP.SCHEMA ? fileVer : 0;
      // Pirms jebkuras datu pārveidošanas uz jaunu shēmu — kopija ar oriģinālo saturu
      if (fileVer < CP.SCHEMA && (parsed.people || []).length) {
        const prevRoot = S.root; S.root = h;
        const bak = await backupText(stamp.text, { name: `DATI_pirms_atjauninasanas_v${fileVer}-v${CP.SCHEMA}_${U.stamp()}.json` });
        S.root = prevRoot;
        if (!bak.ok) CP.ui.toast('Rezerves kopiju pirms datu atjaunināšanas neizdevās izveidot: ' + (bak.error || ''), 'warn', 12000);
      }
      db = CP.migrate(parsed);
      CP.validateDb(db);
      S.fileStamp = stamp.lastModified;
      S.loadedRevision = db.revision || 0;
      if (S.newerFile) CP.ui.toast(`Uzmanību: šo datu failu saglabājusi jaunāka rīka versija. Dati atvērti tikai apskatei — saglabāšana atslēgta. Pārlādē lapu ar Ctrl+F5, lai ielādētu jaunāko versiju.`, 'err', 30000);
      else CP.ui.toast(`Ielādēts: ${db.people.length} personas`, 'ok');
    } catch (e) {
      if (e.name !== 'NotFoundError') { bootFail('other', h, Object.assign(Error('datu fails: ' + e.message + '. Fails netika mainīts.'), { name: e.name })); return; }
      db = CP.migrate(CP.blank());
      S.fileStamp = 0;
      S.loadedRevision = 0;
      isNew = true;
    }
    S.db = db; S.root = h; S.rootName = h.name; S.pendingRoot = null; S.dirty = false; S.conflict = false; S.conflictNotified = false; S.rev = 0;
    S.roots = [{ id: 'main', name: h.name, handle: h, ok: true }];
    S.index = [];
    S.selected = db.people.find(CP.data.isCurrent)?.id || '';
    store.bootStep(65, 'Sagatavo uzskaiti…');
    try { await store.idbSet('root', h); }
    catch (e) { CP.ui.toast('Datu mape ir atvērta, bet to neizdevās atcerēties nākamajai reizei: ' + e.message, 'warn', 10000); }
    await restoreSources();
    store.bootStep(75, 'Pārbauda mācību gadu mapes…');
    try { await store.ensureYearFolders(); }
    catch (e) { CP.ui.toast('Mācību gadu mapes neizdevās izveidot: ' + e.message, 'warn', 10000); }
    if (isNew) {   // jaunai mapei datu fails tiek izveidots uzreiz — nākamreiz mape tiek atpazīta kā uzskaites mape
      const okSave = await store.save(true);
      CP.ui.toast(okSave === false ? 'Jaunā datu mape pieslēgta, bet datu failu neizdevās izveidot — pārbaudi rakstīšanas tiesības.' : `Jauna uzskaite izveidota mapē “${h.name}”`, okSave === false ? 'warn' : 'ok', 8000);
    }
    S.boot = { step: 'index', name: h.name, count: 0 };      // dati jau redzami; dokumenti indeksējas fonā
    S.page = 'dashboard'; CP.render();
    await store.scanAll();
    S.boot = null; CP.render();
    for (const f of CP.afterRootLoad || []) { try { f(); } catch (e) { console.error(e); } }
    await CP.notices?.();
  };
  /* --- Starts: atcerētās mapes pārbaude ar progresu (S.boot) --- */
  const boot = (o) => { S.boot = o ? { ...(S.boot || {}), ...o } : null; CP.render(); };
  store.bootStep = (pct, msg) => { if (S.boot && !S.boot.error) { S.boot.pct = pct; S.boot.msg = msg; S.boot.detail = ''; CP.render(); } };
  /** Gaida solījumu; pēc 8 s parāda “tīkla mape atbild lēni”, pēc 90 s atsakās. */
  function slow(pr, label) {
    let t1, t2;
    return Promise.race([
      pr,
      new Promise((_, rej) => {
        t1 = setTimeout(() => { if (S.boot && !S.boot.error) { S.boot.detail = 'Mape atbild lēni (tīkla disks vai zibatmiņa). Lūdzu, uzgaidi…'; CP.render(); } }, 8000);
        t2 = setTimeout(() => rej(Object.assign(Error(label + ' neatbildēja 90 sekundēs'), { name: 'TimeoutError' })), 90000);
      })
    ]).finally(() => { clearTimeout(t1); clearTimeout(t2); });
  }
  function bootFail(kind, h, e) {
    const name = h?.name || S.boot?.name || 'datu mape';
    const T = {
      gone: { title: `Datu mapi “${name}” neizdevās atrast`, hints: ['Pārbaudi, vai mape nav pārdēvēta, pārvietota vai izdzēsta.', 'Ja mape ir tīklā vai zibatmiņā — pārbaudi tīkla savienojumu vai ievieto zibatmiņu un spied “Mēģināt vēlreiz”.', 'Ja mape tagad ir citur — ievelc to šeit vai izvēlies no jauna. Dati un dokumentu saites saglabāsies.'] },
      nodata: { title: `Mapē “${name}” nav datu faila`, hints: [`Mapē nav faila ${CP.DATAFILE}. Varbūt tas pārvietots vai pārdēvēts?`, 'Ja izvēlēta nepareiza mape — izvēlies pareizo vai ievelc to šeit.', 'Ja šī tiešām ir jauna mape — spied “Sākt jaunu uzskaiti šeit”.'] },
      timeout: { title: `Mape “${name}” neatbild`, hints: ['Tīkla disks vai zibatmiņa nav pieejama vai ļoti lēna.', 'Pārbaudi savienojumu un spied “Mēģināt vēlreiz”.'] },
      other: { title: `Datu mapi “${name}” neizdevās atvērt`, hints: ['Spied “Mēģināt vēlreiz”. Ja neizdodas — izvēlies mapi no jauna vai ievelc to šeit.', 'Kļūdas tekstu vari nosūtīt atbalstam.'] }
    }[kind];
    S.bootHandle = h || null;
    note('starts', kind, e || null);
    boot({ error: kind, title: T.title, hints: T.hints, errText: e ? errText(e) : '', pct: 100 });
  }
  store.tryRestore = async () => {
    boot({ step: 'idb', pct: 5, msg: 'Meklē atcerēto datu mapi…', error: null, detail: '' });
    let h = null;
    try { h = await store.idbGet('root'); }
    catch (e) { bootFail('other', null, e); return; }
    if (!h) { boot(null); return; }
    S.boot.name = h.name;
    store.bootStep(15, `Pārbauda piekļuvi mapei “${h.name}”…`);
    let perm = 'prompt';
    try { perm = h.queryPermission ? await slow(h.queryPermission({ mode: 'readwrite' }), 'Atļauju pārbaude') : 'granted'; }
    catch (e) { if (e.name === 'TimeoutError') return bootFail('timeout', h, e); perm = 'prompt'; }
    if (perm !== 'granted') { S.pendingRoot = h; boot(null); return; }   // Chrome prasa apstiprinājumu — poga “Atļaut piekļuvi”
    store.bootStep(30, `Pārbauda, vai mape “${h.name}” ir pieejama…`);
    try { await slow(h.getFileHandle(CP.DATAFILE), 'Mape'); }
    catch (e) {
      if (e.name === 'TimeoutError') return bootFail('timeout', h, e);
      if (e.name !== 'NotFoundError') return bootFail('other', h, e);
      // nav faila VAI nav pašas mapes — pārbauda mapi
      try { const it = h.values(); await slow(it.next(), 'Mape'); return bootFail('nodata', h, null); }
      catch (e2) { return bootFail(e2.name === 'TimeoutError' ? 'timeout' : 'gone', h, e2); }
    }
    try { await store.loadRoot(h); }
    catch (e) { bootFail(e.name === 'TimeoutError' ? 'timeout' : 'other', h, e); }
  };
  store.retryRestore = () => { S.bootHandle = null; return store.tryRestore(); };
  store.bootNew = async () => {
    const h = S.bootHandle; if (!h) return;
    if (!confirm(`Sākt jaunu, tukšu uzskaiti mapē “${h.name}”?\n\nEsošie faili netiks dzēsti. Datu fails tiks izveidots pēc pirmās izmaiņas.`)) return;
    boot({ error: null, pct: 40, msg: 'Sagatavo jaunu uzskaiti…' });
    await store.loadRoot(h);
  };
  store.restoreRoot = () => {
    const h = S.pendingRoot; if (!h) return;
    let pr;
    try { pr = h.requestPermission({ mode: 'readwrite' }); }       // sinhroni klikšķī
    catch (e) { note('atjaunošana', 'requestPermission', e); CP.ui.toast('Atļauju neizdevās pieprasīt: ' + errText(e), 'err', 12000); return; }
    return pr.then(async perm => {
      if (perm === 'granted') await store.connectRoot(h, S.pendingVia || 'atjaunošana');
      else { note('atjaunošana', 'requestPermission', Error(perm)); CP.ui.toast('Piekļuve mapei netika atļauta. Dati nav ielādēti. Mēģini vēlreiz vai ievelc mapi no File Explorer.', 'warn', 12000); }
    }, e => {
      note('atjaunošana', 'requestPermission', e);
      CP.ui.toast(ctxErr(e) ? 'Chrome neļauj šeit pieprasīt atļauju (' + errText(e) + '). ' + (store.netPath ? store.netPathMsg() : 'Atver index.html tieši Chrome cilnē (ne iegultā logā) no lokālas mapes.') : (e.name === 'NotFoundError' ? 'Atcerētā mape vairs nav atrodama (pārdēvēta, pārvietota vai tīkla disks nav pieejams). Ievelc mapi no jauna.' : 'Atļauju neizdevās saņemt: ' + errText(e)), 'err', 30000);
    });
  };

  async function restoreSources() {
    const metas = S.db.sources || [];
    let map = {};
    try { map = (await store.idbGet('sources')) || {}; }
    catch (e) { CP.ui.toast('Papildu mapju sarakstu neizdevās nolasīt: ' + e.message, 'warn', 10000); }
    for (const meta of metas) {
      if (!meta?.id) continue;
      const handle = map[meta.id] || null;
      let perm = 'denied';
      if (handle?.queryPermission) {
        try { perm = await handle.queryPermission({ mode: 'read' }); }
        catch (e) { perm = 'denied'; }
      }
      S.roots.push({
        id: meta.id, name: meta.name || handle?.name || 'Mape',
        handle: perm === 'granted' ? handle : null,
        pending: handle && perm !== 'granted' ? handle : null,
        ok: perm === 'granted'
      });
    }
  }
  async function saveSourceHandle(id, handle) {
    const map = (await store.idbGet('sources')) || {};
    map[id] = handle;
    await store.idbSet('sources', map);
  }
  function upsertRoot(id, handle, ok) {
    const row = S.roots.find(r => r.id === id);
    const next = { id, name: handle.name, handle: ok ? handle : null, pending: ok ? null : handle, ok };
    if (row) Object.assign(row, next);
    else S.roots.push(next);
  }
  async function matchSource(handle) {
    let map = {};
    try { map = (await store.idbGet('sources')) || {}; } catch (e) { map = {}; }
    for (const meta of S.db.sources || []) {
      const known = S.roots.find(r => r.id === meta.id)?.handle || S.roots.find(r => r.id === meta.id)?.pending || map[meta.id];
      if (!known?.isSameEntry) continue;
      try { if (await known.isSameEntry(handle)) return meta; } catch (e) { /* salīdzinājums neizdevās — nesaista pēc nosaukuma */ }
    }
    return null;
  }

  /* --- Failu indekss (tikai nosaukumi un ceļi, saturs netiek lasīts) --- */
  store.scanAll = async () => {
    const out = [];
    for (const s of S.roots) {
      if (!s.handle) continue;
      try { await walk(s.handle, '', s, 0, out); }
      catch (e) { CP.ui.toast('Nevar nolasīt mapi ' + s.name + ': ' + e.message, 'err'); }
    }
    S.index = out; CP.render();
  };
  function bootCount(n) {
    if (S.boot?.step !== 'index') return;
    S.boot.count = n;
    const el = document.getElementById('bootIdxN'); if (el) el.textContent = n;
  }
  async function walk(folder, path, src, depth, out) {
    if (depth > 32 || out.length > 20000) return;
    for await (const [name, h] of folder.entries()) {
      if (name.startsWith('.') || name.startsWith('~$') || name === '_rezerves' || name === '_arhivi' || name === '_atjaunosana' || name.endsWith('.raksta')) continue;
      const rel = path ? path + '/' + name : name;
      if (h.kind === 'directory') await walk(h, rel, src, depth + 1, out);
      else if (name !== CP.DATAFILE) {
        out.push({ sourceId: src.id, sourceName: src.name, path: rel, name, handle: h, ext: (name.split('.').pop() || '').toLowerCase(), n: U.norm(rel) });
        if (out.length % 25 === 0) bootCount(out.length);
      }
    }
  }
  store.addExtra = async () => {
    if (!S.root) return CP.ui.toast('Vispirms izvēlies datu mapi — mapes identifikators jāsaglabā datu failā', 'warn');
    try {
      const h = await showDirectoryPicker({ id: 'cadet-external', mode: 'read' });
      if (S.root.isSameEntry && await S.root.isSameEntry(h)) return CP.ui.toast('Šī jau ir atvērtā datu mape', 'warn');
      const existing = await matchSource(h);
      if (existing) {
        existing.name = h.name;
        await saveSourceHandle(existing.id, h);
        upsertRoot(existing.id, h, true);
        store.changed();
        await store.scanAll();
        CP.ui.toast('Pieslēgta jau reģistrētā mape “' + h.name + '”', 'ok');
        return;
      }
      const meta = { id: 'src_' + U.uid().replace(/-/g, '').slice(0, 12), name: h.name, addedAt: U.now() };
      S.db.sources.push(meta);
      await saveSourceHandle(meta.id, h);
      upsertRoot(meta.id, h, true);
      store.changed();
      await store.scanAll();
      CP.ui.toast('Papildu mape reģistrēta. Pēc pārlūka aizvēršanas to pieslēdz ar pogu “Pieslēgt”, ja Chrome to prasa.', 'ok', 9000);
    } catch (e) {
      if (e.name !== 'AbortError') CP.ui.toast('Papildu mapi neizdevās pievienot: ' + e.message, 'err');
    }
  };
  store.reconnectSource = async id => {
    const meta = (S.db.sources || []).find(s => s.id === id);
    if (!meta) return;
    const row = S.roots.find(r => r.id === id);
    if (row?.pending) {
      try {
        if (await row.pending.requestPermission({ mode: 'read' }) === 'granted') {
          row.handle = row.pending; row.ok = true; row.pending = null;
          await store.scanAll();
          CP.ui.toast('Mape pieslēgta: ' + meta.name, 'ok');
        } else CP.ui.toast('Piekļuve mapei netika atļauta. Dokumentu saites ir saglabātas, bet mape nav pieejama.', 'warn', 9000);
      } catch (e) { CP.ui.toast(e.message, 'err'); }
      return;
    }
    try {
      const h = await showDirectoryPicker({ mode: 'read' });
      const other = await matchSource(h);
      if (other && other.id !== id) { CP.ui.toast('Šī mape jau ir reģistrēta kā “' + other.name + '”. Otrs avots netika veidots.', 'warn', 9000); return; }
      if (other && other.id === id) {
        await saveSourceHandle(id, h);
        upsertRoot(id, h, true);
        await store.scanAll();
        CP.ui.toast('Mape pieslēgta: ' + h.name, 'ok');
        return;
      }
      if (!confirm(`Piesaistīt izvēlēto mapi “${h.name}” avotam “${meta.name}”?\n\nVienāds nosaukums nenozīmē, ka tā ir tā pati mape. Apstiprini tikai tad, ja zini, ka tā ir.`)) return;
      meta.name = h.name;
      await saveSourceHandle(id, h);
      upsertRoot(id, h, true);
      store.changed();
      await store.scanAll();
      CP.ui.toast('Mape piesaistīta avotam “' + meta.name + '”', 'ok');
    } catch (e) { if (e.name !== 'AbortError') CP.ui.toast(e.message, 'err'); }
  };

  store.handleFor = async (path, sourceId) => {
    const sid = sourceId || 'main';
    if (String(sid).startsWith('fails:')) {
      try { return await store.idbGet('doc:' + sid.slice(6)); } catch (e) { return null; }
    }
    const item = S.index.find(f => f.path === path && f.sourceId === sid);
    if (item) return item.handle;
    const src = S.roots.find(r => r.id === sid);
    if (!src?.handle) return null;
    try {
      const parts = path.split('/').filter(Boolean); let h = src.handle;
      for (let i = 0; i < parts.length - 1; i++) h = await h.getDirectoryHandle(parts[i]);
      return await h.getFileHandle(parts.at(-1));
    } catch (e) { return null; }
  };
  store.rememberDocHandle = async (id, handle) => { await store.idbSet('doc:' + id, handle); };

  function compareMeta(d, file) {
    if (d.sha256 && d.size != null && file.size === d.size && d.modified && file.lastModified === d.modified) return { state: 'available', detail: 'Pārbaudīts' };
    if (d.sha256 && (file.size !== d.size || (d.modified && file.lastModified !== d.modified))) return { state: 'check', detail: 'Metadati mainījušies — jāpārbauda saturs' };
    return { state: 'check', detail: d.sha256 ? 'Jāpārbauda' : 'Vēl nav pārbaudīta kontrolsumma' };
  }
  store.probeDoc = async d => {
    if (!d?.path) return null;
    const sid = d.sourceId || 'main';
    if (String(sid).startsWith('fails:')) {
      let h = null;
      try { h = await store.idbGet('doc:' + d.id); } catch (e) { return { state: 'noaccess', detail: 'Faila rokturi neizdevās nolasīt' }; }
      if (!h) return { state: 'noaccess', detail: 'Tiešā faila atļauja nav saglabāta' };
      try {
        if (h.queryPermission && await h.queryPermission({ mode: 'read' }) !== 'granted') return { state: 'noaccess', detail: 'Jāatjauno atļauja failam' };
        return compareMeta(d, await h.getFile());
      } catch (e) { return { state: 'missing', detail: 'Fails nav atverams' }; }
    }
    const src = S.roots.find(r => r.id === sid);
    if (sid !== 'main' && (!src || !src.ok)) return { state: 'noaccess', detail: 'Dokumenta mape nav pieslēgta' };
    if (!S.root && sid === 'main') return { state: 'noaccess', detail: 'Datu mape nav pieslēgta' };
    const h = await store.handleFor(d.path, sid);
    if (!h) {
      const base = d.path.split('/').pop();
      const moved = S.index.find(f => f.sourceId === sid && f.name === base && f.path !== d.path);
      if (moved) return { state: 'missing', detail: 'Pārvietots: ' + moved.path };
      return { state: 'missing', detail: 'Nav atrasts' };
    }
    try { return compareMeta(d, await h.getFile()); }
    catch (e) { return { state: 'noaccess', detail: e.message }; }
  };
  store.checkDoc = async d => {
    const live = await store.probeDoc(d);
    if (!live) return null;
    if (live.state === 'noaccess') return live;
    if (live.state === 'missing') {
      if (!d.sha256) return live;
      const sid = d.sourceId || 'main';
      const parent = d.path.split('/').slice(0, -1).join('/');
      const candidates = S.index.filter(f => f.sourceId === sid && f.path !== d.path)
        .sort((a, b) => (a.path.startsWith(parent) ? 0 : 1) - (b.path.startsWith(parent) ? 0 : 1));
      let n = 0;
      for (const c of candidates) {
        if (c.path === d.path) continue;
        if (++n > 40) break;
        await new Promise(r => setTimeout(r, 0));
        try {
          const file = await c.handle.getFile();
          if (d.size != null && file.size !== d.size) continue;
          const sha = await U.sha256Blob(file);
          if (sha === d.sha256) {
            const renamed = c.path.split('/').slice(0, -1).join('/') === parent;
            return { state: 'missing', detail: (renamed ? 'Pārdēvēts: ' : 'Pārvietots: ') + c.path };
          }
        } catch (e) { /* kandidātu izlaižam */ }
      }
      return live;
    }
    const h = await store.handleFor(d.path, d.sourceId || 'main');
    if (!h) return live;
    const file = await h.getFile();
    const sha = await U.sha256Blob(file);
    if (!d.sha256 || sha === d.sha256) {
      return { state: 'available', detail: d.sha256 ? 'Saturs sakrīt' : 'Kontrolsumma saglabāta', sha256: sha, size: file.size, modified: file.lastModified, baseline: !d.sha256 };
    }
    return { state: 'check', detail: 'Saturs mainījies', sha256: sha, size: file.size, modified: file.lastModified, changed: true };
  };

  /** Ieraksta failu datu mapē, nekad nepārrakstot esošu (pievieno (2), (3)…). Atgriež relatīvo ceļu vai null, ja lietotājs atceļ. */
  store.saveFile = async (dirParts, fileName, blob, opts = {}) => {
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    let dir = S.root; for (const d of dirParts) dir = await dir.getDirectoryHandle(d.replace(/[\\/:*?"<>|]/g, '_'), { create: true });
    const clean = fileName.replace(/[\\/:*?"<>|]/g, '_'), dot = clean.lastIndexOf('.');
    const base = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : '';
    let occupied = false;
    try { await dir.getFileHandle(clean); occupied = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
    if (occupied && opts.confirmConflict && !confirm(`“${clean}” jau ir šajā mapē. Saglabāt kā jaunu kopiju ar citu nosaukumu? Esošais fails netiks pārrakstīts.`)) return null;
    let name = clean, i = 2;
    for (;;) { try { await dir.getFileHandle(name); name = `${base} (${i++})${ext}`; } catch (e) { if (e.name === 'NotFoundError') break; throw e; } }
    const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(blob); await w.close();
    const written = await fh.getFile();
    if (blob.size != null && written.size !== blob.size) throw Error('ierakstītais fails nav pilnīgs');
    const path = [...dirParts.map(d => d.replace(/[\\/:*?"<>|]/g, '_')), name].join('/');
    S.index.push({ sourceId: 'main', sourceName: S.rootName, path, name, handle: fh, ext: ext.slice(1).toLowerCase(), n: U.norm(path) });
    return path;
  };
  function pathSegments(rel) {
    const parts = String(rel || '').split('/').filter(Boolean);
    if (parts.some(p => p === '.' || p === '..' || /[\\:*?"<>|]/.test(p))) throw Error('nederīgs ceļš');
    return parts;
  }
  function within(rootParts, parts) {
    return parts.length >= rootParts.length && rootParts.every((p, i) => parts[i] === p);
  }
  async function openDir(parts, create) {
    if (!S.root) throw Error('nav datu mapes');
    let dir = S.root;
    for (const part of parts) {
      if (part === '.' || part === '..') throw Error('nederīgs ceļš');
      dir = await dir.getDirectoryHandle(part, { create: !!create });
    }
    return dir;
  }
  /** Mācību gada personas mape. Vecās mapes un saites netiek pārvietotas. */
  store.yearPersonDir = (p, yearId = CP.data.activeYear()) => {
    store.assignFolder(p);
    const label = p.folderLabel || store.folderSlug(p);
    return ['Macibu_gadi', yearId, 'Personas', `${p.folderId}_${label}`];
  };
  store.ensurePersonYearFolder = async (p, yearId) => {
    if (!S.root || !p) return null;
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    const parts = store.yearPersonDir(p, yearId || CP.data.activeYear());
    await openDir(parts, true);
    return parts;
  };
  store.listLevel = async parts => {
    const dir = await openDir(parts, false);
    const rows = [];
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith('.') || name === CP.DATAFILE) continue;
      if (h.kind === 'directory') rows.push({ name, kind: 'dir' });
      else {
        let size = null;
        try { size = (await h.getFile()).size; } catch (e) { size = null; }
        rows.push({ name, kind: 'file', size, ext: (name.split('.').pop() || '').toLowerCase() });
      }
    }
    rows.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'lv') : (a.kind === 'dir' ? -1 : 1)));
    return rows;
  };
  store.listFolders = async (rootParts, maxDepth = 30) => {
    const out = [''];
    const walkDirs = async (rel, depth) => {
      if (depth > maxDepth) return;
      let dir;
      try { dir = await openDir([...rootParts, ...pathSegments(rel)], false); } catch (e) { return; }
      for await (const [name, h] of dir.entries()) {
        if (h.kind !== 'directory' || name.startsWith('.')) continue;
        const child = rel ? rel + '/' + name : name;
        out.push(child);
        await walkDirs(child, depth + 1);
      }
    };
    await walkDirs('', 0);
    return out;
  };
  /** Meklē tikai nosaukumus un ceļus. Failu saturs netiek lasīts, izmērs ir metadati. */
  store.searchNames = async (rootParts, q, maxDepth = 30) => {
    const nq = U.norm(q);
    const hits = [];
    const walkNames = async (rel, depth) => {
      if (depth > maxDepth || hits.length > 200) return;
      let dir;
      try { dir = await openDir([...rootParts, ...pathSegments(rel)], false); } catch (e) { return; }
      for await (const [name, h] of dir.entries()) {
        if (name.startsWith('.') || hits.length > 200) continue;
        const child = rel ? rel + '/' + name : name;
        const match = !nq || U.norm(name).includes(nq) || U.norm(child).includes(nq);
        if (h.kind === 'directory') {
          if (match && nq) hits.push({ name, rel: child, kind: 'dir' });
          await walkNames(child, depth + 1);
        } else if (match) {
          let size = null;
          try { size = (await h.getFile()).size; } catch (e) { size = null; }
          hits.push({ name, rel: child, kind: 'file', size, ext: (name.split('.').pop() || '').toLowerCase() });
        }
      }
    };
    await walkNames('', 0);
    return hits;
  };
  store.makeSubdir = async (rootParts, parentRel, folderName) => {
    const raw = String(folderName || '').trim();
    if (!raw || /[\\/]/.test(raw) || raw === '.' || raw === '..') throw Error('norādi vienu mapes nosaukumu');
    const name = raw.replace(/[\\/:*?"<>|]/g, '_');
    const parent = [...rootParts, ...pathSegments(parentRel)];
    if (!within(rootParts, parent)) throw Error('mape ir ārpus personas mapes');
    const dir = await openDir(parent, false);
    try { await dir.getDirectoryHandle(name); throw Error('šāda mape jau ir'); } catch (e) { if (e.message === 'šāda mape jau ir') throw e; if (e.name !== 'NotFoundError') throw e; }
    try { await dir.getFileHandle(name); throw Error('fails ar šādu nosaukumu jau ir'); } catch (e) { if (e.message === 'fails ar šādu nosaukumu jau ir') throw e; if (e.name !== 'NotFoundError') throw e; }
    await dir.getDirectoryHandle(name, { create: true });
    return (pathSegments(parentRel).concat(name)).join('/');
  };
  /**
   * Pārdēvē vai pārvieto tikai personas mapes iekšienē.
   * Lieto pārlūka move(). Ja tas nav pieejams, neko nemaina.
   * Pēc move pārbauda, ka galamērķis ir nolasāms un faila izmērs sakrīt. Nekas netiek dzēsts papildus.
   */
  store.relocate = async (rootParts, fromRel, toDirRel, newName) => {
    const fromSeg = pathSegments(fromRel);
    if (!fromSeg.length) throw Error('nav ko pārvietot');
    const name = fromSeg.pop();
    const fromParts = [...rootParts, ...fromSeg];
    const destParts = [...rootParts, ...pathSegments(toDirRel)];
    if (!within(rootParts, fromParts) || !within(rootParts, destParts)) throw Error('darbība ir ārpus personas mapes');
    const target = String(newName || name).trim();
    if (!target || /[\\/]/.test(target) || target === '.' || target === '..') throw Error('nederīgs nosaukums');
    const fromFull = [...fromParts, name].join('/');
    const destFull = destParts.join('/');
    if (destFull === fromFull || destFull.startsWith(fromFull + '/')) throw Error('mapi nevar ievietot sevī');
    const srcDir = await openDir(fromParts, false);
    const destDir = await openDir(destParts, false);
    let handle;
    try { handle = await srcDir.getFileHandle(name); }
    catch (e) {
      if (e.name !== 'NotFoundError') throw e;
      handle = await srcDir.getDirectoryHandle(name);
    }
    const canMove = typeof handle.move === 'function';
    if (!canMove && handle.kind !== 'file') throw Error('Šis pārlūks neļauj pārvietot mapes. Mape paliek savā vietā.');
    const samePlace = await srcDir.isSameEntry(destDir);
    if (!(samePlace && target === name)) {
      let clash = false;
      try { await destDir.getFileHandle(target); clash = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (!clash) try { await destDir.getDirectoryHandle(target); clash = true; } catch (e) { if (e.name !== 'NotFoundError') throw e; }
      if (clash) throw Error('šāds nosaukums jau ir — esošais fails netika pārrakstīts');
    }
    let sizeBefore = null;
    if (handle.kind === 'file') sizeBefore = (await handle.getFile()).size;
    if (!(samePlace && target === name)) {
      let moved = false;
      if (canMove) {
        try { if (samePlace) await handle.move(target); else await handle.move(destDir, target); moved = true; }
        catch (e) { if (handle.kind !== 'file' || samePlace) throw Error(samePlace ? 'Chrome neļauj pārdēvēt šo failu. Dokuments paliek savā vietā.' : 'Chrome neļauj pārvietot šo mapi. Mape paliek savā vietā.'); }
      }
      if (!moved) {
        // Chrome dažās mapēs atsaka move(): kopē uz jauno vietu, pārbauda saturu un tikai tad noņem veco vietu
        const src = await handle.getFile(), sha = await U.sha256Blob(src);
        const fh = await destDir.getFileHandle(target, { create: true }), w = await fh.createWritable(); await w.write(src); await w.close();
        const copy = await fh.getFile();
        if (copy.size !== src.size || await U.sha256Blob(copy) !== sha) {
          try { await destDir.removeEntry(target); } catch (e) { }
          throw Error('kopija jaunajā vietā nesakrīt ar oriģinālu. Fails paliek vecajā vietā.');
        }
        try { await srcDir.removeEntry(name); }
        catch (e) { return { from: fromFull, path: [...destParts, target].join('/'), kind: 'file', copied: true }; }
      }
    }
    let next;
    try { next = handle.kind === 'file' ? await destDir.getFileHandle(target) : await destDir.getDirectoryHandle(target); }
    catch (e) { throw Error('galamērķis pēc darbības nav nolasāms. Programma neko papildus nedzēsa.'); }
    if (handle.kind === 'file') {
      const f = await next.getFile();
      if (f.size !== sizeBefore) throw Error('faila izmērs pēc pārvietošanas nesakrīt. Programma neko papildus nedzēsa.');
    }
    return { from: fromFull, path: [...destParts, target].join('/'), kind: handle.kind };
  };
  store.reindexDir = async parts => {
    const prefix = parts.join('/');
    S.index = S.index.filter(x => x.sourceId !== 'main' || (x.path !== prefix && !x.path.startsWith(prefix + '/')));
    const src = S.roots.find(r => r.id === 'main');
    if (!src?.handle) return;
    const dir = await openDir(parts, false);
    await walk(dir, prefix, src, parts.length, S.index);
  };
  store.folderSlug = p => {
    const s = `${p?.last || ''}_${p?.first || ''}`.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return s || 'persona';
  };
  /** Jaunai personai piešķir nemainīgu mapes ID. Esošai personai bez ID ceļš netiek mainīts. */
  store.assignFolder = p => {
    if (!p || p.folderId) return p;
    const n = Number(S.db.nextFolderSeq) || 1;
    p.folderId = 'P' + String(n).padStart(6, '0');
    p.folderLabel = store.folderSlug(p);
    S.db.nextFolderSeq = n + 1;
    return p;
  };
  store.personFolder = p => {
    if (p?.folderId) return [U.schoolYear(), 'Personu dokumenti', `${p.folderId}_${p.folderLabel || store.folderSlug(p)}`];
    return [U.schoolYear(), 'Personu dokumenti', `${p?.last || ''} ${p?.first || ''}`.trim() || 'persona'];
  };
  store.ensureYearFolders = async () => {
    if (!S.root) return;
    if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
    const mk = async parts => {
      let dir = S.root;
      for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
      return dir;
    };
    await mk(['Dokumenti']);
    await mk(['Rezerves_kopijas']);
    for (const y of S.db.years || []) {
      for (const sub of ['Dokumenti', 'Pasakumi', 'Atskaites', 'Personas']) await mk(['Macibu_gadi', y.id, sub]);
    }
  };
  store.createYear = async () => {
    if (!S.root) return CP.ui.toast('Vispirms izvēlies datu mapi', 'warn');
    try {
      if (!(await ensurePerm(true))) throw Error('nav rakstīšanas atļaujas');
      const h = await S.root.getDirectoryHandle(U.schoolYear(), { create: true });
      await h.getDirectoryHandle('Personu dokumenti', { create: true });
      await store.scanAll(); CP.ui.toast('Izveidota mape ' + U.schoolYear() + '/Personu dokumenti', 'ok');
    } catch (e) { CP.ui.toast('Neizdevās izveidot: ' + e.message, 'err'); }
  };

  /* --- Brīdinājums, ja programma atvērta vairākās cilnēs --- */
  try {
    const bc = new BroadcastChannel('cadet-personals' + (CP.CHANNEL === 'test' ? '-test' : ''));
    bc.onmessage = e => {
      if (e.data === 'hello') bc.postMessage('here');
      if (e.data === 'here') CP.ui.toast('Programma ir atvērta arī citā cilnē. Strādā tikai vienā, lai izmaiņas nepārrakstītu viena otru.', 'warn', 12000);
    };
    setTimeout(() => bc.postMessage('hello'), 500);
  } catch (e) { CP.ui?.toast?.('Vairāku ciļņu brīdinājums nav pieejams šajā pārlūkā', 'warn'); }

  CP.store = store;
})(window.CP);
