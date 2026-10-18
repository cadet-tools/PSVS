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
        ${CP.unit?.has() ? `<label class="check"><input type="checkbox" data-cf="brand" ${t?.brand ? 'checked' : ''}> Ar vienības logo un nosaukumu${CP.unit.get().name ? ` (“${esc(CP.unit.get().name)}”)` : ''} dokumenta augšā — kopā ar CADET.LV logo <span class="muted small">(oficiāliem dokumentiem neatzīmē)</span></label>` : '<p class="small muted" style="margin:4px 0">Vienības logo un nosaukumu var pievienot Iestatījumi → Pamata → Vienība — tad šeit varēs izvēlēties to ielikt dokumentā.</p>'}
        ${t?.mode === 'each' ? `<label class="check"><input type="checkbox" data-cf="save" ${dlg.save && S.root ? 'checked' : ''} ${S.root ? '' : 'disabled'}> Piesaistīt katras personas kartītei (fails — personas dokumentu mapē)</label>` : ''}
        <p class="small muted" style="margin:4px 0">Sagatavotais dokuments parādīsies sarakstā Veidlapas → “Sagatavotās veidlapas” — tur to var atvērt un lejupielādēt.</p>
        <p class="small muted">Vispirms vari <b>apskatīt</b>, kā izskatās aizpildītais dokuments${t?.mode === 'each' ? ' (pirmajai personai)' : ''}. Atzīmes var rakstīt arī ar garumzīmēm: {Vārds} = {vards}.</p>
      </div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="cfDialog">Atcelt</button><button type="button" data-act="cfPreview" ${n ? '' : 'disabled'}>${ic('eye', '👁')} Apskatīt</button><button class="mainbtn" type="submit" ${n ? '' : 'disabled'}>${ic('file', '📄')} Sagatavot${t?.mode === 'each' && n > 1 ? ` (${n})` : ''}</button></footer></form>`;
    d.querySelector('form').onsubmit = e => { e.preventDefault(); run(e.target.querySelector('[type=submit]')); };
  }
  const keep = fn => { const b = U.qs('#cfDialog .sum-list'), top = b?.scrollTop || 0; fn(); const b2 = U.qs('#cfDialog .sum-list'); if (b2) b2.scrollTop = top; };
  A.cfAll = () => { const q = U.norm(dlg.q); for (const p of roster()) if ((!dlg.group || D.groupOf(p) === dlg.group) && (!q || U.norm(U.full(p) + ' ' + U.sortName(p)).includes(q))) dlg.pids.add(p.id); keep(draw); };
  A.cfNone = () => { dlg.pids.clear(); keep(draw); };
  CP.changeHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#cfDialog')) return false;
    if (t.dataset.cfp) { if (t.checked) dlg.pids.add(t.dataset.cfp); else dlg.pids.delete(t.dataset.cfp); keep(draw); return true; }
    const k = t.dataset.cf; if (!k) return false;
    if (k === 'brand') { const tp = cur(); if (tp) { tp.brand = t.checked; CP.store.changed({ silent: true }); } return true; }
    if (k === 'save') dlg.save = t.checked; else if (k === 'tid' || k === 'group') { dlg[k] = t.value; keep(draw); } else dlg[k] = t.value;
    return true;
  });
  CP.inputHandlers.push(e => {
    const t = e.target; if (!t.closest?.('#cfDialog') || t.dataset.cf !== 'q') return false;
    dlg.q = t.value; const pos = t.selectionStart; keep(draw); const n = U.qs('#cfDialog [data-cf="q"]'); n?.focus(); n?.setSelectionRange(pos, pos); return true;
  });

  /* ---------- Vienības logo un nosaukums (pēc izvēles) + CADET.LV logo ar “CADET PERSONĀLS” ---------- */
  const pngSize = u => { const v = new DataView(u.buffer, u.byteOffset); return v.getUint32(0) === 0x89504e47 ? [v.getUint32(16), v.getUint32(20)] : [400, 400]; };
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const drawing = (rid, cx, cy, id, name) => `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${name}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
  let CADET = null;
  /** Dokumenta sākumā ieliek tabulu bez rāmjiem: pa kreisi vienības logo + nosaukums, pa labi CADET.LV logo un “CADET PERSONĀLS” */
  async function brand(buf) {
    const u = CP.unit?.get() || {}; if (!u.name && !u.logo) return buf;
    if (!CADET) { try { CADET = new Uint8Array(await (await fetch(CP.VENDOR + 'brand/CADET_pdf.png')).arrayBuffer()); } catch (e) { CADET = null; } }
    const files = await U.unzip(buf), m = new Map(), dec = new TextDecoder(), enc = new TextEncoder();
    for (const [n, get] of files) m.set(n, await get());
    const EMU = 360000, uLogo = u.logo ? CP.unit.logoBytes() : null;
    let left = '', right = '';
    if (uLogo) { const [w, h] = pngSize(uLogo), cy = Math.round(1.6 * EMU), cx = Math.min(Math.round(3.2 * EMU), Math.round(cy * w / h)), cy2 = Math.round(cx * h / w); left += `<w:r>${drawing('rIdCpUnit', cx, cy2, 9101, 'Vienibas_logo')}</w:r>`; m.set('word/media/cp_unit.png', uLogo); }
    if (u.name) left += `<w:r><w:t xml:space="preserve">${uLogo ? '   ' : ''}</w:t></w:r><w:r><w:rPr><w:b/>${uLogo ? '<w:position w:val="36"/>' : ''}<w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${xesc(u.name)}</w:t></w:r>`;   // nosaukums pret logo vidu
    if (CADET) { const [w, h] = pngSize(CADET), cx = Math.round(3.4 * EMU), cy = Math.round(cx * h / w); right = `<w:r>${drawing('rIdCpCadet', cx, cy, 9102, 'CADET_LV')}</w:r>`; m.set('word/media/cp_cadet.png', CADET); }
    const none = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="nil"/>`).join('');
    const tbl = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${none}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="6400"/><w:gridCol w:w="2800"/></w:tblGrid>`
      + `<w:tr><w:tc><w:tcPr><w:tcW w:w="3450" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>${left}</w:p></w:tc>`
      + `<w:tc><w:tcPr><w:tcW w:w="1550" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr>${right}</w:p><w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="5F7180"/><w:sz w:val="14"/></w:rPr><w:t>CADET PERSONĀLS</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>`;
    let doc = dec.decode(m.get('word/document.xml'));
    doc = doc.replace(/<w:body>/, '<w:body>' + tbl);
    m.set('word/document.xml', enc.encode(doc));
    const relsN = 'word/_rels/document.xml.rels'; let rels = m.has(relsN) ? dec.decode(m.get(relsN)) : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const IMG = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
    if (uLogo) rels = rels.replace('</Relationships>', `<Relationship Id="rIdCpUnit" Type="${IMG}" Target="media/cp_unit.png"/></Relationships>`);
    if (CADET) rels = rels.replace('</Relationships>', `<Relationship Id="rIdCpCadet" Type="${IMG}" Target="media/cp_cadet.png"/></Relationships>`);
    m.set(relsN, enc.encode(rels));
    let ct = dec.decode(m.get('[Content_Types].xml'));
    if (!/Extension="png"/i.test(ct)) ct = ct.replace(/<Types([^>]*)>/, '<Types$1><Default Extension="png" ContentType="image/png"/>');
    m.set('[Content_Types].xml', enc.encode(ct));
    return (await CP.docxFill.zip([...m])).arrayBuffer();
  }
  const prep = async (t, buf) => (t.brand && CP.unit?.has() ? brand(buf) : buf);

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
      const buf = await prep(t, await analyse(t)), blob = t.mode === 'list' ? await buildList(t, buf, ps) : await buildOne(t, buf, ps[0], 0, ps.length);
      const name = t.mode === 'list' ? `${t.name}.docx` : `${t.name} - ${U.full(ps[0])}.docx`;
      await CP.docs.openFile(new File([blob], name, { type: blob.type }), name);
    } catch (e) { console.error(e); ui.toast('Neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  /* Sagatavotie dokumenti — S.db.formDocs: { id, tid, name, mode, date, at, files: [{ pid, name, path }] }.
     Faili VIENMĒR tiek saglabāti datu mapē: saraksts un nepiesaistītie — Macibu_gadi/<gads>/Veidlapas/<nosaukums datums>/,
     piesaistītie — personas mapē (un kartītē kā dokuments). Sarakstā Veidlapas → “Sagatavotās veidlapas”. */
  const fdocs = () => (S.db.formDocs = S.db.formDocs || []);
  async function run(btn) {
    const t = cur(), ps = people(); if (!t || !ps.length) return;
    if (!S.root) return ui.toast('Vispirms pieslēdz datu mapi', 'warn');
    const link = t.mode === 'each' && dlg.save, lbl = btn.innerHTML; btn.disabled = true;
    try {
      const buf = await prep(t, await analyse(t)); CP.store.changed({ silent: true });
      const dir = ['Macibu_gadi', D.activeYear(), 'Veidlapas', `${t.name} ${dlg.date}`.replace(/\s+/g, ' ').slice(0, 80)];
      const rec = { id: U.uid(), tid: t.id, name: t.name, mode: t.mode, date: dlg.date, at: U.now(), yearId: D.activeYear(), files: [] };
      if (t.mode === 'list') {
        const blob = await buildList(t, buf, ps), name = `${safe(t.name)}_${dlg.date}.docx`;
        rec.files.push({ pid: '', pids: ps.map(p => p.id), name, path: await CP.store.saveFile(dir, name, blob) });
      } else {
        for (let i = 0; i < ps.length; i++) {
          btn.textContent = `Sagatavo ${i + 1}/${ps.length}…`;
          const p = ps[i], blob = await buildOne(t, buf, p, i, ps.length), name = `${safe(t.name)}_${safe(p.last)}_${safe(p.first)}.docx`;
          let path;
          if (link) {
            await CP.store.ensurePersonYearFolder(p);
            path = await CP.store.saveFile(CP.store.yearPersonDir(p), name, blob);
            if (path) CP.docs.link(p.id, 'Cits', 'pdf', path, 'main', { title: t.name, issued: dlg.date, review: 'received', size: blob.size });
          } else path = await CP.store.saveFile(dir, name, blob);
          rec.files.push({ pid: p.id, name, path });
        }
      }
      fdocs().push(rec); CP.store.changed();
      U.$('cfDialog').close();
      if (S.page === 'forms') CP.render();
      await openFileOf(rec, 0);
      ui.toast(`${rec.files.length > 1 ? `Sagatavoti ${rec.files.length} dokumenti` : 'Dokuments sagatavots'} — atrodami Veidlapas → “Sagatavotās veidlapas”${link ? ' un personu kartītēs' : ''}. Lejupielādēt var skatītājā vai sarakstā.`, 'ok', 9000);
    } catch (e) { console.error(e); ui.toast('Neizdevās sagatavot: ' + e.message, 'err', 10000); }
    finally { btn.disabled = false; btn.innerHTML = lbl; }
  }
  async function fileOf(f) { const h = await CP.store.handleFor(f.path, 'main'); if (!h) throw Error(`fails “${f.name}” datu mapē nav atrasts`); return h.getFile(); }
  async function openFileOf(rec, i) { const f = rec.files[i]; if (!f) return; const file = await fileOf(f); await CP.docs.openFile(new File([file], f.name, { type: file.type }), `${rec.name}${f.pid && D.person(f.pid) ? ' — ' + U.full(D.person(f.pid)) : ''}`); }
  const recOf = id => fdocs().find(r => r.id === id);
  A.cfOpen = async arg => {
    const [id, i] = String(arg).split('|'), r = recOf(id); if (!r) return;
    try {
      if (i != null && i !== '') return await openFileOf(r, +i);
      if (r.files.length === 1) return await openFileOf(r, 0);
      let d = U.$('cfFilesDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'cfFilesDialog'; document.body.appendChild(d); }
      d.innerHTML = `<header class="dlg-head"><h2>${esc(r.name)} · ${esc(U.fmtDate(r.date))}</h2><button type="button" class="ghost" data-close="cfFilesDialog" aria-label="Aizvērt">✕</button></header>
        <div class="dlg-body">${r.files.map((f, k) => `<div class="row"><span class="grow">${esc(f.pid && D.person(f.pid) ? U.sortName(D.person(f.pid)) : f.name)}</span><button class="sm" data-act="cfOpen" data-arg="${r.id}|${k}">${ic('eye', '👁')} Skatīt</button><button class="sm ghost" data-act="cfDlOne" data-arg="${r.id}|${k}">${ic('download', '⬇')}</button></div>`).join('')}</div>
        <footer class="dlg-foot"><span class="grow"></span><button type="button" data-act="cfDownload" data-arg="${r.id}">${ic('download', '⬇')} Lejupielādēt visus (ZIP)</button></footer>`;
      if (!d.open) d.showModal();
    } catch (e) { ui.toast(e.message, 'warn', 8000); }
  };
  A.cfDlOne = async arg => { const [id, i] = String(arg).split('|'), r = recOf(id), f = r?.files[+i]; if (!f) return; try { U.download(await fileOf(f), f.name); } catch (e) { ui.toast(e.message, 'warn', 8000); } };
  A.cfDownload = async id => {
    const r = recOf(id); if (!r) return;
    try {
      if (r.files.length === 1) return U.download(await fileOf(r.files[0]), r.files[0].name);
      await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
      const zip = new window.JSZip(), miss = [];
      for (const f of r.files) { try { zip.file(f.name, await fileOf(f)); } catch (e) { miss.push(f.name); } }
      U.download(await zip.generateAsync({ type: 'blob' }), `${safe(r.name)}_${r.date}.zip`);
      if (miss.length) ui.toast('Nav atrasti: ' + miss.join(', '), 'warn', 9000);
    } catch (e) { ui.toast(e.message, 'warn', 8000); }
  };
  A.cfDel = id => {
    const r = recOf(id); if (!r || !confirm(`Noņemt “${r.name}” (${U.fmtDate(r.date)}) no saraksta? Faili datu mapē paliek.`)) return;
    S.db.formDocs = fdocs().filter(x => x.id !== id); CP.store.changed();
  };
  /** Ieraksti Veidlapu sarakstam (forms.js allItems) */
  const listItems = () => fdocs().map(r => { const ps = [...new Set(r.files.flatMap(f => f.pid ? [f.pid] : (f.pids || [])))].map(D.person).filter(Boolean);
    return { kind: 'custom', id: r.id, date: r.date, title: r.name, rec: r, ps, hay: U.norm([r.name, ...ps.map(U.full)].join(' ')) }; });

  CP.customForms = { added, tpls, PERSON_HELP, GLOBAL_HELP, analyse, listItems };
})(window.CP);
