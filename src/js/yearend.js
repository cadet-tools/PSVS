/* =====================================================================
   Mācību gada noslēguma vednis (TESTA KANĀLS).
   Atver: gada izvēlne → “Noslēgt mācību gadu…”, Iestatījumi → Mācību gadi, meklēšana/palīgs.
   Soļi: 1) trūkstošie dokumenti → 2) neatdotais ekipējums → 3) kopsavilkumi visiem →
         4) nākamais gads un kas turpina → 5) rezerves kopija → 6) pāreja uz jauno gadu.
   Nekas netiek darīts automātiski — katrs solis izmanto esošās rīka funkcijas.
   Progress: settings.yearEnd[gadaId] = { done: { solis: laiks }, at }.
   ===================================================================== */
(function (CP) {
  'use strict';
  if (CP.CHANNEL !== 'test') return;
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, ic = (n, f = '') => CP.ic(n, f);
  const plural = (n, a, b) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? a : b}`;
  let step = 0, Y = '';
  const nextOf = y => { const m = /^(\d{4})-\d{4}$/.exec(y); return m ? U.yearId(+m[1] + 1) : ''; };
  const st = () => { const s = S.db.settings; s.yearEnd = s.yearEnd || {}; return (s.yearEnd[Y] = s.yearEnd[Y] || { done: {} }); };
  const roster = () => D.peopleInYear(Y).filter(p => p.status !== 'archived' && !p.anon).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));

  /* --- Soļu dati --- */
  const missing = () => roster().map(p => ({ p, m: D.missingDocs(p) })).filter(x => x.m.length);
  const openEq = () => (S.db.equipment || []).filter(e => !e.returned && !e.keep && D.inYear(D.person(e.personId), Y));
  const STEPS = [
    { k: 'docs', t: 'Trūkstošie dokumenti', i: 'file', auto: () => !missing().length },
    { k: 'eq', t: 'Neatdotais ekipējums', i: 'backpack', auto: () => !openEq().length },
    { k: 'sum', t: 'Kopsavilkumi', i: 'chart', auto: () => false },
    { k: 'move', t: 'Nākamais gads', i: 'users', auto: () => !!D.yearById(nextOf(Y)) && D.peopleInYear(nextOf(Y)).length > 0 },
    { k: 'backup', t: 'Rezerves kopija', i: 'save', auto: () => false },
    { k: 'finish', t: 'Pāreja uz jauno gadu', i: 'check', auto: () => D.activeYear() !== Y },
  ];
  const isDone = s => !!st().done[s.k] || s.auto();

  function body(s) {
    const nx = nextOf(Y), hasNx = !!D.yearById(nx);
    const mark = `<label class="check ye-mark"><input type="checkbox" data-yemark="${s.k}" ${st().done[s.k] ? 'checked' : ''}> Atzīmēt šo soli kā izdarītu</label>`;
    const pRow = (p, txt, tab) => `<div class="row"><div class="grow"><b>${esc(U.sortName(p))}</b> <small class="muted">${esc(D.groupOf(p, Y) || '')}</small><div class="small">${esc(txt)}</div></div><button type="button" class="sm" data-act="yeRun" data-arg="@person|${p.id}|${tab}">Atvērt</button></div>`;
    if (s.k === 'docs') {
      const xs = missing();
      return `<p>Pārbaudi, vai visiem šī gada jaunsargiem ir obligātie dokumenti (${esc((S.db.settings.requiredDocs || []).join(', ') || 'nav norādīti')}). Gada beigās tas ir vienkāršāk nekā rudenī.</p>
        ${xs.length ? `<p class="hint warn">${plural(xs.length, 'personai', 'personām')} trūkst dokumentu.</p><div class="ye-list">${xs.map(x => pRow(x.p, 'Trūkst: ' + x.m.join(', '), 'docs').replace('</div><button', `</div><button type="button" class="sm ghost" data-act="yeRun" data-arg="remindDocs|${x.p.id}" title="Sagatavot atgādinājumu vecākiem">Atgādināt</button><button`)).join('')}</div>`
        : '<p class="okc"><b>✓ Visiem ir obligātie dokumenti.</b></p>'}
        <div class="actions"><button type="button" class="sm" data-act="yeRun" data-arg="@page|documents">Atvērt Dokumentus</button></div>${mark}`;
    }
    if (s.k === 'eq') {
      const xs = openEq(), by = new Map(); for (const e of xs) { if (!by.has(e.personId)) by.set(e.personId, []); by.get(e.personId).push(e); }
      return `<p>Ekipējums, kas izsniegts šī gada dalībniekiem un vēl nav atdots. Ja jaunsargs turpina un patur ekipējumu, ierakstā atzīmē “Patur”.</p>
        ${xs.length ? `<p class="hint warn">${plural(xs.length, 'priekšmets', 'priekšmeti')} pie ${plural(by.size, 'personas', 'personām')}.</p><div class="ye-list">${[...by].map(([pid, es]) => pRow(D.person(pid), es.map(e => e.item + (Number(e.qty) > 1 ? ' ×' + e.qty : '')).join(', '), 'equipment')).join('')}</div>`
        : '<p class="okc"><b>✓ Viss ekipējums ir atdots vai atzīmēts kā paturēts.</b></p>'}
        <div class="actions"><button type="button" class="sm" data-act="yeRun" data-arg="@page|equipment">Atvērt Ekipējumu</button></div>${mark}`;
    }
    if (s.k === 'sum') {
      const n = roster().length, have = (S.db.documents || []).filter(d => d.kind === 'Kopsavilkums' && d.yearId === Y).length;
      return `<p>Jaunsarga kopsavilkums ir PDF ar gada rādītājiem (apmeklējums, pasākumi, kvalifikācijas, VFS) un tavu komentāru. Katrai personai tiek izveidots savs fails un saglabāts viņa dokumentu mapē; visi kopā — ZIP failā.</p>
        <p class="small muted">Šajā gadā jau ${plural(have, 'saglabāts kopsavilkums', 'saglabāti kopsavilkumi')}.</p>
        <div class="actions"><button type="button" class="mainbtn" data-act="yeRun" data-arg="sumNew|*" ${n ? '' : 'disabled'}>${ic('chart')}Izveidot kopsavilkumus visiem (${n})</button></div>${mark}`;
    }
    if (s.k === 'move') {
      const nIn = hasNx ? D.peopleInYear(nx).length : 0;
      return `<p>Nākamais mācību gads ir <b>${esc(U.yearLabel(nx))}</b>. ${hasNx ? `Tas jau ir izveidots; tajā ir ${plural(nIn, 'dalībnieks', 'dalībnieki')}.` : 'Tas vēl nav izveidots.'}</p>
        <p class="small">Pārcelšanas logā atzīmē, kuri jaunsargi turpina. Pārējos var uzreiz pārvietot uz arhīvu — viņu dati paliek un tos var atjaunot. Profili, dokumenti un ekipējums netiek pārvietoti — mainās tikai dalība gadā.</p>
        <div class="actions">${hasNx ? '' : `<button type="button" class="mainbtn" data-act="yeAddNext">${ic('plus')}Izveidot ${esc(U.yearSlash(nx))}</button>`}
          <button type="button" class="${hasNx ? 'mainbtn' : ''}" data-act="yeRun" data-arg="@move" ${hasNx ? '' : 'disabled'}>${ic('users')}Izvēlēties, kas turpina</button></div>${mark}`;
    }
    if (s.k === 'backup') {
      const e = CP.encBackup?.card ? '<p class="small muted">Ja ir iestatīta šifrētā kopija (Google Drive vai cita mape), to var atjaunot Iestatījumos → Drošība.</p>' : '';
      return `<p>Pirms pārejas uz jauno gadu izveido rezerves kopiju — tā saglabā gada beigu stāvokli. Pēc tam rīks pārbauda, vai kopiju var atjaunot.</p>${e}
        <div class="actions"><button type="button" class="mainbtn" data-act="yeBackup">${ic('save')}Izveidot un pārbaudīt kopiju</button></div>${mark}`;
    }
    const left = STEPS.slice(0, 5).filter(x => !isDone(x));
    return `<p>${D.activeYear() !== Y ? `✓ Rīkā jau izvēlēts ${esc(U.yearLabel(D.activeYear()))}.` : `Pārslēdzot uz <b>${esc(U.yearLabel(nx))}</b>, sarakstos būs redzami nākamā gada dalībnieki. Iepriekšējā gada dati paliek — tos var atvērt gada izvēlnē jebkurā laikā.`}</p>
      ${left.length ? `<p class="hint warn">Vēl nav izdarīts: ${left.map(x => esc(x.t)).join(', ')}. To var izdarīt arī vēlāk.</p>` : '<p class="okc"><b>✓ Visi soļi izdarīti.</b></p>'}
      <div class="actions"><button type="button" class="mainbtn" data-act="yeFinish" ${hasNx && D.activeYear() === Y ? '' : 'disabled'}>${ic('check')}Pārslēgties uz ${esc(U.yearSlash(nx))}</button></div>`;
  }
  function draw() {
    let d = U.$('yeDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'yeDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const s = STEPS[step], nDone = STEPS.filter(isDone).length;
    d.innerHTML = `<form method="dialog"><header class="dlg-head"><h2>${ic('calendar')}Mācību gada noslēgums — ${esc(U.yearSlash(Y))}</h2><button class="ghost" value="x" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body ye">
        <ol class="ye-steps">${STEPS.map((x, i) => `<li><button type="button" class="${i === step ? 'on' : ''} ${isDone(x) ? 'done' : ''}" data-act="yeStep" data-arg="${i}"><span class="ye-n">${isDone(x) ? '✓' : i + 1}</span>${esc(x.t)}</button></li>`).join('')}</ol>
        <div class="ye-body"><h3>${ic(s.i)}${step + 1}. ${esc(s.t)}</h3>${body(s)}</div>
      </div>
      <footer class="dlg-foot"><span class="small muted">Izdarīti ${nDone} no ${STEPS.length} soļiem · progress tiek saglabāts</span><span class="grow"></span>
        <button type="button" data-act="yeStep" data-arg="${step - 1}" ${step ? '' : 'disabled'}>← Atpakaļ</button>
        ${step < STEPS.length - 1 ? `<button type="button" class="mainbtn" data-act="yeStep" data-arg="${step + 1}">Tālāk →</button>` : '<button class="mainbtn" value="ok">Aizvērt</button>'}</footer></form>`;
    if (!d.open) d.showModal();
  }
  A.yearEnd = arg => {
    U.$('yearMenu')?.classList.add('hidden');
    if (!S.db) return;
    const ny = /^\d{4}-\d{4}$/.test(arg || '') && D.yearById(arg) ? arg : D.activeYear();
    if (ny !== Y) { Y = ny; const i = STEPS.findIndex(x => !isDone(x)); step = i < 0 ? STEPS.length - 1 : i; }   // tas pats gads — paliek tajā pašā solī
    st().at = st().at || U.now();
    draw();
  };
  A.yeStep = i => { step = Math.max(0, Math.min(STEPS.length - 1, Number(i) || 0)); draw(); };
  const save = () => CP.store.changed({ silent: true });
  CP.changeHandlers.push(e => {
    const k = e.target.dataset?.yemark; if (!k) return false;
    if (e.target.checked) st().done[k] = U.now(); else delete st().done[k];
    save(); draw(); return true;
  });
  /** Iziet no vedņa uz rīka funkciju; paziņojumā — poga atgriezties */
  A.yeRun = arg => {
    const [a, x, y] = String(arg || '').split('|');
    U.$('yeDialog')?.close();
    if (a === '@person') ui.go('person', { person: x, tab: y || 'overview' });
    else if (a === '@page') ui.go(x);
    else if (a === '@move') { A.openMove(Y, nextOf(Y)); }
    else if (A[a]) { if (a === 'sumNew') { st().done.sum = U.now(); save(); } A[a](x); }
    ui.toast('Gada noslēguma vednis ir aizvērts', 'info', 15000, { act: 'yearEnd', arg: Y + '', label: 'Atpakaļ uz vedni' });
  };
  A.yeAddNext = async () => {
    const nx = nextOf(Y); if (!nx || D.yearById(nx)) return draw();
    S.db.years.push({ id: nx, start: Number(nx.slice(0, 4)), createdAt: U.now() });
    S.db.years.sort((a, b) => a.start - b.start);
    S.db.settings.yearsDeleted = (S.db.settings.yearsDeleted || []).filter(z => z !== nx);
    CP.store.changed({ silent: true });
    if (S.root) { try { await CP.store.ensureYearFolders(); } catch (e) { ui.toast('Gada mapes neizdevās izveidot: ' + e.message, 'warn'); } }
    ui.toast(`${U.yearLabel(nx)} ir izveidots`, 'ok'); draw();
  };
  A.yeBackup = async () => {
    const r = await CP.store.backupNow(); if (!r?.ok) return;
    let t = null; try { const list = await CP.store.listBackups(); if (list[0]) t = await CP.store.testRestore(list[0].name); } catch (e) { t = { ok: false, error: e.message }; }
    if (t?.ok) { st().done.backup = U.now(); S.db.settings.restoreCheckAt = U.now(); save(); ui.toast('✓ Kopija izveidota un pārbaudīta — to var atjaunot', 'ok', 8000); }
    else ui.toast('Kopija izveidota, bet pārbaude neizdevās: ' + (t?.error || 'nav atrasta'), 'err', 12000);
    draw();
  };
  A.yeFinish = () => {
    const nx = nextOf(Y); if (!D.yearById(nx)) return;
    st().done.finish = U.now(); A.setYear(nx); draw();
  };
  CP.yearEnd = { open: A.yearEnd, STEPS, state: () => st() };
})(window.CP);
