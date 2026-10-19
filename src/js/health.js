/* =====================================================================
   Datu faila veselība un rezerves kopijas atjaunošanas pārbaude (TESTA KANĀLS).
   • Veselības pārbaude: dublēti identifikatori, ieraksti, kas norāda uz neesošām personām vai mācību gadiem.
     Notiek automātiski pēc datu mapes atvēršanas un ar pogu (Iestatījumi → Drošība → “Datu veselība”).
     Labo tikai drošās lietas (lieki atsauces ieraksti, trūkstoši gadi, dublēti ID) — pirms tam JSON kopija.
     Dokumentu un ekipējuma ierakstus bez personas netiek dzēsti — tie tiek tikai parādīti.
   • Atjaunošanas pārbaude: reizi mēnesī atgādinājums; pārbaude nolasa jaunāko kopiju no _rezerves,
     pārbauda struktūru, migrē to atmiņā (kā atjaunojot) un salīdzina ar pašreizējiem datiem.
     Pašreizējie dati netiek mainīti. Datums: settings.restoreCheckAt.
   ===================================================================== */
(function (CP) {
  'use strict';
  if (CP.CHANNEL !== 'test') return;
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, ic = (n, f = '') => CP.ic(n, f);
  const plural = (n, a, b) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? a : b}`;
  const RESTORE_DAYS = 30;

  /* ---------------- Veselības pārbaude ---------------- */
  const LISTS = [['people', 'personām'], ['documents', 'dokumentiem'], ['equipment', 'ekipējumam'], ['enrollments', 'dalības ierakstiem'], ['events', 'pasākumiem'], ['sessions', 'nodarbībām'], ['tasks', 'uzdevumiem'], ['relations', 'saistībām'], ['vfsTests', 'VFS testiem'], ['formDocs', 'sagatavotajām veidlapām']];
  const pidOf = x => (x && typeof x === 'object' ? x.pid : x);
  /** Atgriež problēmu sarakstu: { k, sev: 0|1|2, msg, n, fix?: true, list?: [] } */
  function check(db = S.db) {
    const out = [];
    try { CP.validateDb(db); } catch (e) { out.push({ k: 'struct', sev: 2, msg: 'Datu faila struktūra nav derīga: ' + e.message, n: 1 }); return out; }
    const people = new Set(db.people.map(p => p.id)), years = new Set((db.years || []).map(y => y.id));
    // 1) dublēti identifikatori
    for (const [k, l] of LISTS) {
      if (k === 'people') continue;   // personām to jau pārbauda validateDb
      const seen = new Map(); let n = 0;
      for (const x of db[k] || []) { if (!x || typeof x !== 'object') continue; if (!x.id) { n++; continue; } if (seen.has(x.id)) n++; else seen.set(x.id, x); }
      if (n) out.push({ k: 'dup:' + k, sev: 1, msg: `${plural(n, 'ierakstam', 'ierakstiem')} ${l} ir dublēts vai trūkstošs identifikators`, n, fix: true });
    }
    // 2) atsauces uz neesošām personām
    const miss = id => id && !people.has(id);
    const cnt = (k, f) => (db[k] || []).filter(f).length;
    const nEn = cnt('enrollments', e => miss(e.personId));
    if (nEn) out.push({ k: 'orph:enrollments', sev: 1, msg: `${plural(nEn, 'dalības ieraksts', 'dalības ieraksti')} mācību gadā norāda uz personu, kuras vairs nav`, n: nEn, fix: true });
    const nRel = cnt('relations', r => miss(r.a) || miss(r.b));
    if (nRel) out.push({ k: 'orph:relations', sev: 1, msg: `${plural(nRel, 'saistība', 'saistības')} starp personām norāda uz neesošu personu`, n: nRel, fix: true });
    let nAtt = 0; for (const s of db.sessions || []) for (const pid of Object.keys(s.att || {})) if (miss(pid)) nAtt++;
    if (nAtt) out.push({ k: 'orph:att', sev: 0, msg: `${plural(nAtt, 'apmeklējuma atzīme', 'apmeklējuma atzīmes')} nodarbībās pieder personām, kuru vairs nav`, n: nAtt, fix: true });
    let nPart = 0; for (const ev of db.events || []) for (const x of ev.participants || []) if (miss(pidOf(x))) nPart++;
    if (nPart) out.push({ k: 'orph:part', sev: 0, msg: `${plural(nPart, 'pasākuma dalībnieks', 'pasākumu dalībnieki')} norāda uz personu, kuras vairs nav`, n: nPart, fix: true });
    const keep = (k, l, f, sev = 1) => { const xs = (db[k] || []).filter(f); if (xs.length) out.push({ k: 'keep:' + k, sev, msg: l(xs.length), n: xs.length, list: xs.slice(0, 20).map(x => x.title || x.kind || x.item || x.text || x.name || x.id) }); };
    keep('documents', n => `${plural(n, 'dokumenta ieraksts', 'dokumentu ieraksti')} bez esošas personas (netiek dzēsti — pārbaudi Dokumentu sadaļā)`, d => miss(d.personId));
    keep('equipment', n => `${plural(n, 'ekipējuma ieraksts', 'ekipējuma ieraksti')} bez esošas personas (netiek dzēsti)`, e => miss(e.personId));
    keep('tasks', n => `${plural(n, 'uzdevums', 'uzdevumi')} piesaistīti neesošai personai (netiek dzēsti)`, t => miss(t.personId), 0);
    let nVfs = 0; for (const t of db.vfsTests || []) for (const pid of Object.keys(t.res || {})) if (miss(pid)) nVfs++;
    if (nVfs) out.push({ k: 'keep:vfs', sev: 0, msg: `${plural(nVfs, 'VFS rezultāts', 'VFS rezultāti')} pieder personām, kuru vairs nav (netiek dzēsti)`, n: nVfs });
    // 3) atsauces uz neesošiem mācību gadiem
    const yMiss = new Set();
    for (const k of ['enrollments', 'events', 'sessions', 'vfsTests', 'documents', 'equipment', 'formDocs']) for (const x of db[k] || []) if (x?.yearId && !years.has(x.yearId) && /^\d{4}-\d{4}$/.test(x.yearId)) yMiss.add(x.yearId);
    if (yMiss.size) out.push({ k: 'years', sev: 1, msg: `Ieraksti norāda uz mācību gadiem, kuru nav gadu sarakstā: ${[...yMiss].sort().map(U.yearSlash).join(', ')}`, n: yMiss.size, fix: true, years: [...yMiss] });
    // 4) personas bez vārda
    const noName = db.people.filter(p => !String(p.first || '').trim() && !String(p.last || '').trim() && !p.anon);
    if (noName.length) out.push({ k: 'noname', sev: 0, msg: `${plural(noName.length, 'personai', 'personām')} nav ne vārda, ne uzvārda`, n: noName.length, people: noName.map(p => p.id) });
    // 5) skaitītāji
    if (typeof db.revision !== 'number' || !Number.isFinite(db.revision)) out.push({ k: 'rev', sev: 1, msg: 'Datu faila versijas skaitītājs nav derīgs', n: 1, fix: true });
    return out.sort((a, b) => b.sev - a.sev);
  }
  /** Drošie labojumi (tikai atsauces un ID) — atgriež izdarīto aprakstu */
  function fix(db = S.db) {
    const people = new Set(db.people.map(p => p.id)), done = [];
    const miss = id => id && !people.has(id);
    for (const [k] of LISTS) {
      if (k === 'people' || !Array.isArray(db[k])) continue;
      const seen = new Map(), keepArr = []; let re = 0, drop = 0;
      for (const x of db[k]) {
        if (!x || typeof x !== 'object') { keepArr.push(x); continue; }
        if (x.id && seen.has(x.id)) {
          if (JSON.stringify(seen.get(x.id)) === JSON.stringify(x)) { drop++; continue; }   // pilnīgi vienāda kopija
          x.id = U.uid(); re++;
        } else if (!x.id) { x.id = U.uid(); re++; }
        seen.set(x.id, x); keepArr.push(x);
      }
      db[k] = keepArr;
      if (re) done.push(`${k}: ${re} jauni identifikatori`); if (drop) done.push(`${k}: ${drop} identiskas kopijas noņemtas`);
    }
    const n0 = db.enrollments.length; db.enrollments = db.enrollments.filter(e => !miss(e.personId)); if (n0 - db.enrollments.length) done.push(`${n0 - db.enrollments.length} lieki dalības ieraksti`);
    const r0 = db.relations.length; db.relations = db.relations.filter(r => !miss(r.a) && !miss(r.b)); if (r0 - db.relations.length) done.push(`${r0 - db.relations.length} saistības`);
    let a = 0; for (const s of db.sessions || []) for (const pid of Object.keys(s.att || {})) if (miss(pid)) { delete s.att[pid]; a++; }
    if (a) done.push(`${a} apmeklējuma atzīmes`);
    let pp = 0; for (const ev of db.events || []) if (Array.isArray(ev.participants)) { const l = ev.participants.length; ev.participants = ev.participants.filter(x => !miss(pidOf(x))); pp += l - ev.participants.length; }
    if (pp) done.push(`${pp} pasākumu dalībnieki`);
    const years = new Set(db.years.map(y => y.id)); let ny = 0;
    for (const k of ['enrollments', 'events', 'sessions', 'vfsTests', 'documents', 'equipment', 'formDocs']) for (const x of db[k] || []) {
      const y = x?.yearId; if (!y || years.has(y) || !/^(\d{4})-(\d{4})$/.test(y) || Number(y.slice(5)) !== Number(y.slice(0, 4)) + 1) continue;
      db.years.push({ id: y, start: Number(y.slice(0, 4)), createdAt: U.now() }); years.add(y); ny++;
      db.settings.yearsDeleted = (db.settings.yearsDeleted || []).filter(z => z !== y);
    }
    if (ny) { db.years.sort((p, q) => p.start - q.start); done.push(`${ny} mācību gadi atjaunoti sarakstā`); }
    if (typeof db.revision !== 'number' || !Number.isFinite(db.revision)) { db.revision = 0; done.push('versijas skaitītājs'); }
    return done;
  }
  let last = null;   // { at, issues }
  const run = () => { last = { at: U.now(), issues: S.db ? check() : [] }; return last; };
  const healthHtml = () => {
    const r = last || run(), xs = r.issues, fixable = xs.some(x => x.fix);
    return `${xs.length ? `<div class="hc-list">${xs.map(x => `<div class="row alert ${['info', 'warn', 'bad'][x.sev]}"><span class="al-ic">${x.sev ? ic('alert', '⚠') : ic('info', 'ⓘ')}</span><div class="grow">${esc(x.msg)}${x.fix ? ' <span class="tag">var droši izlabot</span>' : ''}
        ${x.list?.length ? `<div class="small muted">${x.list.map(esc).join(', ')}${x.n > x.list.length ? ' …' : ''}</div>` : ''}</div>
        ${x.k === 'keep:documents' ? '<button class="sm" data-page="documents">Dokumenti</button>' : x.k === 'keep:equipment' ? '<button class="sm" data-page="equipment">Ekipējums</button>' : x.k === 'noname' ? `<button class="sm" data-person="${x.people[0]}">Atvērt</button>` : ''}</div>`).join('')}</div>`
      : `<p class="okc"><b>✓ Datu fails ir kārtībā.</b> Dublēti identifikatori un nesaistīti ieraksti nav atrasti.</p>`}
      <div class="actions" style="margin-top:10px"><button class="sm" data-act="healthRun">${ic('refresh')}Pārbaudīt vēlreiz</button>${fixable ? `<button class="sm mainbtn" data-act="healthFix">${ic('check')}Izlabot drošās kļūdas</button>` : ''}
        <span class="small muted">Pārbaudīts ${esc(U.fmtDateTime(r.at))}</span></div>`;
  };
  function card() {
    const at = S.db?.settings?.restoreCheckAt, days = at ? Math.floor((Date.now() - new Date(at)) / 864e5) : null;
    return `<section class="card" id="healthCard"><h3>${ic('shield')}Datu veselība un kopiju pārbaude</h3>
      <p class="small">Rīks, atverot datu mapi, pats pārbauda datu failu: vai nav dublētu identifikatoru un ierakstu, kas norāda uz izdzēstām personām vai neesošiem gadiem. Labošana maina tikai šīs atsauces — pirms tam tiek izveidota JSON kopija.</p>
      <div id="healthBox">${healthHtml()}</div>
      <h4>Vai rezerves kopiju var atjaunot?</h4>
      <p class="small">Pēdējā pārbaude: <b>${at ? `${esc(U.fmtDate(at))} (${days ? 'pirms ' + plural(days, 'dienas', 'dienām') : 'šodien'})` : 'vēl nav veikta'}</b>. Reizi mēnesī rīks atgādina pārbaudīt jaunāko kopiju — tā tiek nolasīta un sagatavota tāpat kā atjaunojot, bet tavi dati netiek mainīti.</p>
      <div class="actions"><button class="sm" data-act="restoreCheck">${ic('refresh')}Pārbaudīt jaunāko kopiju</button></div></section>`;
  }
  const repaint = () => { const b = U.$('healthBox'); if (b) b.innerHTML = healthHtml(); };
  A.healthRun = () => { run(); repaint(); ui.toast(last.issues.length ? `Atrastas ${plural(last.issues.length, 'piezīme', 'piezīmes')}` : '✓ Datu fails ir kārtībā', last.issues.some(x => x.sev) ? 'warn' : 'ok'); };
  const closeNotice = () => { const n = U.$('noticeDialog'); if (n?.open) n.close(); };
  A.healthOpen = () => { closeNotice(); run(); ui.goSettingsCard('healthCard'); };
  A.rcBackup = () => { U.$('restoreDialog')?.close(); return A.backupNow(); };
  A.healthFix = async () => {
    const xs = check().filter(x => x.fix); if (!xs.length) return ui.toast('Nav ko labot', 'ok');
    if (!confirm(`Izlabot:\n• ${xs.map(x => x.msg).join('\n• ')}\n\nPirms tam tiks izveidota JSON rezerves kopija. Dokumenti, ekipējums un personas netiek dzēsti.`)) return;
    const b = await CP.store.backupNow(); if (!b?.ok) return ui.toast('Kopiju neizdevās izveidot — labošana netika veikta', 'err');
    const done = fix(); S.db.audit.push({ id: U.uid(), personId: null, at: U.now(), action: 'health-fix', fields: done }); CP.store.changed();
    run(); repaint(); ui.toast('Izlabots: ' + (done.join('; ') || 'nekas'), 'ok', 9000);
  };
  CP.noRootOk && (() => { const o = CP.noRootOk; CP.noRootOk = a => a === 'healthOpen' || a === 'healthRun' || o(a); })();

  /* ---------------- Atjaunošanas pārbaude ---------------- */
  A.restoreCheck = async () => {
    closeNotice();
    if (!S.root) return CP.needRoot?.();
    let list = await CP.store.listBackups();
    if (!list.length) {
      if (!confirm('Datu mapē vēl nav nevienas JSON rezerves kopijas. Izveidot to tagad un pārbaudīt?')) return;
      const b = await CP.store.backupNow(); if (!b?.ok) return;
      list = await CP.store.listBackups(); if (!list.length) return ui.toast('Kopija netika atrasta', 'err');
    }
    const name = list[0].name;
    let r; try { r = await CP.store.testRestore(name); } catch (e) { r = { ok: false, error: e.message }; }
    if (r.ok) { S.db.settings.restoreCheckAt = U.now(); CP.store.changed({ silent: true }); }
    showRestore(name, list[0], r);
    if (S.page === 'settings') { const c = U.$('healthCard'); if (c) c.outerHTML = card(); }
  };
  function showRestore(name, meta, r) {
    let d = U.$('restoreDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'restoreDialog'; document.body.appendChild(d); }
    const cur = S.db, cnt = db => ({ people: db.people.length, documents: (db.documents || []).length, events: (db.events || []).length, sessions: (db.sessions || []).length, equipment: (db.equipment || []).length });
    const now = cnt(cur), age = Math.floor((Date.now() - meta.modified) / 864e5);
    const rows = r.ok ? [['Personas', 'people'], ['Dokumentu ieraksti', 'documents'], ['Pasākumi', 'events'], ['Nodarbības', 'sessions'], ['Ekipējums', 'equipment']].map(([l, k]) => `<tr><td>${l}</td><td>${r.counts[k]}</td><td>${now[k]}</td></tr>`).join('') : '';
    const behind = r.ok && (r.counts.people < now.people || age > 7);
    d.innerHTML = `<form method="dialog"><header class="dlg-head"><h2>${ic(r.ok ? 'check' : 'alert')}${r.ok ? 'Kopiju var atjaunot' : 'Kopiju NEVAR atjaunot'}</h2><button class="ghost" value="x" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small">Pārbaudīta jaunākā kopija <b>${esc(name)}</b> (${esc(U.fmtDateTime(new Date(meta.modified).toISOString()))}, ${Math.round(meta.size / 1024)} KB).</p>
      ${r.ok ? `<p class="okc"><b>✓ Kopija ir nolasāma un derīga.</b> Tā tika sagatavota tāpat kā atjaunojot (datu versija ${esc(r.version)} → ${esc(CP.SCHEMA)}). Tavi pašreizējie dati netika mainīti.</p>
        <table class="table small"><thead><tr><th></th><th>Kopijā</th><th>Tagad</th></tr></thead><tbody>${rows}</tbody></table>
        ${behind ? `<p class="hint warn" style="margin-top:8px">Kopija ir ${age ? `${plural(age, 'dienu', 'dienas')} veca` : 'veca'}${r.counts.people < now.people ? ' un tajā ir mazāk personu nekā tagad' : ''} — ieteicams izveidot jaunu kopiju.</p>` : ''}`
      : `<p class="hint warn"><b>Kļūda:</b> ${esc(r.error || 'nezināma')}</p><p class="small">Izveido jaunu kopiju tagad. Ja kļūda atkārtojas, ziņo izstrādātājam (sadaļa “Ziņot”) — kopijas saturu nesūti.</p>`}</div>
      <footer class="dlg-foot"><span class="grow"></span>${!r.ok || behind ? '<button type="button" data-act="rcBackup">Izveidot jaunu kopiju</button>' : ''}<button class="mainbtn" value="ok">Labi</button></footer></form>`;
    if (!d.open) d.showModal();
  }
  // Ikmēneša atgādinājums: brīdinājumu sarakstā un vienreiz sesijā — paziņojums
  { const orig = D.alerts; D.alerts = () => { const out = orig(); if (S.root && S.db) { const at = S.db.settings.restoreCheckAt, days = at ? (Date.now() - new Date(at)) / 864e5 : Infinity; if (days > RESTORE_DAYS) out.push({ kind: 'backup', sev: 0, msg: at ? `Rezerves kopijas atjaunošana pārbaudīta pirms ${Math.floor(days)} dienām — pārbaudi, vai jaunāko kopiju var atjaunot` : 'Pārbaudi, vai rezerves kopiju var atjaunot (ieteicams reizi mēnesī)', act: 'restoreCheck', actLabel: 'Pārbaudīt', quiet: true }); }
    const h = last?.issues?.filter(x => x.sev) || []; if (h.length) out.push({ kind: 'backup', sev: 1, msg: `Datu veselības pārbaude: ${h[0].msg}${h.length > 1 ? ` (+${h.length - 1})` : ''}`, act: 'healthOpen', actLabel: 'Skatīt', quiet: true });
    return out; }; }
  CP.afterRootLoad = CP.afterRootLoad || []; CP.afterRootLoad.push(() => setTimeout(() => {
    if (!S.db) return;
    run(); const bad = last.issues.filter(x => x.sev);
    if (bad.length) ui.toast(`Datu veselības pārbaude atrada ${plural(bad.length, 'problēmu', 'problēmas')}`, 'warn', 12000, { act: 'healthOpen', label: 'Skatīt' });
    const at = S.db.settings.restoreCheckAt;
    if (!bad.length && (!at || Date.now() - new Date(at) > RESTORE_DAYS * 864e5) && !sessionStorage.getItem('cp.rcTold')) {
      try { sessionStorage.setItem('cp.rcTold', '1'); } catch (e) { /* */ }
      ui.toast('Reizi mēnesī ieteicams pārbaudīt, vai rezerves kopiju var atjaunot', 'info', 12000, { act: 'restoreCheck', label: 'Pārbaudīt tagad' });
    }
    if (S.page === 'alerts' || S.page === 'dashboard') CP.render();
  }, 2500));
  CP.health = { check, fix, run, card, last: () => last };
})(window.CP);
