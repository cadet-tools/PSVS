/* =====================================================================
   Datu glabāšanas termiņi.
   • Katrai datu grupai ir termiņš (mēneši) un darbība. Noklusējumi izriet no VDAR principiem un Latvijas
     likumiem; instruktors tos var mainīt Iestatījumos (settings.retention, izstājušos — settings.retentionDefault).
   • Rīks NEKO nedzēš pats: lapā “Glabāšanas termiņi” parāda, kam termiņš beidzies, un izpilda tikai
     instruktora atlasīto un apstiprināto (anonimizēt / dzēst ierakstu / dzēst failus mapē).
   • Izņēmums: darbību žurnāla vecie ieraksti tiek dzēsti automātiski katrā saglabāšanā (changelog.js).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const COMMS = new Set(['whatsapp', 'sms', 'email', 'call']);
  const isMed = kind => /ārsta|izziņ|medic|veselīb/i.test(kind || '');
  const KEEP_BACKUPS = 10;

  const CATS = [
    { k: 'left', l: 'Izstājušies jaunsargi', from: 'pēc izstāšanās', acts: [['anon', 'Anonimizēt'], ['erase', 'Dzēst pilnībā']],
      what: 'Kartīte: vārds, personas kods, kontakti, adreses, vecāku un ārkārtas kontakti, piezīmes, dokumentu un līgumu ieraksti, saziņas vēsture, uzdevumi.',
      basis: 'Latvijas normatīvie akti jaunsargu datu glabāšanai konkrētu termiņu nenosaka, tāpēc darbojas VDAR 5. panta 1. punkta e) apakšpunkts — datus glabā tikai tik ilgi, cik vajag mērķim. Anketas un līguma oriģināli glabājas Centra arhīvā, tāpēc instruktora kopijai pietiek ar laiku ekipējuma atdošanai, jautājumiem un iespējamai atgriešanās nākamajā mācību gadā. Anonimizējot paliek tikai statistika: dalība mācību gados, apmeklējums, VFS rezultāti, kvalifikācijas un ekipējuma uzskaite bez vārda (valsts mantas uzskaites attaisnojuma dokumentus Grāmatvedības likums liek glabāt ne mazāk kā 5 gadus).' },
    { k: 'cand', l: 'Kandidāti, kas neiestājās', from: 'pēc pēdējām izmaiņām', acts: [['erase', 'Dzēst']],
      what: 'Kandidāta kartīte ar visiem datiem.',
      basis: 'VDAR 5. panta 1. punkta c) un e) apakšpunkts — datu minimizēšana un glabāšanas ierobežojums. Ja līgums par dalību Jaunsardzē netika noslēgts, datu vākšanas mērķis ir beidzies.' },
    { k: 'med', l: 'Ārsta izziņas', from: 'pēc derīguma beigām', acts: [['erase', 'Dzēst']],
      what: 'Izziņas ieraksts un fails mapē. Dokumenta veids ar “ārsta” vai “izziņa” nosaukumā.',
      basis: 'Veselības dati ir īpašas kategorijas personas dati (VDAR 9. pants). Izziņa vajadzīga tikai tās derīguma laikā; pēc tam to glabāt nav pamata. Neliela rezerve — iespējamiem jautājumiem par notikušo.' },
    { k: 'comms', l: 'Saziņas vēsture', from: 'pēc nosūtīšanas', acts: [['erase', 'Dzēst']],
      what: 'WhatsApp, SMS, e-pasta un zvanu ieraksti personas vēsturē (ar ziņas tekstu). Piezīmes netiek skartas.',
      basis: 'VDAR 5. panta 1. punkta e) apakšpunkts. Saziņas ieraksti palīdz atcerēties, kas un kad paziņots; pēc diviem mācību gadiem tie parasti vairs nav vajadzīgi.' },
    { k: 'ext', l: 'Citu vienību dalībnieki pasākumos', from: 'pēc pasākuma', acts: [['erase', 'Dzēst']],
      what: 'Pasākumā ievilkto citu vienību jaunsargu un darbinieku dati (arī personas kodi). Pats pasākums un tavi dalībnieki paliek.',
      basis: 'Citu vienību dati saņemti tikai konkrētam pasākumam (instruktāžai, nometnes žurnālam). VDAR 5. panta 1. punkta b) un e) apakšpunkts — tos neizmanto citam mērķim un neglabā ilgāk par vajadzīgo.' },
    { k: 'backups', l: 'JSON rezerves kopijas', from: 'pēc izveides', acts: [['erase', 'Dzēst']],
      what: `Faili mapē _rezerves. Vienmēr paliek ${KEEP_BACKUPS} jaunākās kopijas.`,
      basis: 'Rezerves kopijās ir visi dati — arī jau dzēsto un anonimizēto personu dati. Lai termiņi darbotos, kopijas jāglabā ne ilgāk kā izstājušos jaunsargu datus. Šifrētā rezerves kopija (dators / Google Drive) satur tikai pašreizējos datus un atjaunojas pati.' },
    { k: 'changelog', l: 'Darbību žurnāls', from: 'pēc ieraksta', acts: [['auto', 'Dzēst automātiski']], auto: true,
      what: 'Žurnāla ieraksti ar vecajām vērtībām (vārdi, kontakti).',
      basis: 'VDAR 5. panta 1. punkta e) apakšpunkts. Vecāki ieraksti tiek dzēsti automātiski katrā saglabāšanā — tos nevajag apstiprināt.' }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.k, c]));
  const DEF = () => CP.defaultSettings().retention;

  /** Kategorijas iestatījums: { m, on, act } */
  function cfg(k) {
    const s = S.db.settings, d = DEF()[k] || {}, r = { ...d, ...((s.retention || {})[k] || {}) };
    if (k === 'left') r.m = Number(s.retentionDefault ?? d.m);
    r.m = Math.max(0, Number(r.m) || 0);
    return r;
  }
  const later = (a, b) => (a && b ? (a > b ? a : b) : a || b || '');
  const day = s => String(s || '').slice(0, 10);
  const plural = (n, one, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`;

  /* ---------------- Kas ir jāpārskata ---------------- */
  function personFiles(p) {
    const out = D.docsOf(p).filter(d => d.path).map(d => ({ path: d.path, sourceId: d.sourceId || 'main' }));
    for (const c of p.contracts || []) for (const v of [c, ...(c.versions || [])]) if (v.path) out.push({ path: v.path, sourceId: 'main' });
    return out;
  }
  function isCandidate(p) {
    if (p.status === 'archived' || p.anon) return false;
    const en = D.enrollmentsOf(p.id);
    return en.length ? en.every(e => e.status === 'candidate') : p.status === 'candidate';
  }
  /** Visi ieraksti ar termiņu (arī vēl nebeigušos). Rezerves kopijas — tikai, ja tās jau nolasītas (loadBackups). */
  function items() {
    const db = S.db, out = [];
    let c = cfg('left');
    if (c.on) for (const p of db.people) if (p.status === 'archived' && !p.anon) {
      const base = day(p.left || p.archiveSnapshot?.at || p.updatedAt);
      if (!base) continue;
      const m = Number(p.retentionMonths ?? c.m), eq = D.openEquipment(p).length;
      out.push({ cat: 'left', key: 'left:' + p.id, id: p.id, pid: p.id, act: c.act, due: later(U.addMonths(base, m), p.keepUntil),
        label: U.full(p), sub: [`izstājies ${U.fmtDate(base)}`, `${m} mēn.`, p.retentionMonths != null && Number(p.retentionMonths) !== c.m ? 'personai savs termiņš' : '', eq ? `⚠ nav atdots ekipējums (${eq})` : ''].filter(Boolean).join(' · '),
        files: personFiles(p) });
    }
    c = cfg('cand');
    if (c.on) for (const p of db.people) if (isCandidate(p)) {
      const base = day(p.updatedAt || p.createdAt); if (!base) continue;
      out.push({ cat: 'cand', key: 'cand:' + p.id, id: p.id, pid: p.id, act: 'erase', due: later(U.addMonths(base, c.m), p.keepUntil), label: U.full(p), sub: `pēdējās izmaiņas ${U.fmtDate(base)}`, files: personFiles(p) });
    }
    c = cfg('med');
    if (c.on) for (const d of db.documents) if (isMed(d.kind)) {
      const p = D.person(d.personId); if (!p || p.anon) continue;
      const exp = D.docExpiry(d); if (!exp) continue;
      out.push({ cat: 'med', key: 'med:' + d.id, id: d.id, pid: p.id, act: 'erase', due: later(U.addMonths(exp, c.m), d.keepUntil), label: `${U.full(p)} — ${d.kind}`, sub: `derīga līdz ${U.fmtDate(exp)}`, files: d.path ? [{ path: d.path, sourceId: d.sourceId || 'main' }] : [] });
    }
    c = cfg('comms');
    if (c.on) {
      const by = new Map();
      for (const l of db.log) if (COMMS.has(l.type) && l.at) {
        const due = U.addMonths(day(l.at), c.m); if (!by.has(l.personId)) by.set(l.personId, []); by.get(l.personId).push({ l, due });
      }
      for (const [pid, rows] of by) {
        const p = D.person(pid), first = rows.reduce((a, b) => (a.due < b.due ? a : b));
        const hold = p?.commsKeepUntil || '';
        const ready = rows.filter(r => later(r.due, hold) <= U.iso());
        out.push({ cat: 'comms', key: 'comms:' + pid, id: pid, pid: p ? pid : '', act: 'erase', due: later(first.due, hold), label: p ? U.full(p) : '(persona dzēsta)',
          sub: ready.length ? `${plural(ready.length, 'ieraksts', 'ieraksti')} vecāki par ${c.m} mēn.` : `vecākais ${U.fmtDate(day(first.l.at))}`, n: ready.length, files: [] });
      }
    }
    c = cfg('ext');
    if (c.on) for (const ev of db.events || []) if ((ev.external || []).length || (ev.extStaff || []).length) {
      const base = day(ev.dateTo || ev.dateFrom || ev.instrDate || ev.createdAt); if (!base) continue;
      out.push({ cat: 'ext', key: 'ext:' + ev.id, id: ev.id, act: 'erase', due: later(U.addMonths(base, c.m), ev.extKeepUntil), label: ev.title || '(pasākums bez nosaukuma)',
        sub: `${U.fmtDate(base)} · ${plural((ev.external || []).length, 'dalībnieks', 'dalībnieki')}${(ev.extStaff || []).length ? `, ${plural(ev.extStaff.length, 'darbinieks', 'darbinieki')}` : ''}`, files: [] });
    }
    c = cfg('backups');
    if (c.on && S.retBk?.list) S.retBk.list.slice(KEEP_BACKUPS).forEach(b => {
      out.push({ cat: 'backups', key: 'backups:' + b.name, id: b.name, act: 'erase', due: U.addMonths(U.iso(new Date(b.modified)), c.m), label: b.name, sub: `${U.fmtDateTime(new Date(b.modified).toISOString())} · ${Math.max(1, Math.round(b.size / 1024))} KB`, files: [] });
    });
    return out;
  }
  const dueItems = () => { const t = U.iso(); return items().filter(x => x.due && x.due <= t && (x.cat !== 'comms' || x.n)); };
  async function loadBackups(force) {
    if (!S.root) return;
    if (!force && S.retBk && Date.now() - S.retBk.at < 60000) return;
    try { S.retBk = { at: Date.now(), list: await CP.store.listBackups() }; } catch (e) { S.retBk = { at: Date.now(), list: [], err: e.message }; }
  }

  /* ---------------- Darbības ---------------- */
  /** Anonimizē: paliek tikai statistikai vajadzīgais. Vārds → “Anonimizēts ieraksts P012”. */
  function anonymize(p) {
    const pid = p.id, db = S.db;
    db.documents = db.documents.filter(d => d.personId !== pid);
    db.log = db.log.filter(x => x.personId !== pid);
    db.tasks = db.tasks.filter(x => x.personId !== pid);
    db.relations = db.relations.filter(r => r.a !== pid && r.b !== pid);
    db.audit = db.audit.filter(x => x.personId !== pid);
    const keep = { id: pid, status: 'archived', anon: U.iso(), first: 'Anonimizēts', last: 'ieraksts ' + (p.folderId || pid.slice(0, 6)), folderId: p.folderId,
      gender: p.gender, birthYear: p.birth ? p.birth.slice(0, 4) : p.birthYear, joined: p.joined, left: p.left, quals: p.quals, createdAt: p.createdAt, updatedAt: U.now() };
    for (const k of Object.keys(p)) delete p[k];
    for (const [k, v] of Object.entries(keep)) if (v !== undefined && v !== '' && v !== null) p[k] = v;
    for (const e of db.enrollments || []) if (e.personId === pid) { delete e.noteLog; delete e.note; }
    CP.changelog?.forget(pid, { keep: true });
  }
  function clearExt(ev) {
    const ids = new Set((ev.extStaff || []).map(s => s.id));
    ev.staff = (ev.staff || []).filter(x => !ids.has(x)); ev.external = []; ev.extStaff = []; ev.extRemovedAt = U.iso();
  }
  async function rootFor(sid) {
    const src = (S.roots || []).find(r => r.id === sid);
    return src?.handle || (sid === 'main' ? S.root : null);
  }
  async function writable(h) {
    if (!h?.queryPermission) return !!h;
    if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
    try { return await h.requestPermission({ mode: 'readwrite' }) === 'granted'; } catch (e) { return false; }
  }
  async function delFile(f) {
    const sid = f.sourceId || 'main';
    if (String(sid).startsWith('fails:')) {
      const h = await CP.store.idbGet('doc:' + sid.slice(6)).catch(() => null);
      if (h?.remove && await writable(h)) { await h.remove(); return true; }
      return false;
    }
    const root = await rootFor(sid); if (!root) return false;
    const parts = String(f.path).split('/').filter(Boolean); if (!parts.length || parts.some(x => x === '..' || x === '.')) return false;
    let dir = root; for (const x of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(x);
    await dir.removeEntry(parts.at(-1)); return true;
  }

  /* ---------------- Lapa ---------------- */
  const R = S.ret = S.ret || { sel: new Set(), open: '' };
  CP.pages.retention = {
    render() {
      if (S.root && (!S.retBk || Date.now() - S.retBk.at > 60000)) loadBackups().then(() => { if (S.page === 'retention') CP.render(); });
      const all = items(), today = U.iso(), soonTo = U.addMonths(today, 1);
      const due = all.filter(x => x.due <= today && (x.cat !== 'comms' || x.n)), soon = all.filter(x => x.due > today && x.due <= soonTo);
      const dueKeys = new Set(due.map(x => x.key)); for (const k of [...R.sel]) if (!dueKeys.has(k)) R.sel.delete(k);
      const nSel = R.sel.size;
      const sec = c => {
        const list = due.filter(x => x.cat === c.k), sl = soon.filter(x => x.cat === c.k), cf = cfg(c.k);
        const rule = !cf.on ? 'atgādinājums izslēgts' : `${cf.m} mēn. ${c.from} → ${(c.acts.find(a => a[0] === (cf.act || c.acts[0][0])) || c.acts[0])[1].toLowerCase()}`;
        if (c.auto) return `<section class="card ret-card"><h3>${esc(c.l)} <span class="pill ok">automātiski</span></h3><p class="small muted" style="margin:0">${esc(rule)}. ${esc(c.basis)}</p></section>`;
        const allOn = list.length && list.every(x => R.sel.has(x.key));
        return `<section class="card ret-card"><h3>${list.length ? `<label class="check" style="display:inline-flex"><input type="checkbox" data-retall="${c.k}" ${allOn ? 'checked' : ''} aria-label="Atlasīt visus"></label>` : ''}${esc(c.l)} ${list.length ? `<span class="pill warn">${list.length}</span>` : '<span class="pill ok">✓</span>'}<small class="muted right">${esc(rule)}</small></h3>
          ${list.map(x => `<div class="row ret-row"><label class="check grow"><input type="checkbox" data-retsel="${esc(x.key)}" ${R.sel.has(x.key) ? 'checked' : ''}><span><b>${esc(x.label)}</b><br><small class="muted">${esc(x.sub)} · termiņš ${esc(U.fmtDate(x.due))}${x.files.length ? ` · ${plural(x.files.length, 'fails', 'faili')}` : ''}</small></span></label>
            ${x.pid ? `<button class="sm ghost" data-person="${x.pid}">Atvērt</button>` : ''}${c.k !== 'backups' ? `<button class="sm ghost" data-act="retHold" data-arg="${esc(x.key)}" title="Glabāt vēl 6 mēnešus (piemēram, ja ir neatrisināts jautājums)">+6 mēn.</button>` : ''}</div>`).join('') || `<p class="small muted" style="margin:0">Nav ierakstu ar beigušos termiņu.${sl.length ? ` Mēneša laikā termiņš beigsies: ${sl.length}.` : ''}</p>`}
          ${list.length && sl.length ? `<p class="small muted">Mēneša laikā beigsies vēl: ${sl.length}.</p>` : ''}
          ${c.k === 'backups' && S.retBk?.err ? `<p class="small warn">Rezerves kopijas neizdevās nolasīt: ${esc(S.retBk.err)}</p>` : ''}</section>`;
      };
      return `<div class="page">${ui.pageHead('Glabāšanas termiņi', 'Dati, kuru glabāšanas termiņš beidzies. Nekas netiek dzēsts bez tava apstiprinājuma.', `<button class="sm" data-act="retSettings">${ic('sliders')}Mainīt termiņus</button>`)}
        <section class="card ret-top"><div class="grow">${due.length ? `<b>${plural(due.length, 'ieraksts', 'ieraksti')}</b> ar beigušos termiņu.` : '<b>✓ Visu datu glabāšanas termiņi ir kārtībā.</b>'} <span class="small muted">Atlasi ierakstus un spied “Izpildīt”. Anonimizēšana un dzēšana nav atsaucama.</span></div>
          <button class="mainbtn" data-act="retRun" ${nSel ? '' : 'disabled'}>Izpildīt atlasītos${nSel ? ` (${nSel})` : ''}</button></section>
        ${CATS.map(sec).join('')}
        <p class="small muted">Termiņi ir noklusējumi pēc VDAR un Latvijas likumiem; ja Jaunsardzes centrs vai novads nosaka citus, nomaini tos Iestatījumos. Datu mapes arhīvus (_arhivi) rīks nedzēš — pārskati tos pats.</p></div>`;
    }
  };
  CP.changeHandlers.push(e => {
    const d = e.target.dataset;
    if (d.retsel) { e.target.checked ? R.sel.add(d.retsel) : R.sel.delete(d.retsel); CP.render(); return true; }
    if (d.retall) { const keys = dueItems().filter(x => x.cat === d.retall).map(x => x.key); keys.forEach(k => e.target.checked ? R.sel.add(k) : R.sel.delete(k)); CP.render(); return true; }
    if (d.ret) {
      const [k, f] = d.ret.split(':'), s = S.db.settings; s.retention = { ...DEF(), ...(s.retention || {}) };
      const cur = { ...DEF()[k], ...(s.retention[k] || {}) };
      if (f === 'm') { const v = Math.max(0, Math.min(1200, Math.round(Number(e.target.value) || 0))); if (k === 'left') s.retentionDefault = v || 12; else cur.m = v || DEF()[k].m; }
      else if (f === 'on') cur.on = e.target.checked;
      else if (f === 'act') cur.act = e.target.value;
      s.retention[k] = cur; CP.store.changed(); return true;
    }
    return false;
  });
  A.retSettings = () => CP.ui.goSettingsCard('retCard');
  A.retDefaults = () => {
    if (!confirm('Atjaunot visus glabāšanas termiņus uz noklusējumiem? Personām individuāli iestatītie termiņi paliek.')) return;
    S.db.settings.retention = DEF(); S.db.settings.retentionDefault = DEF().left.m; CP.store.changed(); ui.toast('Atjaunoti noklusētie termiņi', 'ok');
  };
  A.retHold = key => {
    const x = items().find(i => i.key === key); if (!x) return;
    const until = U.addMonths(U.iso(), 6), db = S.db;
    if (x.cat === 'left' || x.cat === 'cand') { const p = D.person(x.id); if (p) p.keepUntil = until; }
    else if (x.cat === 'med') { const d = db.documents.find(y => y.id === x.id); if (d) d.keepUntil = until; }
    else if (x.cat === 'comms') { const p = D.person(x.id); if (p) p.commsKeepUntil = until; else return ui.toast('Persona dzēsta — šos ierakstus var tikai dzēst', 'warn'); }
    else if (x.cat === 'ext') { const ev = (db.events || []).find(y => y.id === x.id); if (ev) ev.extKeepUntil = until; }
    R.sel.delete(key); CP.store.changed(); ui.toast(`Glabāsies līdz ${U.fmtDate(until)}`, 'ok');
  };

  /* --- Izpilde ar apstiprinājumu --- */
  function dlg(html) {
    let d = U.$('retDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'retDialog'; d.className = 'wide'; document.body.appendChild(d); }
    d.innerHTML = html; if (!d.open) d.showModal(); return d;
  }
  A.retRun = () => {
    const sel = dueItems().filter(x => R.sel.has(x.key)); if (!sel.length) return;
    const by = k => sel.filter(x => x.cat === k), files = sel.flatMap(x => x.files);
    const lines = [];
    const left = by('left'), anon = left.filter(x => x.act !== 'erase'), er = left.filter(x => x.act === 'erase');
    if (anon.length) lines.push(`<li><b>Anonimizēt ${plural(anon.length, 'izstājušos jaunsargu', 'izstājušos jaunsargus')}</b> — dzēsīs vārdu, personas kodu, kontaktus, adreses, vecāku datus, piezīmes, dokumentu un līgumu ierakstus, saziņas vēsturi. Paliks dalība mācību gados, apmeklējums, VFS rezultāti, ekipējuma uzskaite (bez vārda).</li>`);
    if (er.length) lines.push(`<li><b>Dzēst pilnībā ${plural(er.length, 'izstājušos jaunsargu', 'izstājušos jaunsargus')}</b> — ar visu vēsturi, apmeklējumu un ekipējuma ierakstiem.</li>`);
    if (by('cand').length) lines.push(`<li><b>Dzēst ${plural(by('cand').length, 'kandidātu', 'kandidātus')}</b>, kas neiestājās.</li>`);
    if (by('med').length) lines.push(`<li><b>Dzēst ${plural(by('med').length, 'ārsta izziņu', 'ārsta izziņas')}</b> (ierakstu).</li>`);
    if (by('comms').length) lines.push(`<li><b>Dzēst ${plural(by('comms').reduce((a, x) => a + x.n, 0), 'saziņas ierakstu', 'saziņas ierakstus')}</b> (${plural(by('comms').length, 'personai', 'personām')}).</li>`);
    if (by('ext').length) lines.push(`<li><b>Dzēst citu vienību dalībniekus</b> ${plural(by('ext').length, 'pasākumā', 'pasākumos')}.</li>`);
    if (by('backups').length) lines.push(`<li><b>Dzēst ${plural(by('backups').length, 'rezerves kopiju', 'rezerves kopijas')}</b> mapē _rezerves.</li>`);
    const eqOpen = left.filter(x => D.openEquipment(D.person(x.id) || {}).length);
    dlg(`<form id="retForm" method="dialog"><header class="dlg-head"><h2>Izpildīt glabāšanas termiņus</h2><button type="button" class="ghost" data-close="retDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><ul>${lines.join('')}</ul>
        ${eqOpen.length ? `<p class="warn small">⚠ ${plural(eqOpen.length, 'personai', 'personām')} nav atdots ekipējums. Ekipējuma ieraksti paliks${er.length ? ' (dzēšot pilnībā — tiks dzēsti)' : ''}, bet vārda vairs nebūs.</p>` : ''}
        ${files.length ? `<label class="check"><input type="checkbox" id="retFiles" checked> Dzēst arī ${plural(files.length, 'saistīto failu', 'saistītos failus')} datu mapē (anketas, līgumi, izziņas)</label>
          <details class="small muted"><summary>Faili</summary>${files.slice(0, 40).map(f => esc(f.path)).join('<br>')}${files.length > 40 ? '<br>…' : ''}</details>
          <p class="small muted">Oriģināli (anketa, līgums) glabājas Centra arhīvā. Ja failu neieķeksē, tas paliek mapē — tad to izdzēs pats.</p>` : ''}
        <p class="small muted">Vecākās JSON rezerves kopijas vēl var saturēt šos datus — tās tiek dzēstas pēc sava termiņa. Šifrētā rezerves kopija atjaunosies nākamajā kopēšanā.</p>
        <label class="check"><input type="checkbox" id="retSure"> Saprotu, ka to nevar atsaukt</label></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="retDialog">Atcelt</button><button type="button" class="mainbtn danger" data-act="retDo">Izpildīt</button></footer></form>`);
  };
  A.retDo = async () => {
    if (!U.$('retSure')?.checked) return ui.toast('Atzīmē “Saprotu, ka to nevar atsaukt”', 'warn');
    const sel = dueItems().filter(x => R.sel.has(x.key)), wantFiles = !!U.$('retFiles')?.checked;
    const files = wantFiles ? sel.flatMap(x => x.files) : [], needBk = sel.some(x => x.cat === 'backups');
    // atļaujas — uzreiz, kamēr klikšķis vēl ir “svaigs”
    const roots = new Set(files.map(f => f.sourceId || 'main').filter(s => !String(s).startsWith('fails:'))); if (needBk) roots.add('main');
    for (const sid of roots) { const h = await rootFor(sid); if (h && !(await writable(h))) { ui.toast('Nav rakstīšanas atļaujas mapei — faili netiks dzēsti', 'warn', 9000); if (sid === 'main' && needBk) return; } }
    U.$('retDialog')?.close();
    const db = S.db, n = { anon: 0, erase: 0, cand: 0, med: 0, comms: 0, ext: 0, backups: 0, files: 0, filesFail: 0 };
    for (const x of sel) {
      if (x.cat === 'left') { const p = D.person(x.id); if (!p) continue; if (x.act === 'erase') { CP.people.eraseRecord(p.id); n.erase++; } else { anonymize(p); n.anon++; } }
      else if (x.cat === 'cand') { if (D.person(x.id)) { CP.people.eraseRecord(x.id); n.cand++; } }
      else if (x.cat === 'med') { const before = db.documents.length; db.documents = db.documents.filter(d => d.id !== x.id); n.med += before - db.documents.length; }
      else if (x.cat === 'comms') {
        const m = cfg('comms').m, hold = D.person(x.id)?.commsKeepUntil || '', t = U.iso(), before = db.log.length;
        db.log = db.log.filter(l => !(l.personId === x.id && COMMS.has(l.type) && later(U.addMonths(day(l.at), m), hold) <= t)); n.comms += before - db.log.length;
      }
      else if (x.cat === 'ext') { const ev = (db.events || []).find(y => y.id === x.id); if (ev) { clearExt(ev); n.ext++; } }
    }
    for (const f of files) { try { (await delFile(f)) ? n.files++ : n.filesFail++; } catch (e) { if (e.name === 'NotFoundError') n.files++; else n.filesFail++; } }
    if (needBk) {
      try { const dir = await S.root.getDirectoryHandle('_rezerves'); for (const x of sel.filter(y => y.cat === 'backups')) { try { await dir.removeEntry(x.id); n.backups++; } catch (e) { if (e.name !== 'NotFoundError') n.filesFail++; } } }
      catch (e) { ui.toast('Rezerves kopiju mapi neizdevās atvērt: ' + e.message, 'warn'); }
      S.retBk = null;
    }
    const sum = [n.anon && `anonimizēti ${n.anon}`, n.erase && `dzēsti ${n.erase} izstājušies`, n.cand && `dzēsti ${n.cand} kandidāti`, n.med && `dzēstas ${n.med} izziņas`, n.comms && `dzēsti ${n.comms} saziņas ieraksti`, n.ext && `citu vienību dalībnieki dzēsti ${n.ext} pasākumos`, n.backups && `dzēstas ${n.backups} rezerves kopijas`, n.files && `dzēsti ${n.files} faili`].filter(Boolean);
    db.audit.push({ id: U.uid(), personId: null, at: U.now(), action: 'retention', fields: sum });
    R.sel.clear(); CP.store.changed();
    if (files.length) CP.store.scanAll?.().catch(() => {});
    ui.toast('Glabāšanas termiņi izpildīti: ' + (sum.join(', ') || 'nekas nemainījās') + (n.filesFail ? `. ${n.filesFail} failus neizdevās dzēst — izdzēs tos pats.` : ''), n.filesFail ? 'warn' : 'ok', 12000);
  };

  /* --- Iestatījumu kartīte --- */
  function settingsCard() {
    return `<section class="card" id="retCard"><h3>${ic('archive')}Datu glabāšanas termiņi</h3>
      <p class="small">Cik ilgi glabāt datus un kas notiek pēc tam. Rīks pats neko nedzēš — beidzoties termiņam, Pārskatā parādās atgādinājums, un tu apstiprini lapā <a href="#" data-page="retention">Glabāšanas termiņi</a>.</p>
      <div class="ret-set">${CATS.map(c => { const cf = cfg(c.k); return `<div class="ret-line">
        <label class="check ret-on"><input type="checkbox" data-ret="${c.k}:on" ${cf.on ? 'checked' : ''} ${c.auto ? 'disabled' : ''}> <b>${esc(c.l)}</b></label>
        <span class="ret-m"><input type="number" min="1" max="1200" data-ret="${c.k}:m" value="${cf.m}" aria-label="${esc(c.l)} — mēneši"> <small class="muted">mēn. ${esc(c.from)}</small></span>
        <span class="ret-act">${c.acts.length > 1 ? `<select data-ret="${c.k}:act" aria-label="Darbība">${c.acts.map(([v, l]) => `<option value="${v}" ${cf.act === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<small class="muted">${c.acts[0][1]}</small>`}</span>
        <details class="ret-why small"><summary>Kas tiek dzēsts un kāpēc</summary><p>${esc(c.what)}</p><p class="muted">${esc(c.basis)}</p></details></div>`; }).join('')}</div>
      <p class="muted small">Personai var iestatīt savu termiņu: kartiņā → Rediģēt → “Glabāšana pēc izstāšanās”. Noklusējumi izriet no VDAR principiem; Latvijas likumi jaunsargu datiem konkrētus termiņus nenosaka. Ja Jaunsardzes centrs vai novads tos nosaka, ievadi šeit.</p>
      <div class="actions"><button class="sm" data-page="retention">Atvērt pārskatu →</button><button class="sm ghost" data-act="retDefaults">Atjaunot noklusējumus</button></div></section>`;
  }

  CP.retention = { CATS, cfg, items, dueItems, dueCount: () => dueItems().length, anonymize, settingsCard, loadBackups };
  CP.afterRootLoad = CP.afterRootLoad || []; CP.afterRootLoad.push(() => { S.retBk = null; setTimeout(() => loadBackups(true).then(() => CP.render()).catch(() => {}), 1200); });
})(window.CP);
