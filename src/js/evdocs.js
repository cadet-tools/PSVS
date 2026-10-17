/* =====================================================================
   Pasākumu dokumenti — kopīgs Veidlapām (S.db.events) un Apmeklējuma
   pasākumiem (S.db.sessions ar veidu ≠ Nodarbība).
   • Dalībnieka dokumenti (vecāku atļauja, aptaujas lapa, citi) → S.db.documents
     ar eventId; redzami arī personas kartītē.
   • Kopīgie (parakstu lapa, aizpildīts nometnes žurnāls, citi) → ev.docs.
   • Faili: Macibu_gadi/<gads>/Pasakumi/<datums veids nosaukums>/[Dalibnieki/].
   Avots (src) reģistrē: get(id), prepare(id) → saglabāts ev, isCamp(ev),
   folder(ev), title(ev), after() — pārzīmēšana.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const st = () => S.db.settings;
  const SRC = {};
  const EV = {};
  EV.register = (name, ad) => { SRC[name] = ad; };
  EV.kinds = camp => ({
    person: [...(st().evDocsAll || []), ...(camp ? st().evDocsCamp || [] : [])],
    event: [...(st().evDocsEvent || []), ...(camp ? st().evDocsEventCamp || [] : [])]
  });
  EV.pDocs = (evId, pid) => evId ? S.db.documents.filter(d => d.eventId === evId && d.personId === pid) : [];
  EV.dirOf = (yearId, folder) => ['Macibu_gadi', yearId || D.activeYear(), 'Pasakumi', String(folder || 'Pasākums').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90)];
  const short = d => (d.title || d.kind).split(' — ')[0];

  let up = null;
  const input = () => {
    let i = U.$('evDocFile');
    if (!i) { i = document.createElement('input'); i.type = 'file'; i.id = 'evDocFile'; i.hidden = true; document.body.appendChild(i); i.addEventListener('change', onFile); }
    return i;
  };
  /** arg: "<src>|<evId>|p|<pid>|<veids>" vai "<src>|<evId>|e||<veids>"; tukšs veids → “Cits” ar nosaukumu */
  A.evDocAdd = arg => {
    if (!S.root) return CP.needRoot?.() || ui.toast('Vispirms izvēlies datu mapi', 'warn');
    const [src, evId, scope, pid, kind0] = String(arg).split('|'), ad = SRC[src]; if (!ad) return;
    let kind = kind0, title = '';
    if (!kind) { title = (prompt(scope === 'p' ? 'Kas tas par dokumentu? (piem., Medikamentu lietošanas atļauja)' : 'Kas tas par dokumentu? (piem., Maršruta karte, Akts)') || '').trim(); if (!title) return; kind = 'Cits'; }
    const ev = ad.prepare(evId); if (!ev?.id) return;   // pasākumam jābūt saglabātam
    up = { src, evId: ev.id, scope, pid, kind, title };
    const i = input(); i.multiple = scope === 'e'; i.value = ''; i.click();
  };
  async function onFile(e) {
    const files = [...e.target.files]; e.target.value = ''; const c = up; up = null;
    const ad = c && SRC[c.src], ev = ad?.get(c.evId); if (!ev || !files.length) return;
    let n = 0;
    for (const f of files) {
      const ext = (f.name.split('.').pop() || 'pdf').toLowerCase(), label = c.title || c.kind, dir = ad.folder(ev);
      try {
        if (c.scope === 'p') {
          const p = D.person(c.pid); if (!p) continue;
          const path = await CP.store.saveFile([...dir, 'Dalibnieki'], `${U.sortName(p)} - ${label}.${ext}`, f);
          if (!path) continue;
          S.db.documents.push({ id: U.uid(), personId: p.id, kind: c.kind, title: `${label} — ${ad.title(ev)}`, eventId: ev.id, format: ext === 'edoc' ? 'edoc' : 'pdf', path, sourceId: 'main', received: U.iso(), addedAt: U.now(), yearId: ev.yearId || D.activeYear(), review: 'received', size: f.size });
          D.audit(p.id, 'doc-add', [`${label} (${ad.title(ev)})`]);
        } else {
          const path = await CP.store.saveFile(dir, `${label}.${ext}`, f);
          if (!path) continue;
          (ev.docs = ev.docs || []).push({ id: U.uid(), kind: c.kind, title: c.title || '', path, at: U.now(), size: f.size });
        }
        n++;
      } catch (err) { ui.toast('Neizdevās saglabāt ' + f.name + ': ' + err.message, 'err', 9000); }
    }
    if (n) { ad.saved?.(ev); CP.store.changed(); ad.after(); ui.toast(n === 1 ? `Pievienots: ${c.title || c.kind}` : `Pievienoti ${n} faili`, 'ok'); }
  }
  /** arg: "<src>|<evId>|p|<docId>" vai "<src>|<evId>|e|<docId>" — noņem ierakstu, fails paliek */
  A.evDocDel = arg => {
    const [src, evId, scope, id] = String(arg).split('|'), ad = SRC[src], ev = ad?.get(evId); if (!ev) return;
    if (scope === 'p') {
      const d = S.db.documents.find(x => x.id === id); if (!d || !confirm(`Noņemt “${d.title || d.kind}” no pasākuma un kartītes?\n\nFails mapē paliek.`)) return;
      S.db.documents = S.db.documents.filter(x => x.id !== id); D.audit(d.personId, 'doc-remove', [d.title || d.kind]);
    } else {
      const d = (ev.docs || []).find(x => x.id === id); if (!d || !confirm(`Noņemt “${d.title || d.kind}” no pasākuma?\n\nFails mapē paliek.`)) return;
      ev.docs = ev.docs.filter(x => x.id !== id);
    }
    ad.saved?.(ev); CP.store.changed(); ad.after();
  };
  /** Dalībnieka dokumentu pogas: ✓ atvērt / ＋ pievienot / ＋ cits */
  EV.chips = (src, ev, p) => {
    const ad = SRC[src], K = EV.kinds(ad.isCamp(ev)).person, mine = EV.pDocs(ev.id, p.id), base = `${src}|${ev.id || ''}`;
    const okChip = (d, l) => `<span class="evdoc ok"><button type="button" class="sm" data-act="view" data-arg="main|${esc(d.path)}" title="Atvērt">✓ ${esc(l)}</button><button type="button" class="sm ghost" data-act="evDocDel" data-arg="${base}|p|${d.id}" title="Noņemt">✕</button></span>`;
    const chip = k => { const d = mine.find(x => x.kind === k); return d ? okChip(d, k) : `<button type="button" class="sm evdoc miss" data-act="evDocAdd" data-arg="${base}|p|${p.id}|${esc(k)}" title="Pievienot skenētu dokumentu">＋ ${esc(k)}</button>`; };
    return `<div class="evdocs">${K.map(chip).join('')}${mine.filter(d => !K.includes(d.kind)).map(d => okChip(d, short(d))).join('')}<button type="button" class="sm ghost" data-act="evDocAdd" data-arg="${base}|p|${p.id}|" title="Pievienot citu dokumentu">＋ cits</button></div>`;
  };
  /** Kopīgo dokumentu karte + dalībnieku dokumentu skaits */
  EV.card = (src, ev, people, hint = 'pievieno pie katra dalībnieka sarakstā') => {
    const ad = SRC[src], K = EV.kinds(ad.isCamp(ev)), docs = ev.docs || [], base = `${src}|${ev.id || ''}`;
    const per = K.person.map(k => { const n = people.filter(p => EV.pDocs(ev.id, p.id).some(d => d.kind === k)).length; return `<span class="pill ${people.length && n === people.length ? 'ok' : n < people.length ? 'warn' : ''}">${esc(k)}: ${n}/${people.length}</span>`; }).join(' ');
    const row = d => `<div class="row"><div class="grow"><b>${esc(d.title || d.kind)}</b><div class="small muted">${esc(U.fmtDate(String(d.at).slice(0, 10)))} · ${esc(d.path)}</div></div><button type="button" class="sm mainbtn" data-act="view" data-arg="main|${esc(d.path)}">Atvērt</button><button type="button" class="sm ghost danger" data-act="evDocDel" data-arg="${base}|e|${d.id}" title="Noņemt no pasākuma (fails paliek)">✕</button></div>`;
    return `<section class="card evdocs-card" id="evDocsCard"><h3>${CP.ic('files')}Pasākuma dokumenti</h3>
      ${K.person.length ? `<p class="small" style="margin-top:0">Dalībnieku dokumenti: ${per || '—'} <span class="muted">— ${esc(hint)}.</span></p>` : ''}
      ${K.event.map(k => { const have = docs.filter(d => d.kind === k); return `<div class="row ${have.length ? '' : 'evdoc-need'}"><div class="grow"><b>${have.length ? '✓' : '✗'} ${esc(k)}</b>${have.length ? '' : '<div class="small muted">vēl nav pievienots</div>'}</div><button type="button" class="sm ${have.length ? '' : 'mainbtn'}" data-act="evDocAdd" data-arg="${base}|e||${esc(k)}">＋ ${have.length ? 'Vēl' : 'Pievienot'}</button></div>${have.map(row).join('')}`; }).join('')}
      ${docs.filter(d => !K.event.includes(d.kind)).map(row).join('')}
      <div class="actions" style="margin-top:8px"><button type="button" class="sm" data-act="evDocAdd" data-arg="${base}|e||">＋ Cits dokuments</button></div>
      <p class="small muted">Faili tiek saglabāti mapē ${esc(ad.folder(ev).join(' › '))}. Dalībnieku dokumenti redzami arī katra jaunsarga kartītē.</p></section>`;
  };
  /** Personas kartītei: ✓/✗ rinda par pasākuma dokumentiem */
  EV.statusLine = (camp, evId, pid) => {
    const K = EV.kinds(camp).person, mine = EV.pDocs(evId, pid);
    if (!K.length && !mine.length) return '';
    return `<div class="small">${K.map(k => mine.some(d => d.kind === k) ? `<span class="okc">✓ ${esc(k)}</span>` : `<span class="red">✗ ${esc(k)}</span>`).join(' · ')}${mine.filter(d => !K.includes(d.kind)).map(d => ` · <span class="okc">✓ ${esc(short(d))}</span>`).join('')}</div>`;
  };
  CP.evDocs = EV;
})(window.CP);
