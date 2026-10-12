/* =====================================================================
   Anketas ievade: dokuments (kreisajā pusē) + pārbaude (labajā pusē).
   Lauki netiek minēti pēc atslēgvārdiem. Teksts tiek ņemts tikai no
   lietotāja iezīmētajām zonām. Kartītē dati nonāk pēc apstiprinājuma.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const SC = { doc: null, file: null, res: null, lines: [], cur: 'first', found: {}, edited: new Set(), busy: false, saved: true, tpl: null, editing: false, draft: null, shift: {} };
  let viewer = null, form = null, fieldOrder = [];
  const scan = {};

  /* --- Statusa josla --- */
  scan.msg = (text, type = 'info', prog) => {
    const el = U.$('scanMsg'); if (!el) return;
    el.className = 'scan-msg ' + type; el.querySelector('.txt').textContent = text;
    const bar = el.querySelector('.bar'); bar.classList.toggle('hidden', type !== 'busy');
    if (prog != null) bar.querySelector('i').style.width = Math.round(prog * 100) + '%';
  };
  const msg = scan.msg;

  function build() {
    if (viewer) return;
    form = U.$('scanForm');
    U.$('scanFields').innerHTML = ui.fieldsHTML({ prefix: 'sf_', filter: f => !f.noScan });
    fieldOrder = CP.FIELDS.filter(f => !f.noScan).map(f => f.k);
    U.qsa('.field', form).forEach(b => { b.querySelector('.fx').innerHTML += `<button type="button" class="zbtn" data-act="scanZoom" data-arg="${b.dataset.f}" title="Parādīt dokumentā" tabindex="-1">⌖</button>`; });
    viewer = new CP.Viewer(U.$('scanViewer'), { onFile: loadFile, onRotate: rotate, onLineClick: lineClick, onDraw: drawZone, onZoneDelete: deleteZone, onZoneChange: moveZone, onZoneField: assignZone });
    U.$('scanTpl').addEventListener('change', e => { selectTpl(e.target.value); S.db.settings.activeTemplate = e.target.value; CP.store.changed({ silent: true }); if (SC.doc && !SC.busy) A.scanRun(); });
    form.addEventListener('focusin', e => { const n = e.target.name; if (n) { SC.cur = n; focusField(n); } });
    form.addEventListener('input', e => {
      const n = e.target.name; if (!n) return; SC.edited.add(n); SC.saved = false; delete form.dataset.warned;
      e.target.closest('.field').classList.remove('auto', 'check', 'warn', 'bad');
    });
    form.addEventListener('change', e => {
      if (e.target.name === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(e.target.value);
      if (e.target.name in D.PHONE_FIELDS) ui.phoneHints(form, U.$('scanTarget').value);
    });
    for (const id of ['scanFile', 'scanCam']) U.$(id).addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
    U.$('scanTarget').addEventListener('change', e => fillFromPerson(e.target.value));
    U.$('scanDialog').addEventListener('cancel', e => { e.preventDefault(); A.scanClose(); });
  }

  /* --- Atvēršana / aizvēršana --- */
  A.scan = (arg, el, e, opts = {}) => {
    build(); resetDoc(); ui.datalists();
    U.$('scanTarget').innerHTML = '<option value="">➕ Jauna persona</option>' + D.peopleInYear().filter(D.isCurrent).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(p => `<option value="${p.id}">Papildināt: ${esc(U.sortName(p))}</option>`).join('');
    const target = opts.target || (S.page === 'person' && D.person(S.selected) ? S.selected : '');
    U.$('scanTarget').value = target; fillFromPerson(target);
    tplOptions(); selectTpl(S.db.settings.activeTemplate);
    U.$('scanDialog').showModal();
    msg('Atver dokumentu. Bez veidnes lauki netiek aizpildīti. Ar veidni tiek nolasītas tikai iezīmētās zonas, un kartītē dati nonāk pēc apstiprinājuma.', 'info');
    if (opts.file) loadFile(opts.file);
  };
  scan.openWith = (file, target) => A.scan(null, null, null, { file, target });
  A.scanClose = () => {
    if (SC.busy) return msg('Notiek nolasīšana — uzgaidi', 'warn');
    if (SC.editing && !confirm('Veidne nav saglabāta. Aizvērt?')) return;
    if (SC.editing) endEdit();
    SC.pendingEdit = false;
    if (!SC.saved && hasValues() && !confirm('Ievadītie dati nav saglabāti. Aizvērt bez saglabāšanas?')) return;
    U.$('scanDialog').close(); CP.render();
  };
  const hasValues = () => fieldOrder.some(k => form.elements[k]?.value && form.elements[k].tagName !== 'SELECT');

  function resetDoc() {
    SC.doc = null; SC.file = null; SC.res = null; SC.lines = []; SC.found = {}; SC.edited.clear(); SC.saved = true; SC.pendingEdit = false;
    viewer.clear(); clearHints(); delete form.dataset.warned; buttons();
  }
  const clearHints = () => U.qsa('.field', form).forEach(b => { b.classList.remove('auto', 'check', 'warn', 'bad', 'has-zone'); b.querySelector('.hint').innerHTML = ''; b.querySelector('.duphint')?.remove(); });
  function fillFromPerson(pid) {
    ui.fillForm(form, pid ? D.formPerson(D.person(pid)) : null); SC.edited.clear();
    U.$('scanStatusWrap').classList.toggle('hidden', !!pid);
    if (SC.res?.values) applyZones(SC.res.values);
  }
  function buttons() {
    U.$('scanRunBtn').disabled = SC.busy || !SC.doc || SC.editing;
    U.$('scanTplBtn').disabled = SC.busy || SC.editing; U.$('scanTpl').disabled = SC.busy || SC.editing;
    U.$('scanTplBtn').textContent = SC.tpl ? '✎ Koriģēt zonas' : '✎ Jauna veidne';
    U.$('scanSource').textContent = !SC.doc ? '' : SC.doc.source === 'docx' ? 'Word dokuments' : SC.doc.source === 'text' ? 'PDF ar tekstu' : SC.doc.source === 'ocr' ? (CP.ocr.engine() === 'google' ? 'Atpazīts (Google)' : 'Atpazīts no attēla') : '';
    U.$('scanSource').className = 'tag ' + (SC.doc?.source === 'ocr' ? 'warn' : 'ok');
  }

  /* --- Faila ielāde --- */
  async function loadFile(file) {
    if (!file) return; if (SC.busy) return msg('Uzgaidi, kamēr beigsies nolasīšana', 'warn');
    SC.busy = true; buttons();
    try {
      msg('Atver ' + file.name + '…', 'busy', 0.05);
      const doc = await CP.reader.load(file, (t, p) => msg(t + '…', 'busy', p));
      SC.doc = doc; SC.file = file; SC.found = {}; SC.res = null; SC.lines = []; clearHints();
      if (doc.kind === 'docx') viewer.setHtml(doc.html); else viewer.setCanvases(doc.pages);
      if (SC.pendingEdit) {
        SC.pendingEdit = false; SC.busy = false;
        if (doc.kind === 'docx') msg('Word un eDoc paraugam zonas netiek zīmētas. Atver skenētu PDF vai attēlu.', 'info');
        else A.scanTplEdit();
        return;
      }
      SC.busy = false; await read();
    } catch (e) { msg('Neizdevās atvērt: ' + e.message, 'err'); }
    finally { SC.busy = false; buttons(); }
  }
  async function rotate() {
    const d = SC.doc; if (!d || d.kind === 'docx' || SC.busy) return;
    d.pages = d.pages.map(CP.ocr.rotate); d.words = []; d.source = 'none';
    viewer.setCanvases(d.pages); await read();
  }

  /* --- Nolasīšana tikai no veidnes zonām --- */
  const CAPTIONS = new Set(['vards', 'uzvards', 'vards un uzvards', 'vards uzvards', 'personas kods', 'dzimsanas datums', 'talrunis', 'telefons', 'e pasts', 'epasts', 'deklareta adrese', 'faktiska adrese', 'adrese', 'macibu iestade', 'klase', 'klase kurss', 'grupa', 'radnieciba', 'saistiba', 'aizpildiet', 'aizpildi', 'noradiet', 'ievadiet', 'obligati', 'paraugs', 'piemers', 'likumiskais parstavis', 'foto video publicesana']);
  const CAPTION_WORDS = new Set(['vards', 'uzvards', 'un', 'vai', 'kods', 'personas', 'dzimsanas', 'datums', 'talrunis', 'telefons', 'epasts', 'pasts', 'adrese', 'deklareta', 'faktiska', 'macibu', 'iestade', 'klase', 'kurss', 'grupa', 'radnieciba', 'saistiba', 'aizpildiet', 'aizpildi', 'noradiet', 'ievadiet', 'obligati', 'paraugs', 'piemers', 'ludzu', 'rakstiet']);
  function isInstruction(fieldKey, text) {
    const n = U.norm(text); if (!n) return true;
    const label = U.norm(CP.FIELD[fieldKey]?.l || '');
    if (label && n === label) return true;
    if (CAPTIONS.has(n)) return true;
    const words = n.split(' ').filter(Boolean);
    if (words.length && words.every(w => CAPTION_WORDS.has(w) || w.length <= 1)) return true;
    const kind = CP.FIELD[fieldKey]?.v;
    if ((kind === 'name' || kind === 'fullname') && words.length > 5) return true;
    return false;
  }
  function stripCaption(fieldKey, text) {
    let s = String(text || '').replace(/\s+/g, ' ').trim(); if (!s) return '';
    const labels = [...new Set([CP.FIELD[fieldKey]?.l, ...CP.FIELDS.filter(f => !f.noScan).map(f => f.l)].filter(Boolean))];
    let changed = true;
    while (changed) {
      changed = false;
      for (const l of labels) {
        const re = new RegExp('^' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:\\-–]?\\s*', 'i');
        if (re.test(s)) { s = s.replace(re, '').trim(); changed = true; }
      }
    }
    return isInstruction(fieldKey, s) ? '' : s;
  }
  function consentValue(raw) {
    const n = U.norm(raw);
    if (/nepiekrit/.test(n)) return 'no';
    if (/piekrit/.test(n) || n === 'ja') return 'yes';
    return '';
  }
  function activeZones() {
    return ((SC.editing ? SC.draft : SC.tpl)?.zones || []).filter(z => CP.FIELD[z.f] && !CP.FIELD[z.f].noScan);
  }
  async function showTextOnly(d) {
    if (d.kind !== 'docx' && d.source !== 'text' && d.pages?.length && d.source !== 'ocr' && CP.ocr.engine() !== 'google') {
      d.words = await CP.ocr.pageWords(d.pages, (t, p) => msg(t + '…', 'busy', p));
      d.source = 'ocr';
    }
    SC.lines = d.kind === 'docx' ? [] : CP.reader.lines(d.words || []);
    SC.res = { values: {} };
    redraw();
    msg('Dokuments ir atvērts. Personas lauki nav aizpildīti, jo veidne nav izvēlēta. Izvēlies veidni, izveido jaunu vai ievadi datus pats. Klikšķis uz teksta ieliek to izvēlētajā laukā.', 'info');
  }
  async function read() {
    const d = SC.doc; if (!d) return msg('Vispirms atver dokumentu', 'warn');
    if (SC.busy) return; SC.busy = true; buttons();
    try {
      if (SC.editing) { redraw(); msg('Iezīmē zonas un katrai izvēlies personas kartītes lauku.', 'info'); return; }
      const zones = activeZones();
      if (d.kind === 'docx' || d.source === 'docx') {
        SC.res = { values: {} }; SC.lines = []; redraw();
        msg('Word un eDoc teksts ir redzams. Lauki netiek aizpildīti automātiski, un zonas šiem failiem netiek lietotas. Ievadi datus pats.', 'info');
        return;
      }
      if (!zones.length) { await showTextOnly(d); return; }
      const values = {};
      let i = 0;
      for (const z of zones) {
        msg(`Nolasa zonu ${++i}/${zones.length}…`, 'busy', i / zones.length);
        values[z.f] = await readZone(z.f, z);
      }
      if (d.pages?.length && d.source !== 'text') d.source = 'ocr';
      SC.res = { values }; SC.lines = [];
      applyZones(values);
    } catch (e) { msg(e.message, 'err'); console.error(e); }
    finally { SC.busy = false; buttons(); }
  }
  A.scanRun = async () => { if (!SC.doc) return; clearHints(); SC.edited.clear(); ui.fillForm(form, D.person(U.$('scanTarget').value) || null); await read(); };

  function markZone(el, kind, html) {
    const box = el.closest('.field'), hint = box.querySelector('.hint');
    box.classList.add('has-zone'); box.classList.remove('auto', 'check');
    if (kind) box.classList.add(kind);
    hint.innerHTML = html || '';
  }
  /** Ieliek pārbaudes formā tikai zonas rezultātu, kas iztur lauka pārbaudi un nav anketas paskaidrojums. */
  function applyZones(values) {
    let filled = 0, missed = 0, check = 0;
    for (const [k, v] of Object.entries(values || {})) {
      const el = form.elements[k]; if (!el || !v) continue;
      const stripped = stripCaption(k, v.raw);
      if (k === 'photoConsent') {
        const val = stripped ? consentValue(stripped) : '';
        SC.found[k] = { ...v, ok: !!val, value: val, raw: stripped };
        if (!val) { missed++; markZone(el, 'check', '<div class="sugg"><span>Nav atpazīts</span></div>'); continue; }
        if (!SC.edited.has(k) && !el.value) { el.value = val; markZone(el, 'auto', ''); filled++; }
        else markZone(el, '', '');
        continue;
      }
      if (!stripped) {
        SC.found[k] = { ...v, ok: false, value: '', raw: '' };
        missed++; markZone(el, 'check', '<div class="sugg"><span>Nav atpazīts</span></div>'); continue;
      }
      const c = CP.ocr.clean(k, stripped);
      SC.found[k] = { ...v, ...c, raw: stripped };
      if (c.ok && c.value && !SC.edited.has(k) && !el.value) { el.value = c.value; markZone(el, 'auto', ''); filled++; }
      else if (el.value && c.ok && String(el.value) === String(c.value)) markZone(el, '', '');
      else if (c.ok && c.value && el.value) {
        check++;
        markZone(el, 'check', `<div class="sugg"><span>Dokumentā: <b>${esc(c.value)}</b></span><button type="button" class="sm" data-act="scanUse" data-arg="${esc(k)}">Lietot</button></div>`);
      } else {
        check++;
        markZone(el, 'check', `<div class="sugg"><span>Neskaidrs: <b>${esc(stripped)}</b> <small>${esc(c.msg || 'jāpārbauda')}</small></span></div>`);
      }
    }
    if (filled || check) SC.saved = false;
    redraw();
    const name = SC.tpl ? `Veidne “${SC.tpl.name}”. ` : '';
    msg(`${name}Pārbaudē no zonām: ${filled} lauki${check ? `, ${check} neskaidri un nav ievietoti` : ''}${missed ? `, ${missed} nav atpazīti` : ''}. Kartītē dati nonāk pēc apstiprinājuma.`, check || missed ? 'warn' : 'ok');
  }
  A.scanUse = k => {
    const f = SC.found[k], el = form.elements[k]; if (!f || !el) return;
    el.value = f.value; SC.edited.add(k); SC.saved = false; const box = el.closest('.field'); box.classList.remove('check'); box.classList.add('auto'); box.querySelector('.hint').innerHTML = '';
    if (k === 'personalCode' && !form.elements.birth.value) form.elements.birth.value = U.birthFromCode(f.value);
  };

  /* --- Lauks ↔ dokuments --- */
  function focusField(k) {
    const f = SC.found[k] || SC.res?.values?.[k]; if (!SC.doc) return;
    if (SC.doc.kind === 'docx') { viewer.markBlocks(f?.blks || []); return; }
    const src = SC.editing ? SC.draft : SC.tpl;
    const z = src?.zones?.find(z => z.f === k);
    SC.activeZone = z?.id || '';
    if (SC.editing) {
      redraw(); if (z) viewer.reveal(z);
      msg(`Zona laukam “${CP.FIELD[k]?.l}”.${z ? ' Velc, lai pārvietotu, stūris maina izmēru.' : ' Novelc taisnstūri vietā, kur rakstīta atbilde.'}`, 'info');
      return;
    }
    redraw(f?.box || z || null);
    const box = f?.box || z; if (box) viewer.reveal(box);
  }

  /* --- Veidnes: zonas proporcionāli lapai --- */
  const tpls = () => S.db.settings.formTemplates;
  function zoneFields() {
    const sec = Object.fromEntries(CP.SECTIONS);
    return CP.FIELDS.filter(f => !f.noScan).map(f => ({ k: f.k, l: (sec[f.s] ? sec[f.s] + ' — ' : '') + f.l }));
  }
  function tplOptions() {
    U.$('scanTpl').innerHTML = '<option value="">Bez veidnes — laukus neaizpildīt</option>' + tpls().map(t => `<option value="${t.id}">${esc(t.name)} · ${t.zones.length} zonas</option>`).join('');
  }
  function selectTpl(id) { SC.tpl = tpls().find(t => t.id === id) || null; U.$('scanTpl').value = SC.tpl?.id || ''; buttons(); if (SC.doc && !SC.editing) redraw(); }
  function zonesNow() {
    const t = SC.editing ? SC.draft : SC.tpl; if (!t) return [];
    return t.zones.map(z => ({ ...z, page: z.page || 0, label: CP.FIELD[z.f]?.l || 'Lauks…', on: z.f === SC.cur || (z.id && z.id === SC.activeZone) }));
  }
  function redraw(active = null) { if (SC.doc && SC.doc.kind !== 'docx') viewer.overlay({ lines: SC.editing ? [] : SC.lines, active, zones: zonesNow(), editing: SC.editing, fields: zoneFields() }); }
  let zoneJobs = 0;
  scan.zoneJobs = () => zoneJobs;
  /** Teksts tikai no šīs zonas. Tukša zona paliek tukša — visa dokumenta teksts netiek izmantots. */
  async function readZone(k, z) {
    zoneJobs++;
    try { return await readZoneNow(k, z); }
    finally { zoneJobs--; }
  }
  async function readZoneNow(k, z) {
    const d = SC.doc;
    const box = { page: z.page || 0, x: +z.x, y: +z.y, w: +z.w, h: +z.h };
    if (d.source === 'text') {
      const ws = (d.words || []).filter(w => w.p === box.page && (w.x0 + w.x1) / 2 >= box.x && (w.x0 + w.x1) / 2 <= box.x + box.w && (w.y0 + w.y1) / 2 >= box.y && (w.y0 + w.y1) / 2 <= box.y + box.h);
      return { raw: ws.map(w => w.t).join(' ').trim(), conf: ws.length ? Math.min(...ws.map(w => w.conf ?? 100)) : 0, box, zoned: true };
    }
    if (!d.pages?.length || CP.ocr.engine() === 'google') return { raw: '', conf: 0, box, zoned: true };
    if (CP.FIELD[k]?.v === 'personalCode') {
      const bd = await CP.ocr.boxedDigits(d.pages, box);
      if (bd?.text && CP.ocr.clean(k, bd.text).ok) return { raw: bd.text, conf: 92, box, zoned: true };
    }
    const r = await CP.ocr.region(d.pages, box, k) || { text: '', conf: 0 };
    return { raw: r.text || '', conf: r.conf || 0, box, zoned: true };
  }
  A.scanTplEdit = () => {
    if (!SC.doc) return msg('Vispirms atver dokumenta paraugu — skenētu PDF vai attēlu.', 'warn');
    if (SC.doc.kind === 'docx') return msg('Zonas ir skenētiem PDF un attēliem. Word teksts paliek redzams, bet lauki netiek aizpildīti automātiski.', 'info');
    SC.editing = true;
    SC.draft = SC.tpl ? JSON.parse(JSON.stringify(SC.tpl)) : { id: '', name: `Veidne ${tpls().length + 1}`, zones: [] };
    delete SC.draft.anchors;
    SC.draft.zones.forEach(z => { if (!z.id) z.id = U.uid(); });
    U.$('tplName').value = SC.draft.name; U.$('tplDelBtn').classList.toggle('hidden', !SC.draft.id); U.$('scanTplBar').classList.remove('hidden');
    viewer.setMode('draw'); buttons(); tplCount(); redraw();
    const first = fieldOrder.find(k => !SC.draft.zones.some(z => z.f === k)) || 'first';
    form.elements[first]?.focus();
  };
  async function drawZone(rect) {
    if (!SC.editing) return;
    const k = CP.FIELD[SC.cur] && !CP.FIELD[SC.cur].noScan ? SC.cur : '';
    if (k) SC.draft.zones = SC.draft.zones.filter(z => z.f !== k);
    const z = { id: U.uid(), f: k, page: rect.page || 0, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    SC.draft.zones.push(z);
    SC.activeZone = z.id; tplCount(); redraw();
    if (!k) { msg('Zona uzzīmēta. Izvēlies tai personas kartītes lauku.', 'info'); return; }
    const r = await readZone(k, z);
    applyZones({ [k]: r });
  }
  async function moveZone(id, rect) {
    if (!SC.editing || !SC.draft) return;
    const z = SC.draft.zones.find(z => z.id === id); if (!z) return;
    Object.assign(z, { page: rect.page || 0, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    redraw();
    if (!z.f) return;
    const r = await readZone(z.f, z);
    applyZones({ [z.f]: r });
  }
  async function assignZone(id, f) {
    if (!SC.editing || !SC.draft) return;
    const z = SC.draft.zones.find(z => z.id === id); if (!z) return;
    if (!CP.FIELD[f] || CP.FIELD[f].noScan) { z.f = ''; tplCount(); redraw(); return; }
    SC.draft.zones = SC.draft.zones.filter(o => o === z || o.f !== f);
    z.f = f; SC.cur = f; SC.activeZone = z.id;
    form.elements[f]?.focus(); tplCount(); redraw();
    const r = await readZone(f, z);
    applyZones({ [f]: r });
  }
  function deleteZone(id) { if (!SC.editing) return; SC.draft.zones = SC.draft.zones.filter(z => z.id !== id); tplCount(); redraw(); }
  const tplCount = () => { U.$('tplCount').textContent = SC.draft?.zones.length ? `Zonas: ${SC.draft.zones.length}. ${SC.draft.zones.map(z => CP.FIELD[z.f]?.l || 'bez lauka').join(', ')}` : 'Vēl neviena zona.'; };
  function endEdit() { SC.editing = false; SC.draft = null; SC.activeZone = ''; U.$('scanTplBar').classList.add('hidden'); viewer.setMode('view'); buttons(); redraw(); }
  function storedZone(z) {
    const x = +z.x, y = +z.y, w = +z.w, h = +z.h;
    if (![x, y, w, h].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || w < 0.004 || h < 0.004) return null;
    if (!CP.FIELD[z.f] || CP.FIELD[z.f].noScan) return null;
    return { id: String(z.id || U.uid()), f: z.f, page: Math.max(0, Number(z.page) || 0), x, y, w, h };
  }
  scan.normalizeTemplate = raw => {
    if (!raw || typeof raw !== 'object') return null;
    const zones = (Array.isArray(raw.zones) ? raw.zones : []).map(storedZone).filter(Boolean);
    const name = String(raw.name || '').trim().slice(0, 80);
    if (!name || !zones.length) return null;
    return { id: String(raw.id || U.uid()), name, createdAt: raw.createdAt || U.now(), zones };
  };
  A.scanTplSave = () => {
    const name = U.$('tplName').value.trim(); if (!name) return msg('Ievadi veidnes nosaukumu', 'warn');
    if (!SC.draft.zones.length) return msg('Iezīmē vismaz vienu zonu', 'warn');
    if (SC.draft.zones.some(z => !CP.FIELD[z.f])) return msg('Katrai zonai izvēlies personas kartītes lauku', 'warn');
    const clean = scan.normalizeTemplate({ ...SC.draft, name }); if (!clean) return msg('Zonu koordinātas nav derīgas', 'warn');
    const s = S.db.settings;
    if (SC.draft.id) { clean.id = SC.draft.id; s.formTemplates = s.formTemplates.map(x => x.id === clean.id ? clean : x); }
    else s.formTemplates.push(clean);
    s.activeTemplate = clean.id; CP.store.changed({ silent: true });
    endEdit(); tplOptions(); selectTpl(clean.id);
    msg(`Veidne “${name}” saglabāta (${clean.zones.length} zonas) datu failā.`, 'ok');
    if (SC.doc) A.scanRun();
  };
  A.scanTplCancel = () => { endEdit(); msg('Zonu rediģēšana atcelta. Saglabātā veidne nav mainīta.', 'info'); };
  A.scanTplDelete = () => {
    const t = SC.draft; if (!t?.id || !confirm(`Dzēst veidni “${t.name}”?`)) return;
    const s = S.db.settings; s.formTemplates = s.formTemplates.filter(x => x.id !== t.id); if (s.activeTemplate === t.id) s.activeTemplate = '';
    CP.store.changed({ silent: true }); endEdit(); tplOptions(); selectTpl(''); msg('Veidne dzēsta', 'ok');
  };
  scan.openEditor = id => {
    A.scan();
    SC.pendingEdit = true;
    if (id) selectTpl(id);
    msg('Augšupielādē dokumenta paraugu — skenētu PDF vai attēlu. Pēc tam ar peli iezīmē zonas.', 'info');
  };
  A.scanZoom = k => { form.elements[k]?.focus(); if (!(SC.found[k] || SC.res?.values[k])) msg(`Laukam “${CP.FIELD[k]?.l}” vieta dokumentā netika atrasta.`, 'info'); };
  function lineClick(i, e) {
    const l = SC.lines[i], el = form.elements[SC.cur]; if (!l || !el || el.tagName === 'SELECT') return;
    let v = l.words.filter(w => !w.isLabel).map(w => w.t).join(' ') || l.text;
    const c = CP.ocr.clean(SC.cur, v), val = c.ok && c.value ? c.value : v;
    el.value = e.shiftKey && el.value ? el.value + ' ' + v : val;
    SC.edited.add(SC.cur); SC.saved = false; const box = el.closest('.field'); box.classList.remove('check'); box.classList.add('auto');
    msg(c.ok || e.shiftKey ? `Ielikts laukā “${CP.FIELD[SC.cur]?.l}”.` : `Ielikts laukā “${CP.FIELD[SC.cur]?.l}”, bet pārbaudi: ${c.msg}`, c.ok || e.shiftKey ? 'ok' : 'warn');
    el.focus();
  }

  /* --- Saglabāšana --- */
  A.scanSave = async arg => {
    if (SC.busy) return msg('Uzgaidi, kamēr beigsies nolasīšana', 'warn');
    const o = ui.readForm(form); delete o.status; delete o.retentionMonths;
    if (!o.birth && o.personalCode) o.birth = U.birthFromCode(o.personalCode);
    const chk = ui.checkForm(form, o);
    if (chk.errors) { msg('Aizpildi obligātos laukus (vārds un uzvārds)', 'err'); U.qs('.field.bad input', form)?.focus(); return; }
    const dupN = ui.phoneHints(form, U.$('scanTarget').value);
    if ((chk.warnings || dupN) && !form.dataset.warned) { form.dataset.warned = '1'; msg(dupN ? 'Tālruņa numurs sakrīt ar citas personas numuru (skat. pie lauka). Pārbaudi vai spied apstiprinājumu vēlreiz.' : 'Dažas vērtības izskatās aizdomīgas (iezīmētas). Labo tās vai spied apstiprinājumu vēlreiz, lai saglabātu tāpat.', 'warn'); (U.qs('.field.warn input', form) || U.qs('.duphint.bad', form)?.closest('.field').querySelector('input'))?.focus(); return; }
    const target = U.$('scanTarget').value; let p;
    if (target) p = CP.people.savePerson(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null)), target, 'scan');
    else {
      const dup = D.duplicates(o);
      if (dup.length && !confirm(`Iespējams dublikāts: ${dup.map(U.full).join(', ')}.\nVienalga izveidot jaunu personu?\n\n(Lai papildinātu esošo, izvēlies to laukā “Kur ievadīt”.)`)) return;
      p = CP.people.savePerson({ ...o, status: U.$('scanStatus').value, joined: o.joined || U.iso(), retentionMonths: S.db.settings.retentionDefault }, null, 'scan');
    }
    let note = '';
    if (SC.file && !SC.file._linked) {
      if (S.root) {
        try {
          const ext = (SC.file.name.split('.').pop() || 'pdf').toLowerCase(), d = SC.doc;
          const format = d.container === 'edoc' || ext === 'edoc' ? 'edoc' : (d.source === 'docx' || d.source === 'text') ? 'pdf' : 'paper';
          await CP.store.ensurePersonYearFolder(p);
          const path = await CP.store.saveFile(CP.store.yearPersonDir(p), `Pieteikuma anketa ${U.iso()}.${ext}`, SC.file);
          CP.docs.link(p.id, S.db.settings.docKinds.includes('Pieteikuma anketa') ? 'Pieteikuma anketa' : D.guessKind('anketa'), format, path, 'main');
          note = ' Anketa pievienota kartiņas dokumentiem.';
        } catch (e) { note = ' Anketas failu neizdevās saglabāt: ' + e.message; }
      } else note = ' Anketas fails nav saglabāts — nav izvēlēta datu mape.';
    }
    SC.saved = true; CP.store.changed({ silent: true });
    if (arg === 'next') {
      resetDoc(); U.$('scanTarget').value = ''; fillFromPerson('');
      U.$('scanTarget').insertAdjacentHTML('beforeend', `<option value="${p.id}">Papildināt: ${esc(U.sortName(p))}</option>`);
      msg(`✓ Saglabāts: ${U.full(p)}.${note} Atver nākamo anketu.`, 'ok');
    } else {
      U.$('scanDialog').close(); S.page = 'person'; S.selected = p.id; S.tab = 'overview'; CP.render();
      ui.toast(`Saglabāts: ${U.full(p)}.${note}`, /neizdevās|nav saglabāts/.test(note) ? 'warn' : 'ok', 9000, D.contacts(p).some(c => U.normPhone(c.phone)) ? { label: '📇 Saglabāt kontaktos', act: 'vcard', arg: p.id } : null);
    }
  };

  scan.state = SC;   // diagnostikai (konsolē: CP.scan.state)
  CP.scan = scan;
})(window.CP);
