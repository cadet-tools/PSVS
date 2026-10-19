/* =====================================================================
   Datu faila veselība un rezerves kopijas atjaunošanas pārbaude.
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
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, ic = (n, f = '') => CP.ic(n, f);
  const plural = (n, a, b) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? a : b}`;
  const RESTORE_DAYS = 30;

  /* ---------------- Veselības pārbaude ---------------- */
  const LISTS = [['people', 'personām'], ['documents', 'dokumentiem'], ['equipment', 'ekipējumam'], ['enrollments', 'dalības ierakstiem'], ['events', 'pasākumiem'], ['sessions', 'nodarbībām'], ['tasks', 'uzdevumiem'], ['relations', 'saistībām'], ['vfsTests', 'VFS testiem'], ['formDocs', 'sagatavotajām veidlapām']];
  const pidOf = x => (x && typeof x === 'object' ? x.pid : x);
  /** Paskaidrojumi katram pārbaudes veidam: ko nozīmē, kāpēc rodas, ko dara labojums, ko darīt pašam */
  const EXPL = {
    struct: { t: 'Datu faila uzbūve', why: 'Datu failā trūkst obligātas daļas (personu saraksts, iestatījumi) vai tā ir nepareizā formā. Tā var notikt, ja fails labots ar roku, sinhronizācija vai saglabāšana tika pārtraukta, vai disks ir bojāts.', todo: 'Neko nemaini un nesaglabā. Atjauno pēdējo derīgo kopiju: Iestatījumi → Drošība → Rezerves kopijas → “Atjaunot”. Ja nepalīdz — ziņo izstrādātājam (bez datu faila).' },
    dup: { t: 'Unikāli identifikatori', why: 'Katram ierakstam (dokumentam, ekipējumam, pasākumam…) ir savs numurs — identifikators. Ja diviem ierakstiem tas ir vienāds, rīks var atvērt, labot vai izdzēst ne to ierakstu. Parasti rodas, ja dati apvienoti no divām kopijām vai viens fails importēts divreiz.', fix: 'Pilnīgi vienādas kopijas tiek noņemtas (nekas netiek zaudēts — paliek viens eksemplārs). Atšķirīgiem ierakstiem ar vienu numuru tiek piešķirts jauns numurs — paliek abi.' },
    'orph:enrollments': { t: 'Dalība mācību gados', why: 'Dalības ieraksts (grupa un statuss gadā) palicis pēc tam, kad persona izdzēsta (līdz versijai 1.56 dzēšana šos ierakstus neizdzēsa). Ekrānā tas neparādās, bet var sajaukt skaitus un pārcelšanu uz citu gadu.', fix: 'Liekie dalības ieraksti tiek noņemti — tajos ir tikai gads, grupa un statuss, personas dati tajos nav.' },
    'orph:relations': { t: 'Saistības starp personām', why: 'Saistība (piem., brālis/māsa) norāda uz personu, kuras vairs nav. Kartītē tā parādītos kā tukša.', fix: 'Saistības ar neesošu personu tiek noņemtas; otras personas kartīte paliek nemainīta.' },
    'orph:att': { t: 'Apmeklējuma atzīmes', why: 'Nodarbībā ir atzīme (+, n, a) personai, kas izdzēsta. Tabulā tā nav redzama, bet var ietekmēt nodarbības klātbūtnes procentu.', fix: 'Atzīmes neesošām personām tiek izņemtas no nodarbībām; pārējo atzīmes paliek.' },
    'orph:part': { t: 'Pasākumu dalībnieki', why: 'Pasākuma vai nometnes dalībnieku sarakstā ir persona, kuras vairs nav. Veidlapā (instruktāža, žurnāls) tā netiktu parādīta, bet skaits būtu nepareizs.', fix: 'Neesošās personas tiek izņemtas no dalībnieku sarakstiem. Jaunsargi no citām vienībām (ārējie) netiek aiztikti.' },
    'keep:documents': { t: 'Dokumenti bez personas', why: 'Dokumenta ieraksts norāda uz personu, kuras vairs nav. Fails datu mapē, iespējams, vēl ir.', todo: 'Rīks šos ierakstus NEDZĒŠ, jo tie var būt vajadzīgi. Sadaļā Dokumenti atrodi failu un piesaisti to pareizajai personai vai izdzēs ierakstu pats.' },
    'keep:equipment': { t: 'Ekipējums bez personas', why: 'Ekipējuma ieraksts (kas izsniegts) norāda uz personu, kuras vairs nav — iespējams, ekipējums nav atdots.', todo: 'Rīks to NEDZĒŠ. Pārbaudi, vai ekipējums ir atdots; Ekipējuma sadaļā ierakstu var izlabot vai izdzēst pats.' },
    'keep:tasks': { t: 'Uzdevumi bez personas', why: 'Uzdevums vai atgādinājums piesaistīts personai, kuras vairs nav.', todo: 'Netiek dzēsts. Ja uzdevums vairs nav vajadzīgs, atzīmē to kā izpildītu sadaļā Uzdevumi.' },
    'keep:vfs': { t: 'VFS rezultāti bez personas', why: 'VFS testā ir rezultāts personai, kuras vairs nav. Testa protokolā tas neparādās.', todo: 'Netiek dzēsts, jo tas ir testa vēstures daļa. Nekas nav jādara.' },
    years: { t: 'Mācību gadi', why: 'Ieraksti (dalība, nodarbības, pasākumi, dokumenti) piesaistīti mācību gadam, kura nav gadu sarakstā — piem., gads izdzēsts, bet dati palika. Gada izvēlnē šos datus nevar atvērt.', fix: 'Trūkstošie gadi tiek pievienoti gadu sarakstam — dati atkal redzami, izvēloties šo gadu. Nekas netiek pārvietots.' },
    noname: { t: 'Personu vārdi', why: 'Personai nav ne vārda, ne uzvārda — sarakstos tā nav atrodama pēc vārda. Parasti rodas pēc nepilnīga importa vai anketas.', todo: 'Atver personu un ieraksti vārdu, vai izdzēs to, ja tā ir lieka.' },
    rev: { t: 'Versijas skaitītājs', why: 'Datu faila izmaiņu skaitītājs nav skaitlis. To izmanto, lai noteiktu, kurš no diviem datoriem ir jaunāks.', fix: 'Skaitītājs tiek iestatīts no jauna; dati netiek mainīti.' },
  };
  const exOf = k => EXPL[k] || EXPL[k.split(':')[0]] || {};
  const LIST_NAME = Object.fromEntries(LISTS);
  /** Atgriež problēmu sarakstu: { k, sev: 0|1|2, msg, n, fix?: true, list?: [] } */
  function check(db = S.db) {
    const out = [];
    try { CP.validateDb(db); } catch (e) { out.push({ k: 'struct', sev: 2, msg: 'Datu faila uzbūve nav derīga: ' + e.message, n: 1 }); return out; }
    const people = new Set(db.people.map(p => p.id)), years = new Set((db.years || []).map(y => y.id));
    const yl = y => y ? U.yearSlash(y) : 'bez gada', dt = d => U.fmtDate(String(d || '').slice(0, 10));
    // 1) dublēti identifikatori
    for (const [k, l] of LISTS) {
      if (k === 'people') continue;   // personām to jau pārbauda validateDb
      const seen = new Map(), bad = [];
      for (const x of db[k] || []) { if (!x || typeof x !== 'object') continue; if (!x.id || seen.has(x.id)) bad.push({ x, same: !!x.id && JSON.stringify(seen.get(x.id)) === JSON.stringify(x) }); else seen.set(x.id, x); }
      if (bad.length) out.push({ k: 'dup:' + k, sev: 1, msg: `${plural(bad.length, 'ierakstam', 'ierakstiem')} ${l} ir dublēts vai trūkstošs identifikators`, n: bad.length, fix: true,
        list: bad.slice(0, 12).map(({ x, same }) => `${x.title || x.kind || x.item || x.text || x.name || (x.date ? dt(x.date) : '') || 'ieraksts'}${same ? ' — pilnīgi vienāda kopija' : x.id ? ' — atšķirīgs ieraksts ar to pašu numuru' : ' — bez numura'}`) });
    }
    // 2) atsauces uz neesošām personām
    const miss = id => id && !people.has(id);
    const en = (db.enrollments || []).filter(e => miss(e.personId));
    if (en.length) out.push({ k: 'orph:enrollments', sev: 1, msg: `${plural(en.length, 'dalības ieraksts', 'dalības ieraksti')} mācību gadā norāda uz personu, kuras vairs nav`, n: en.length, fix: true, list: en.slice(0, 12).map(e => `${yl(e.yearId)}${e.group ? ' · grupa ' + e.group : ''}`) });
    const rel = (db.relations || []).filter(r => miss(r.a) || miss(r.b));
    if (rel.length) out.push({ k: 'orph:relations', sev: 1, msg: `${plural(rel.length, 'saistība', 'saistības')} starp personām norāda uz neesošu personu`, n: rel.length, fix: true, list: rel.slice(0, 12).map(r => `${r.type || 'Saistība'}: ${U.full(D.person(miss(r.a) ? r.b : r.a)) || '—'} ↔ (izdzēsta persona)`) });
    const att = []; for (const s of db.sessions || []) { const n = Object.keys(s.att || {}).filter(miss).length; if (n) att.push({ s, n }); }
    const nAtt = att.reduce((a, x) => a + x.n, 0);
    if (nAtt) out.push({ k: 'orph:att', sev: 0, msg: `${plural(nAtt, 'apmeklējuma atzīme', 'apmeklējuma atzīmes')} nodarbībās pieder personām, kuru vairs nav`, n: nAtt, fix: true, list: att.slice(0, 12).map(({ s, n }) => `${dt(s.date)}${s.group || s.g ? ' · ' + (s.group || s.g) : ''} — ${n}`) });
    const part = []; for (const ev of db.events || []) { const n = (ev.participants || []).filter(x => miss(pidOf(x))).length; if (n) part.push({ ev, n }); }
    const nPart = part.reduce((a, x) => a + x.n, 0);
    if (nPart) out.push({ k: 'orph:part', sev: 0, msg: `${plural(nPart, 'pasākuma dalībnieks', 'pasākumu dalībnieki')} norāda uz personu, kuras vairs nav`, n: nPart, fix: true, list: part.slice(0, 12).map(({ ev, n }) => `${ev.title || (ev.type === 'camp' ? 'Nometne' : 'Pasākums')} ${dt(ev.dateFrom || ev.instrDate || ev.date)} — ${n}`) });
    const keep = (k, l, f, lbl, sev = 1) => { const xs = (db[k] || []).filter(f); if (xs.length) out.push({ k: 'keep:' + k, sev, msg: l(xs.length), n: xs.length, list: xs.slice(0, 12).map(lbl) }); };
    keep('documents', n => `${plural(n, 'dokumenta ieraksts', 'dokumentu ieraksti')} bez esošas personas`, d => miss(d.personId), d => `${d.title || d.kind || 'Dokuments'} · ${dt(D.docDate(d))}${d.path ? ' · fails ' + d.path.split('/').pop() : ' · bez faila'}`);
    keep('equipment', n => `${plural(n, 'ekipējuma ieraksts', 'ekipējuma ieraksti')} bez esošas personas`, e => miss(e.personId), e => `${e.item || 'Priekšmets'}${Number(e.qty) > 1 ? ' ×' + e.qty : ''} · izsniegts ${dt(e.issued)}${e.returned ? ' · atdots' : ' · NAV atdots'}`);
    keep('tasks', n => `${plural(n, 'uzdevums', 'uzdevumi')} piesaistīti neesošai personai`, t => miss(t.personId), t => `${t.text || 'Uzdevums'}${t.due ? ' · līdz ' + dt(t.due) : ''}${t.done ? ' · izpildīts' : ''}`, 0);
    const vfs = []; for (const t of db.vfsTests || []) { const n = Object.keys(t.res || {}).filter(miss).length; if (n) vfs.push({ t, n }); }
    const nVfs = vfs.reduce((a, x) => a + x.n, 0);
    if (nVfs) out.push({ k: 'keep:vfs', sev: 0, msg: `${plural(nVfs, 'VFS rezultāts', 'VFS rezultāti')} pieder personām, kuru vairs nav`, n: nVfs, list: vfs.slice(0, 12).map(({ t, n }) => `${t.title || 'VFS tests'} ${dt(t.date)} — ${n}`) });
    // 3) atsauces uz neesošiem mācību gadiem
    const yMiss = new Map();
    for (const k of ['enrollments', 'events', 'sessions', 'vfsTests', 'documents', 'equipment', 'formDocs']) for (const x of db[k] || []) if (x?.yearId && !years.has(x.yearId) && /^\d{4}-\d{4}$/.test(x.yearId)) { const m = yMiss.get(x.yearId) || {}; m[k] = (m[k] || 0) + 1; yMiss.set(x.yearId, m); }
    if (yMiss.size) out.push({ k: 'years', sev: 1, msg: `Ieraksti norāda uz mācību gadiem, kuru nav gadu sarakstā: ${[...yMiss.keys()].sort().map(U.yearSlash).join(', ')}`, n: yMiss.size, fix: true, years: [...yMiss.keys()],
      list: [...yMiss].sort().map(([y, m]) => `${U.yearSlash(y)}: ${Object.entries(m).map(([k, n]) => `${LIST_NAME[k]?.replace(/m$|ām$|iem$/, '') || k} ${n}`).join(', ')}`) });
    // 4) personas bez vārda
    const noName = db.people.filter(p => !String(p.first || '').trim() && !String(p.last || '').trim() && !p.anon);
    if (noName.length) out.push({ k: 'noname', sev: 0, msg: `${plural(noName.length, 'personai', 'personām')} nav ne vārda, ne uzvārda`, n: noName.length, people: noName.map(p => p.id), list: noName.slice(0, 12).map(p => `izveidota ${dt(p.createdAt)}${D.groupOf(p) ? ' · grupa ' + D.groupOf(p) : ''}`) });
    // 5) skaitītāji
    if (typeof db.revision !== 'number' || !Number.isFinite(db.revision)) out.push({ k: 'rev', sev: 1, msg: 'Datu faila versijas skaitītājs nav derīgs', n: 1, fix: true });
    return out.sort((a, b) => b.sev - a.sev);
  }
  /** Ko pārbauda (redzams kartītē ar ✓ vai atrasto skaitu) */
  const CHECKS = [['struct', 'Datu faila uzbūve'], ['dup', 'Unikāli identifikatori visos sarakstos'], ['orph', 'Dalība, saistības, apmeklējums un pasākumi — tikai esošām personām'], ['keep', 'Dokumenti, ekipējums, uzdevumi un VFS — piesaistīti esošām personām'], ['years', 'Visi izmantotie mācību gadi ir gadu sarakstā'], ['noname', 'Visām personām ir vārds vai uzvārds'], ['rev', 'Versijas skaitītājs (darbam uz diviem datoriem)']];
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
    const r = last || run(), xs = r.issues, fixable = xs.filter(x => x.fix), manual = xs.filter(x => !x.fix);
    const byGroup = k => xs.filter(x => x.k === k || x.k.startsWith(k + ':'));
    const go = x => x.k === 'keep:documents' ? '<button class="sm" data-page="documents">Atvērt Dokumentus</button>' : x.k === 'keep:equipment' ? '<button class="sm" data-page="equipment">Atvērt Ekipējumu</button>' : x.k === 'keep:tasks' ? '<button class="sm" data-page="alerts">Atvērt Uzdevumus</button>' : x.k === 'noname' ? `<button class="sm" data-person="${x.people[0]}">Atvērt personu</button>` : x.k === 'struct' ? '<button class="sm" data-act="goSetCard" data-arg="dataCard">Rezerves kopijas</button>' : '';
    const item = x => { const e = exOf(x.k); return `<div class="row alert ${['info', 'warn', 'bad'][x.sev]} hc-item"><span class="al-ic">${x.sev ? ic('alert', '⚠') : ic('info', 'ⓘ')}</span><div class="grow">
        <div><b>${esc(e.t || '')}</b>${e.t ? ': ' : ''}${esc(x.msg)} ${x.fix ? '<span class="tag ok">izlabojams automātiski</span>' : '<span class="tag">jāpārskata pašam</span>'}</div>
        <details class="hc-why"><summary>Ko tas nozīmē?</summary>
          ${e.why ? `<p class="small">${esc(e.why)}</p>` : ''}
          ${x.fix && e.fix ? `<p class="small"><b>Ko darīs labojums:</b> ${esc(e.fix)}</p>` : ''}
          ${e.todo ? `<p class="small"><b>Ko darīt:</b> ${esc(e.todo)}</p>` : ''}
          ${x.list?.length ? `<p class="small"><b>Atrastie ieraksti${x.n > x.list.length ? ` (pirmie ${x.list.length} no ${x.n})` : ''}:</b></p><ul class="small hc-ul">${x.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        </details></div>${go(x)}</div>`; };
    const sum = !xs.length ? '<p class="okc"><b>✓ Datu fails ir kārtībā.</b> Visas pārbaudes izietas.</p>'
      : `<p class="small">${xs.some(x => x.sev === 2) ? '<b>Datu fails ir bojāts.</b> ' : ''}Atrastas ${plural(xs.length, 'piezīme', 'piezīmes')}: ${fixable.length ? `${fixable.length} rīks var izlabot pats (tikai lieki vai sajaukti ieraksti — personas, dokumenti un ekipējums netiek dzēsti)` : ''}${fixable.length && manual.length ? ', ' : ''}${manual.length ? `${manual.length} — jāpārskata pašam` : ''}. Atver “Ko tas nozīmē?”, lai redzētu skaidrojumu un konkrētos ierakstus.</p>`;
    return `${sum}${xs.length ? `<div class="hc-list">${xs.map(item).join('')}</div>` : ''}
      <details class="hc-checks small"><summary>Kas tiek pārbaudīts</summary><ul>${CHECKS.map(([k, l]) => { const g = byGroup(k), n = g.reduce((a, x) => a + x.n, 0); return `<li>${g.length ? `<b class="warnc">⚠ ${n}</b>` : '<b class="okc2">✓</b>'} ${esc(l)}</li>`; }).join('')}</ul>
        <p class="muted">Pārbaude skatās tikai datu faila iekšējo kārtību. Vai dokumentu faili ir vietā, pārbauda sadaļa Dokumenti (“Pārbaudīt failus”); vai datos nekā netrūkst (kontakti, grupa) — sadaļa “Datu kvalitāte”.</p></details>
      <div class="actions" style="margin-top:10px"><button class="sm" data-act="healthRun">${ic('refresh')}Pārbaudīt vēlreiz</button>${fixable.length ? `<button class="sm mainbtn" data-act="healthFix">${ic('check')}Izlabot drošās kļūdas (${fixable.length})</button>` : ''}
        <span class="small muted">Pārbaudīts ${esc(U.fmtDateTime(r.at))}</span></div>`;
  };
  function card() {
    const at = S.db?.settings?.restoreCheckAt, days = at ? Math.floor((Date.now() - new Date(at)) / 864e5) : null;
    return `<section class="card" id="healthCard"><h3>${ic('shield')}Datu veselība un kopiju pārbaude</h3>
      <p class="small">Datu fails ir viens fails ar visiem rīka ierakstiem, kas savā starpā saistīti (piem., dokuments → persona, dalība → mācību gads). Ja saite norāda uz kaut ko, kā vairs nav, vai diviem ierakstiem ir viens numurs, rīks var rādīt nepareizus skaitus vai atvērt ne to ierakstu. Tāpēc rīks, atverot datu mapi, pats pārbauda šīs saites. Labo tikai to, kas ir droši: pirms tam izveido JSON kopiju, un personas, dokumenti un ekipējums netiek dzēsti.</p>
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
