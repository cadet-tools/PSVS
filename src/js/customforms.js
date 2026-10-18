/* =====================================================================
   Savas veidlapas — jebkura lietotāja Word (.docx) veidne ar {atzīmēm}, ne tikai instruktāža / nometne / līgums.
   • Veidlapas → “Savas Word veidnes” → “⬆ Sava veidlapa”. Glabājas settings.docTemplates (type 'custom').
   • Režīms nosakās pats:
       – SARAKSTS: tabulas rindā ir personas atzīmes ({nr} {vards} …) → viens dokuments, rinda katrai personai;
       – KATRAI PERSONAI SAVS: personas atzīmes teksta vietās → katrai izvēlētajai personai savs dokuments.
   • Atzīmes var rakstīt ar garumzīmēm un lielajiem burtiem: {Vārds} = {vards}.
   • Pirms saglabāšanas dokumentu var APSKATĪT rīkā (Word skatītājs), tad lejupielādēt / saglabāt.
   • Katrai personai savs → pēc izvēles saglabā personas dokumentu mapē un piesaista kartītei.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const st = () => S.db.settings;
  const tpls = () => (st().docTemplates || []).filter(t => t.type === 'custom');
  const fmtD = iso => { const s = U.fmtDate(iso); return s ? s + '.' : ''; };
  const phone = n => n ? (U.prettyPhone ? U.prettyPhone(n) : n) : '';
  const opt = (k, v) => (CP.FIELDS.find(f => f.k === k)?.opts || []).find(o => o[0] === v)?.[1] || v || '';

  /* ---------- Atzīmes ---------- */
  const PERSON_HELP = [
    ['{nr}', 'kārtas numurs sarakstā'], ['{vards} {uzvards} {vards_uzvards} {uzvards_vards}', 'vārds, uzvārds'], ['{personas_kods} {dzimsanas_datums} {vecums} {dzimums}', 'personas dati'],
    ['{grupa} {statuss} {iestasanas_datums} {apliecibas_nr}', 'dalība'], ['{skola} {klase} {talrunis} {epasts} {adrese} {faktiska_adrese}', 'mācības un kontakti'],
    ['{vecaks} {vecaka_saistiba} {vecaka_personas_kods} {vecaka_talrunis} {vecaka_epasts} {vecaka_adrese}', 'likumiskais pārstāvis'], ['{vecaks2} {vecaka2_talrunis} {vecaka2_epasts}', 'otrs vecāks'],
    ['{arkartas_kontakts} {arkartas_talrunis}', 'ārkārtas kontakts']
  ];
  const GLOBAL_HELP = [['{datums} {gads} {macibu_gads} {vieta}', 'dokumenta datums (izvēlas logā), vieta'], ['{instruktors} {i_amats} {i_talrunis} {i_epasts} {i_parvalde} {i_nodala}', 'instruktora dati'], ['{vieniba} {dalibnieku_skaits}', 'vienības nosaukums, personu skaits']];
  const PERSON_KEYS = ['nr', 'vards', 'uzvards', 'vards_uzvards', 'uzvards_vards', 'personas_kods', 'dzimsanas_datums', 'vecums', 'dzimums', 'grupa', 'grupa_p', 'statuss', 'iestasanas_datums', 'apliecibas_nr',
    'skola', 'klase', 'talrunis', 'epasts', 'adrese', 'faktiska_adrese', 'vecaks', 'vecaki', 'vecaka_saistiba', 'vecaka_personas_kods', 'vecaka_talrunis', 'vecaka_epasts', 'vecaka_adrese',
    'vecaks2', 'vecaka2_talrunis', 'vecaka2_epasts', 'arkartas_kontakts', 'arkartas_talrunis', 'rindas_datums'];
  const GLOBAL_KEYS = ['datums', 'gads', 'macibu_gads', 'vieta', 'instruktors', 'i_amats', 'i_talrunis', 'i_epasts', 'i_parvalde', 'i_nodala', 'vieniba', 'dalibnieku_skaits'];
  function personMap(p, i, o) {
    const y = D.activeYear();
    return {
      nr: `${i + 1}.`, vards: p.first || '', uzvards: p.last || '', vards_uzvards: U.full(p), uzvards_vards: U.sortName(p), personas_kods: p.personalCode || '',
      dzimsanas_datums: fmtD(p.birth), vecums: p.birth && U.age ? String(U.age(p.birth) ?? '') : '', dzimums: p.gender ? opt('gender', p.gender) : '',
      grupa: D.groupOf(p, y) || '', grupa_p: D.groupOf(p, y) || '', statuss: opt('status', D.partStatus(p, y) === 'archived' ? '' : D.partStatus(p, y)), iestasanas_datums: fmtD(p.joined), apliecibas_nr: p.idCard?.number || '',
      skola: p.school || '', klase: p.schoolClass || '', talrunis: phone(p.phone), epasts: p.email || '', adrese: p.addressDeclared || '', faktiska_adrese: p.addressActual || p.addressDeclared || '',
      vecaks: p.parentName || '', vecaki: [[p.parentName, phone(p.parentPhone)], [p.parent2Name, phone(p.parent2Phone)]].filter(([n, t]) => n || t).map(x => x.filter(Boolean).join(', ')).join('; '),
      vecaka_saistiba: p.parentRelation || '', vecaka_personas_kods: p.parentCode || '', vecaka_talrunis: phone(p.parentPhone), vecaka_epasts: p.parentEmail || '', vecaka_adrese: p.parentAddressDeclared || '',
      vecaks2: p.parent2Name || '', vecaka2_talrunis: phone(p.parent2Phone), vecaka2_epasts: p.parent2Email || '', arkartas_kontakts: p.emergencyName || '', arkartas_talrunis: phone(p.emergencyPhone),
      rindas_datums: fmtD(o.date)
    };
  }
  function globalMap(o, n) {
    const I = st().instructor || {};
    return { datums: fmtD(o.date), gads: String(o.date || U.iso()).slice(0, 4), macibu_gads: U.yearLabel(D.activeYear()), vieta: o.place || I.place || '', instruktors: I.name || '', i_amats: I.position || '',
      i_talrunis: phone(I.phone), i_epasts: I.email || '', i_parvalde: I.parvalde || '', i_nodala: I.nodala || '', vieniba: CP.unit?.get().name || '', dalibnieku_skaits: String(n) };
  }

  /* ---------- Veidnes pievienošana ---------- */
  async function analyse(t) {
    const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
    const buf = await (await h.getFile()).arrayBuffer(), sc = await CP.docxFill.scan(buf);
    const known = new Set([...PERSON_KEYS, ...GLOBAL_KEYS]);
    t.mode = sc.inRows.some(k => PERSON_KEYS.includes(k)) ? 'list' : 'each';
    t.unknown = sc.all.filter(k => !known.has(k)).slice(0, 20);
    t.tags = sc.all.length;
    return buf;
  }
  /** forms.js tplDocFile → pēc saglabāšanas izsauc šo veidam 'custom' */
  async function added(t) {
    try {
      await analyse(t); CP.store.changed();
      ui.toast(!t.tags ? `Veidne “${t.name}” pievienota, bet tajā nav nevienas {atzīmes} — rīks to neaizpildīs. Pieejamās atzīmes: Veidlapas → Savas Word veidnes → “Pieejamās atzīmes”.`
        : `Veidne “${t.name}” pievienota: ${t.mode === 'list' ? 'saraksts (rinda katrai personai)' : 'katrai personai savs dokuments'}.${t.unknown.length ? ` Nezināmas atzīmes: ${t.unknown.map(k => '{' + k + '}').join(' ')}` : ''}`, t.tags && !t.unknown.length ? 'ok' : 'warn', 12000);
    } catch (e) { ui.toast('Veidni neizdevās nolasīt: ' + e.message, 'err', 9000); }
  }

  /* ---------- Aizpildīšanas logs ---------- */
  let dlg = null;   // { tid, pids:Set, group, q, date, place, save }
  const roster = () => D.peopleInYear().filter(p => p.status !== 'archived' && !p.anon).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
  A.cfNew = arg => {
    const [tid, pid] = String(arg || '').split('|'), list = tpls();
    if (!list.length) return ui.toast('Vispirms pievieno savu veidlapu: Veidlapas → Savas Word veidnes → “⬆ Sava veidlapa”.', 'warn', 9000);
    dlg = { tid: tid || dlg?.tid || list[0].id, pids: new Set(pid ? [pid] : []), group: '', q: '', date: U.iso(), place: st().instructor?.place || '', save: !!S.root };
    if (!list.some(t => t.id === dlg.tid)) dlg.tid = list[0].id;
    draw(); U.$('cfDialog').showModal();
  };
  const cur = () => tpls().find(t => t.id === dlg.tid);
  function draw() {
    let d = U.$('cfDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'cfDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const t = cur(), list = roster().filter(p => (!dlg.group || D.groupOf(p) === dlg.group) && (!dlg.q || U.norm(U.full(p) + ' ' + U.sortName(p)).includes(U.norm(dlg.q)))), n = dlg.pids.size;
    const modeTxt = !t ? '' : t.mode === 'list' ? 'Saraksts — viens dokuments, tabulā rinda katrai izvēlētajai personai' : 'Katrai izvēlētajai personai savs dokuments';
    d.innerHTML = `<form><header class="dlg-head"><h2>${ic('file')}Aizpildīt savu veidlapu</h2><button type="button" class="ghost" data-close="cfDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body">
        <div class="sum-bar"><select data-cf="tid">${tpls().map(x => `<option value="${x.id}" ${x.id === dlg.tid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          <label class="small muted">Datums <input type="date" data-cf="date" value="${esc(dlg.date)}"></label><label class="small muted">Vieta <input data-cf="place" value="${esc(dlg.place)}" style="width:140px"></label></div>
        <p class="small" style="margin:6px 0">${esc(modeTxt)}${t?.unknown?.length ? ` · <span class="warn">nezināmas atzīmes paliks neaizpildītas: ${esc(t.unknown.map(k => '{' + k + '}').join(' '))}</span>` : ''}${t && !t.tags ? ' · <span class="warn">veidnē nav {atzīmju}</span>' : ''}</p>
        <div class="field"><label>Personas</label>
          <div class="sum-bar" style="margin-bottom:6px"><select data-cf="group"><option value="">Visas grupas</option>${D.groups().map(g => `<option ${dlg.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
            <input type="search" data-cf="q" placeholder="Meklēt…" value="${esc(dlg.q)}"><button type="button" class="sm ghost" data-act="cfAll">Atzīmēt redzamos</button><button type="button" class="sm ghost" data-act="cfNone">Notīrīt</button><span class="muted small">Atzīmēti: <b>${n}</b></span></div>
          <div class="sum-list">${list.map(p => `<div class="sum-row"><label class="check"><input type="checkbox" data-cfp="${p.id}" ${dlg.pids.has(p.id) ? 'checked' : ''}> ${esc(U.sortName(p))} <small class="muted">${esc(D.groupOf(p))}</small></label></div>`).join('') || '<p class="muted small">Nav personu.</p>'}</div></div>
        <label class="check"><input type="checkbox" data-cf="save" ${dlg.save && S.root ? 'checked' : ''} ${S.root ? '' : 'disabled'}> ${t?.mode === 'list' ? 'Saglabāt kopiju mapē “Veidlapas” (mācību gada mapē)' : 'Saglabāt katras personas dokumentu mapē un piesaistīt kartītei'}</label>
        <p class="small muted">Vispirms vari <b>apskatīt</b>, kā izskatās aizpildītais dokuments${t?.mode === 'each' ? ' (pirmajai personai)' : ''}. Atzīmes var rakstīt arī ar garumzīmēm: {Vārds} = {vards}.</p>
      </div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="cfDialog">Atcelt</button><button type="button" data-act="cfPreview" ${n ? '' : 'disabled'}>${ic('eye', '👁')} Apskatīt</button><button class="mainbtn" type="submit" ${n ? '' : 'disabled'}>${ic('download', '⬇')} Sagatavot${t?.mode === 'each' && n > 1 ? ` (${n})` : ''}</button></footer></form>`;
    d.querySelector('form').onsubmit = e => { e.preventDefault(); run(e.target.querySelector('[type=submit]')); };
  }
  const keep = fn => { const b = U.qs('#cfDialog .sum-list'), top = b?.scrollTop || 0; fn(); const b2 = U.qs('#cfDialog .sum-list'); if (b2) b2.scrollTop = top; };
  A.cfAll = () => { const q = U.norm(dlg.q); for (const p of roster()) if ((!dlg.group || D.groupOf(p) === dlg.group) && (!q || U.norm(U.full(p) + ' ' + U.sortName(p)).includes(q))) dlg.pids.add(p.id); keep(draw); };
  A.cfNone = () => { dlg.pids.clear(); keep(draw); };
  CP.changeHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#cfDialog')) return false;
    if (t.dataset.cfp) { if (t.checked) dlg.pids.add(t.dataset.cfp); else dlg.pids.delete(t.dataset.cfp); keep(draw); return true; }
    const k = t.dataset.cf; if (!k) return false;
    if (k === 'save') dlg.save = t.checked; else if (k === 'tid' || k === 'group') { dlg[k] = t.value; keep(draw); } else dlg[k] = t.value;
    return true;
  });
  CP.inputHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#cfDialog') || t.dataset.cf !== 'q') return false;
    dlg.q = t.value; const pos = t.selectionStart; keep(draw); const n = U.qs('#cfDialog [data-cf="q"]'); n?.focus(); n?.setSelectionRange(pos, pos); return true;
  });

  /* ---------- Aizpildīšana ---------- */
  const safe = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  async function buildList(t, buf, people) {
    const o = { date: dlg.date, place: dlg.place };
    return CP.docxFill.fill(buf, { global: globalMap(o, people.length), rows: people.map((p, i) => personMap(p, i, o)), rowKeys: PERSON_KEYS });
  }
  async function buildOne(t, buf, p, i, n) {
    const o = { date: dlg.date, place: dlg.place };
    return CP.docxFill.fill(buf, { global: { ...globalMap(o, n), ...personMap(p, i, o) }, rows: [], rowKeys: PERSON_KEYS });
  }
  const people = () => roster().filter(p => dlg.pids.has(p.id)).concat([...dlg.pids].map(D.person).filter(p => p && !roster().includes(p)));
  A.cfPreview = async () => {
    const t = cur(), ps = people(); if (!t || !ps.length) return;
    try {
      const buf = await analyse(t), blob = t.mode === 'list' ? await buildList(t, buf, ps) : await buildOne(t, buf, ps[0], 0, ps.length);
      const name = t.mode === 'list' ? `${t.name}.docx` : `${t.name} - ${U.full(ps[0])}.docx`;
      await CP.docs.openFile(new File([blob], name, { type: blob.type }), name);
    } catch (e) { console.error(e); ui.toast('Neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  async function run(btn) {
    const t = cur(), ps = people(); if (!t || !ps.length) return;
    const save = dlg.save && !!S.root, lbl = btn.innerHTML; btn.disabled = true;
    try {
      const buf = await analyse(t); CP.store.changed({ silent: true });
      if (t.mode === 'list') {
        const blob = await buildList(t, buf, ps), name = `${safe(t.name)}_${dlg.date}.docx`;
        U.download(blob, name);
        if (save) { const path = await CP.store.saveFile(['Macibu_gadi', D.activeYear(), 'Veidlapas'], name, blob); ui.toast('Kopija saglabāta: ' + path, 'ok', 7000); }
        U.$('cfDialog').close(); return;
      }
      const out = [];
      for (let i = 0; i < ps.length; i++) {
        btn.textContent = `Sagatavo ${i + 1}/${ps.length}…`;
        const p = ps[i], blob = await buildOne(t, buf, p, i, ps.length), name = `${safe(t.name)}_${safe(p.last)}_${safe(p.first)}.docx`;
        out.push([name, blob]);
        if (save) {
          await CP.store.ensurePersonYearFolder(p);
          const path = await CP.store.saveFile(CP.store.yearPersonDir(p), name, blob);
          if (path) CP.docs.link(p.id, 'Cits', 'pdf', path, 'main', { title: t.name, issued: dlg.date, review: 'received', size: blob.size });
        }
      }
      if (save) CP.store.changed();
      if (out.length === 1) { U.$('cfDialog').close(); await CP.docs.openFile(new File([out[0][1]], out[0][0], { type: out[0][1].type }), out[0][0]); if (save) ui.toast('Saglabāts personas mapē un piesaistīts kartītei', 'ok', 6000); return; }
      await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
      const zip = new window.JSZip(); out.forEach(([n, b]) => zip.file(n, b));
      U.download(await zip.generateAsync({ type: 'blob' }), `${safe(t.name)}_${dlg.date}.zip`);
      U.$('cfDialog').close();
      ui.toast(`Sagatavoti ${out.length} dokumenti (ZIP)${save ? '; katrs saglabāts personas mapē' : ''}.`, 'ok', 8000);
    } catch (e) { console.error(e); ui.toast('Neizdevās sagatavot: ' + e.message, 'err', 10000); }
    finally { btn.disabled = false; btn.innerHTML = lbl; }
  }

  CP.customForms = { added, tpls, PERSON_HELP, GLOBAL_HELP, analyse };
})(window.CP);
