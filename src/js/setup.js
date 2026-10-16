/* =====================================================================
   Sākuma iestatīšana, datu kvalitāte un 21 gada brīdinājums.
   • Pārskatā kartīte “Sagatavo rīku darbam”: ķeksīši par galvenajiem iestatījumiem. Pazūd, kad viss izdarīts
     vai kad instruktors to paslēpj (settings.setupHidden). settings.setupDone = { docs: true, … } — soļi, ko
     nevar pārbaudīt automātiski (apskatīts).
   • Lapa “Datu kvalitāte” (quality): trūkstoši / nederīgi dati, iespējami dublikāti, faili, kas nav atrasti.
   • Brīdinājums: jaunsargam tuvojas 21 gads (60 dienas) vai jau ir 21 — līgums beidzas.
   • Instruktora dati (settings.instructor) — tie paši, ko izmanto līgumi un veidlapas; kartīte Iestatījumos.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const plural = (n, one, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`;

  /* ---------------- Instruktora dati ---------------- */
  const inst = () => (S.db.settings.instructor = S.db.settings.instructor || { parvalde: '', nodala: '', name: '', nameGen: '', position: 'Jaunsargu instruktors', phone: '', email: '', place: '' });
  function instCard() {
    const I = inst(), bad = instProblems(I), f = (k, l, ph = '', t = 'text', cap = '') => `<div class="field ${bad[k] ? 'check' : ''}"><label>${l}${k === 'nameGen' ? '' : ' <b class="red">*</b>'}</label><input type="${t}" data-inst="${k}" value="${esc(I[k] ?? '')}" placeholder="${esc(ph)}" autocomplete="off" ${cap ? `data-cap="${cap}"` : ''}>${bad[k] ? `<div class="hint warn">${esc(bad[k])}</div>` : ''}</div>`;
    return `<section class="card" id="instCard"><h3>${ic('user')}Instruktora dati</h3>
      <p class="small" style="margin-top:0"><b>Darba dati</b> — tie tiek ierakstīti līgumos un veidlapās, tāpēc privātu e-pastu vai tālruni šeit neliec. Tos pašus datus var labot arī līguma sagatavošanas logā.</p>
      <div class="fieldgrid">${f('name', 'Vārds, uzvārds', 'Jānis Paraugs', 'text', 'words')}${f('position', 'Amats', 'Jaunsargu instruktors', 'text', 'first')}
        ${f('parvalde', 'Novada pārvaldes nr.', 'piem. 3')}${f('nodala', 'Nodaļas nr.', 'piem. 1')}
        ${f('phone', 'Darba tālrunis', '', 'tel')}${f('email', 'Darba e-pasts', 'vards.uzvards@jc.gov.lv', 'email')}${f('place', 'Vieta pēc noklusējuma', 'piem. Rīga', 'text', 'first')}
        ${f('nameGen', 'Vārds ģenitīvā (līgumam)', 'tiek izveidots automātiski', 'text', 'words')}</div>
      <p class="small muted">Ar <b class="red">*</b> atzīmētie lauki ir obligāti. Vārds ģenitīvā tiek izveidots automātiski (pārbaudi līguma logā).</p></section>`;
  }
  /** Instruktora datu problēmas: { lauks: teksts }. Vārds ģenitīvā nav obligāts (veidojas automātiski). */
  const INST_REQ = { name: 'Vārds, uzvārds', position: 'Amats', parvalde: 'Novada pārvaldes nr.', nodala: 'Nodaļas nr.', phone: 'Darba tālrunis', email: 'Darba e-pasts', place: 'Vieta' };
  const JC_MAIL = /^[^\s@]+@jc\.gov\.lv$/i;
  function instProblems(I = S.db.settings.instructor || {}) {
    const out = {};
    for (const k of Object.keys(INST_REQ)) if (!String(I[k] || '').trim()) out[k] = 'jāaizpilda';
    if (I.email && !JC_MAIL.test(I.email)) out.email = 'jābūt darba e-pastam: vards.uzvards@jc.gov.lv';
    if (I.phone && !U.validate('phone', I.phone).ok) out.phone = 'nav derīgs tālruņa numurs';
    if (I.name && !U.validate('fullname', I.name).ok) out.name = 'vajag vārdu un uzvārdu';
    return out;
  }
  CP.changeHandlers.push(e => {
    const k = e.target.dataset?.inst; if (!k) return false;
    let v = e.target.value.trim();
    if (k === 'email') v = v.toLowerCase();
    if (k === 'phone' && v) { const r = U.validate('phone', v); if (r.ok) v = r.value; }
    inst()[k] = v; e.target.value = v;
    if (k === 'email' && v && !JC_MAIL.test(v)) ui.toast('Darba e-pastam jābeidzas ar @jc.gov.lv (piem., vards.uzvards@jc.gov.lv). Privātu e-pastu līgumā neliek.', 'warn', 9000);
    CP.store.changed(); return true;
  });

  /* ---------------- Sākuma iestatīšanas saraksts ---------------- */
  const done = () => (S.db.settings.setupDone = S.db.settings.setupDone || {});
  function steps() {
    const st = CP.encBackup?.state?.() || {}, I = S.db.settings.instructor || {};
    return [
      { k: 'root', l: 'Datu mape izvēlēta', ok: !!S.root, hint: 'Visi dati glabājas tavā datorā šajā mapē.' },
      (() => { const bad = instProblems(I), n = Object.keys(bad).length; return { k: 'inst', l: 'Instruktora dati', ok: !n, hint: n ? `Nav aizpildīts vai nav pareizs: ${esc(Object.keys(bad).map(x => INST_REQ[x]).join(', '))}.` : 'Darba dati līgumiem un veidlapām.', act: 'goSetCard', arg: 'instCard', btn: 'Aizpildīt' }; })(),
      { k: 'pin', l: 'PIN kods rīka bloķēšanai', ok: !!CP.lock?.hasPin?.(), hint: 'Aizsargā datus, kad dators paliek bez uzraudzības.', act: 'lockGoSet', btn: 'Iestatīt' },
      { k: 'backup', l: 'Šifrētā rezerves kopija Google Drive', ok: !!st.enabled, hint: 'Pazaudējot datoru, datus var atjaunot.', act: 'encGoSet', btn: 'Iestatīt' },
      { k: 'groups', l: 'Grupas šajā mācību gadā', ok: D.groups().length > 0, hint: 'Piemēram, J1, J2 — pēc tām filtrē sarakstus un apmeklējumu.', act: 'groupNew', btn: 'Pievienot' },
      { k: 'docs', l: 'Obligātie dokumenti pārbaudīti', ok: !!done().docs, hint: `Tagad: ${esc((S.db.settings.requiredDocs || []).join(', ') || '—')}.`, act: 'setupDocs', btn: 'Pārbaudīt' },
      { k: 'people', l: 'Pirmais jaunsargs pievienots', ok: S.db.people.length > 0, hint: 'No anketas, Excel vai e-klases — vai ievadot pašam.', act: 'scan', btn: 'Ievadīt anketu' }
    ];
  }
  function setupCard() {
    if (!S.root || S.setupHidden) return '';   // paslēpts tikai līdz nākamajai rīka atvēršanai
    const list = steps(), n = list.filter(s => s.ok).length, all = n === list.length;
    if (all && !S.setupOpen) return '';   // viss izdarīts — paliek tikai statuss pie pogām; atver, uzspiežot uz tā
    return `<section class="card setup-card ${all ? 'done' : ''}" id="setupCard"><h3>${ic('check')}${all ? 'Rīks ir sagatavots darbam' : 'Sagatavo rīku darbam'} <span class="pill ${all ? 'ok' : 'warn'}">${n}/${list.length}</span>
        <button class="ghost sm right" data-act="setupHide" title="${all ? 'Aizvērt' : 'Paslēpt līdz nākamajai rīka atvēršanai — statuss paliek pie pogām augšā'}">${all ? 'Aizvērt' : 'Paslēpt'}</button></h3>
      <div class="setup-bar"><span style="width:${Math.round(n / list.length * 100)}%"></span></div>
      <div class="setup-list">${list.map(s => `<div class="setup-row ${s.ok ? 'ok' : ''}"><span class="setup-ic">${s.ok ? '✓' : ''}</span><div class="grow"><b>${esc(s.l)}</b><div class="small muted">${s.hint}</div></div>${!s.ok && s.act ? `<button class="sm ${s.k === list.find(x => !x.ok)?.k ? 'mainbtn' : ''}" data-act="${s.act}" ${s.arg ? `data-arg="${esc(s.arg)}"` : ''}>${esc(s.btn)}</button>` : ''}</div>`).join('')}</div></section>`;
  }
  A.setupHide = () => { const all = steps().every(s => s.ok); S.setupHidden = !all; S.setupOpen = false; CP.render(); if (!all) ui.toast('Saraksts paslēpts līdz nākamajai rīka atvēršanai. Progress redzams augšā pie pogām.', 'ok', 7000); };
  A.setupShow = () => {
    if (U.$('setupCard')) { S.setupOpen = false; S.setupHidden = !steps().every(s => s.ok); return CP.render(); }   // atkārtots klikšķis — aizver
    S.setupHidden = false; S.setupOpen = true; ui.go('dashboard');
    setTimeout(() => { const c = U.$('setupCard'); if (c) { ui.scrollToCard?.(c); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 2200); } }, 60);
  };
  /** Vienmēr redzams statuss pie pogām “Bloķēt rīku” un “Saglabāt”: ✓ iestatīts vai ✕ n/m ar progresu */
  function chip() {
    if (!S.root) return '';
    const list = steps(), n = list.filter(s => s.ok).length, all = n === list.length, miss = list.filter(s => !s.ok).map(s => s.l);
    return `<button type="button" class="setup-chip ${all ? 'ok' : 'todo'}" data-act="setupShow" title="${esc(all ? 'Visi iestatīšanas soļi izdarīti' : 'Nav izdarīts: ' + miss.join(', '))}">
      <span class="sc-ic">${all ? '✓' : '✕'}</span><span class="sc-t">${all ? 'Rīks iestatīts' : `Iestatīšana ${n}/${list.length}`}</span>${all ? '' : `<span class="sc-bar"><span style="width:${Math.round(n / list.length * 100)}%"></span></span>`}</button>`;
  }
  A.setupDocs = () => { done().docs = true; CP.store.changed({ silent: true }); ui.goSettingsCard('docsCard'); };

  /* ---------------- 21 gads ---------------- */
  const at21 = birth => { const b = new Date(birth + 'T12:00:00'); if (isNaN(b)) return ''; b.setFullYear(b.getFullYear() + 21); return U.iso(b); };
  { const orig = D.alerts; D.alerts = () => {
    const out = orig(), yearId = D.activeYear(), live = yearId === U.schoolYear(), [from, to] = U.yearSpan(yearId);
    for (const p of S.db.people) {
      if (p.status === 'archived' || p.anon || !p.birth || !D.inYear(p)) continue;
      const d21 = at21(p.birth); if (!d21) continue;
      if (live) {
        const diff = U.daysTo(d21);
        if (diff < 0) out.push({ kind: 'age21', personId: p.id, sev: 2, msg: `${U.full(p)} — jau 21 gads (no ${U.fmtDate(d21)}), līgums beidzies`, when: d21, year: yearId });
        else if (diff <= 60) out.push({ kind: 'age21', personId: p.id, sev: 1, msg: `${U.full(p)} — 21 gads ${diff === 0 ? 'šodien' : 'pēc ' + diff + ' d.'}, līgums beigsies`, when: d21, year: yearId });
      } else if (d21 >= from && d21 <= to) out.push({ kind: 'age21', personId: p.id, sev: 1, msg: `${U.full(p)} — 21 gads šajā mācību gadā (${U.fmtDate(d21)}), līgums beidzas`, when: d21, year: yearId });
    }
    if (live && S.root) { const q = issues().length; if (q) out.push({ kind: 'quality', page: 'quality', sev: 0, msg: `Datu kvalitāte: ${plural(q, 'lieta', 'lietas')} jāsakārto (trūkstoši vai nederīgi dati)`, when: '', year: yearId }); }
    return out.sort((x, y) => (y.top || 0) - (x.top || 0) || y.sev - x.sev || String(x.when || '9').localeCompare(String(y.when || '9')));
  }; }

  /* ---------------- Datu kvalitāte ---------------- */
  const CHECKS = [
    ['dup', 'Iespējami dublikāti'], ['code', 'Nederīgs personas kods'], ['birthCode', 'Dzimšanas datums nesakrīt ar personas kodu'],
    ['nobirth', 'Nav dzimšanas datuma'], ['gender', 'Nav norādīts dzimums'], ['parent', 'Nepilngadīgam nav likumiskā pārstāvja'],
    ['contact', 'Nav neviena tālruņa'], ['badPhone', 'Nederīgs tālrunis'], ['badEmail', 'Nederīgs e-pasts'], ['nogroup', 'Nav grupas šajā gadā'],
    ['phoneShared', 'Viens tālrunis dažādām personām'], ['file', 'Dokumenta fails nav atrasts']
  ];
  const CL = Object.fromEntries(CHECKS);
  function issues() {
    const out = [], ppl = S.db.people.filter(p => p.status !== 'archived' && !p.anon && D.inYear(p)), ign = S.db.settings.qualityIgnore || {};
    const add = (k, p, detail, act = 'edit', extra = {}) => { const key = `${k}:${p.id}${extra.sub ? ':' + extra.sub : ''}`; if (!ign[key]) out.push({ k, key, p, detail, act, ...extra }); };
    const seenDup = new Set();
    for (const p of ppl) {
      const dups = D.duplicates(p, p.id).filter(o => o.status !== 'archived' && !o.anon);
      if (dups.length && !seenDup.has(p.id)) { dups.forEach(o => seenDup.add(o.id)); seenDup.add(p.id); add('dup', p, `līdzīgs: ${dups.map(U.full).join(', ')}`, 'open', { others: dups.map(o => o.id) }); }
      const code = U.codeDigits(p.personalCode);
      if (p.personalCode && !U.checkCode(code)) add('code', p, 'kontrolcipars vai garums neatbilst');
      else if (code.length === 11 && p.birth && U.birthFromCode(code) && U.birthFromCode(code) !== p.birth) add('birthCode', p, `kodā ${U.fmtDate(U.birthFromCode(code))}, kartītē ${U.fmtDate(p.birth)}`);
      if (!p.birth && !U.birthFromCode(code)) add('nobirth', p, 'vajag vecumam, VFS pakāpei un 21 gada brīdinājumam');
      if (!p.gender) add('gender', p, `vajag VFS normatīviem${CP.vfs?.guessG?.(p.first) ? ` · ieteikums pēc vārda: ${CP.vfs.guessG(p.first) === 'f' ? 'meitene' : 'zēns'}` : ''}`, 'qGender', { guess: CP.vfs?.guessG?.(p.first) || '' });
      const age = U.age(p.birth || U.birthFromCode(code));
      if (age != null && age < 18 && !p.parentName && !p.parent2Name) add('parent', p, `${age} g. — nav vecāka vai aizbildņa vārda`);
      if (!p.phone && !p.parentPhone && !p.parent2Phone) add('contact', p, 'ne jaunietim, ne vecākiem');
      for (const f of ['phone', 'parentPhone', 'parent2Phone', 'emergencyPhone']) if (p[f] && !U.validate('phone', p[f]).ok) add('badPhone', p, `${D.PHONE_FIELDS[f]}: ${p[f]}`, 'edit', { sub: f });
      for (const f of ['email', 'parentEmail', 'parent2Email']) if (p[f] && !U.validate('email', p[f]).ok) add('badEmail', p, `${f === 'email' ? 'jaunieša' : f === 'parentEmail' ? 'vecāka' : 'otra vecāka'} e-pasts: ${p[f]}`, 'edit', { sub: f });
      if (!D.groupOf(p)) add('nogroup', p, `mācību gadā ${U.yearLabel(D.activeYear())}`);
      for (const d of D.docsOf(p)) { const st = d._live?.state || d.fileState; if (d.path && (st === 'missing' || st === 'noaccess')) add('file', p, `${d.kind}: ${d.path}${st === 'noaccess' ? ' (nav piekļuves mapei)' : ''}`, 'openDocs', { sub: d.id }); }
    }
    for (const g of D.phoneConflicts()) if (g.suspicious) {
      const who = [...new Map(g.entries.filter(e => ppl.includes(e.p)).map(e => [e.p.id, e.p])).values()]; if (!who.length) continue;
      add('phoneShared', who[0], `${U.prettyPhone(g.num)}: ${g.entries.map(e => e.f === 'phone' ? `${U.full(e.p)} (jaunietis)` : `${e.p[e.f.replace('Phone', 'Name')] || '?'} (${e.role}, ${U.full(e.p)})`).join('; ')}`, 'edit', { sub: g.num });
    }
    return out;
  }
  const Q = () => S.quality || (S.quality = { k: '' });
  CP.pages.quality = {
    render() {
      const all = issues(), q = Q(), counts = {}; all.forEach(x => { counts[x.k] = (counts[x.k] || 0) + 1; });
      if (q.k && !counts[q.k]) q.k = '';
      const list = q.k ? all.filter(x => x.k === q.k) : all;
      const chip = (k, l, n) => `<button class="chipbtn ${q.k === k ? 'on' : ''}" data-act="qFilter" data-arg="${k}">${esc(l)}${n != null ? ` <b>${n}</b>` : ''}</button>`;
      const guessN = all.filter(x => x.k === 'gender' && x.guess).length;
      const nIgn = Object.keys(S.db.settings.qualityIgnore || {}).length;
      const row = x => `<div class="row q-row"><div class="grow"><a href="#" data-person="${x.p.id}">${esc(U.full(x.p))}</a> <span class="small muted">· ${esc(D.groupOf(x.p) || 'bez grupas')}</span><div class="small"><span class="q-k">${esc(CL[x.k])}</span> — ${esc(x.detail)}</div></div>
        ${x.k === 'gender' && x.guess ? `<button class="sm" data-act="qGender" data-arg="${x.p.id}|${x.guess}">Ielikt: ${x.guess === 'f' ? 'meitene' : 'zēns'}</button>` : ''}
        ${x.act === 'openDocs' ? `<button class="sm" data-person="${x.p.id}" data-goto="docs">Atvērt dokumentus</button>` : x.act === 'open' ? `<button class="sm" data-person="${x.p.id}">Atvērt</button>${(x.others || []).map(id => `<button class="sm ghost" data-person="${id}" title="Atvērt otru ierakstu">Otrs: ${esc(U.full(D.person(id)))}</button>`).join('')}` : `<button class="sm" data-act="edit" data-arg="${x.p.id}">✎ Labot</button>`}
        <button class="sm ghost" data-act="qIgnore" data-arg="${esc(x.key)}" title="Viss kārtībā — vairs nerādīt">Nerādīt</button></div>`;
      return `<div class="page">${ui.pageHead('Datu kvalitāte', `Aktuālie jaunsargi un kandidāti mācību gadā ${esc(U.yearLabel(D.activeYear()))}: ko vajadzētu papildināt vai labot.`, guessN ? `<button class="sm" data-act="qGenderAll">Ielikt ieteikto dzimumu visiem (${guessN})</button>` : '')}
        <section class="card">${all.length ? `<div class="chips q-chips">${chip('', 'Viss', all.length)}${CHECKS.filter(([k]) => counts[k]).map(([k, l]) => chip(k, l, counts[k])).join('')}</div>
          <div class="q-list">${list.map(row).join('')}</div>` : '<p class="okc"><b>✓ Dati ir kārtībā.</b> Nav atrasts nekas, ko vajadzētu labot.</p>'}
          ${nIgn ? `<p class="small muted" style="margin-top:12px">Paslēpti ${plural(nIgn, 'ieraksts', 'ieraksti')} (“Nerādīt”). <a href="#" data-act="qUnignore">Rādīt atkal</a></p>` : ''}
          <p class="small muted" style="margin-top:12px">Dzimuma ieteikums ir pēc vārda galotnes — pārbaudi. Dokumentu faili tiek pārbaudīti, atverot sadaļu Dokumenti.</p></section></div>`;
    }
  };
  A.qFilter = k => { Q().k = k; CP.render(); };
  A.qIgnore = key => { const s = S.db.settings; s.qualityIgnore = { ...(s.qualityIgnore || {}), [key]: U.iso() }; CP.store.changed(); };
  A.qUnignore = () => { S.db.settings.qualityIgnore = {}; CP.store.changed(); };
  const setGender = (p, g) => { if (!p || !['m', 'f'].includes(g)) return; p.gender = g; p.updatedAt = U.now(); };
  A.qGender = arg => { const [pid, g] = String(arg).split('|'); setGender(D.person(pid), g); CP.store.changed(); };
  A.qGenderAll = () => {
    const xs = issues().filter(x => x.k === 'gender' && x.guess); if (!xs.length || !confirm(`Ielikt dzimumu pēc vārda ${plural(xs.length, 'jaunsargam', 'jaunsargiem')}? Pārbaudi sarakstu pēc tam.`)) return;
    xs.forEach(x => setGender(x.p, x.guess)); CP.store.changed(); ui.toast(`Dzimums ielikts ${plural(xs.length, 'jaunsargam', 'jaunsargiem')}`, 'ok');
  };

  CP.setup = { instProblems, chip, card: setupCard, steps, instCard, issues, at21 };
})(window.CP);
