/* =====================================================================
   Veidnes atzīmju redaktors rīkā (Word .docx).
   • Rāda dokumenta tekstu (rindkopas un tabulas) — katru rindkopu var labot; pa labi — atzīmju saraksts,
     klikšķis ieliek {atzīmi} kursora vietā (vai aizstāj iezīmēto tekstu, piem., “Jānis Paraugs” → {vards_uzvards}).
   • Formatējums saglabājas: maina tikai mainīto teksta daļu tajā “gabalā” (run), kur tā atrodas.
   • “＋ Rindkopa” pievieno tukšu rindkopu zem izvēlētās (ar tās pašas rindkopas noformējumu); “＋ Tabulas rinda” — tukšu rindu.
   • Saglabā kā JAUNU failu mapē Veidnes (“… (labots DD.MM.GGGG).docx”); vecais paliek, veidne norāda uz jauno.
   • Galvenes un kājenes teksts netiek rādīts (to var labot Word programmā).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', XS = 'http://www.w3.org/XML/1998/namespace';
  const tEls = el => [...el.getElementsByTagNameNS(W, 't')];
  const ptext = p => tEls(p).map(t => t.textContent).join('');
  let ed = null;   // { t, files, doc, paras: [w:p], orig: [string], dirty, last: {i, range} }

  const tagsFor = type => {
    const src = type === 'custom' ? [...(CP.customForms?.PERSON_HELP || []), ...(CP.customForms?.GLOBAL_HELP || [])]
      : type === 'contract' ? (CP.CONTRACT_FIELDS_HELP || []) : (CP.docxFill?.FIELDS_HELP || []);
    return src.map(([a, b]) => ({ label: /^\{/.test(b) ? a : b, tags: (`${a} ${/^\{/.test(b) ? b : ''}`.match(/\{[a-z0-9_]+\}/g) || []) })).filter(g => g.tags.length);
  };

  A.tplEdit = async id => {
    const t = (S.db.settings.docTemplates || []).find(x => x.id === id); if (!t) return;
    try {
      const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
      const files = await U.unzip(await (await h.getFile()).arrayBuffer()), out = new Map();
      for (const [n, get] of files) out.set(n, await get());
      if (!out.has('word/document.xml')) throw Error('fails nav Word .docx dokuments');
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(out.get('word/document.xml')), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw Error('Word dokumenta XML nav nolasāms');
      ed = { t, files: out, doc, paras: [], orig: [], dirty: false, last: null };
      draw();
    } catch (e) { ui.toast('Veidni neizdevās atvērt: ' + e.message, 'err', 9000); }
  };

  /* --- Pareizrakstība: rīka iebūvētā latviešu vārdnīca (Hunspell, vendor/spell — darbojas datorā, arī bezsaistē; teksts netiek sūtīts).
         Kļūdas iezīmē ar CSS Custom Highlight (dokumenta teksts netiek mainīts); labā peles poga — ieteikumi. Atzīmes {…}, skaitļi un e-pasti netiek pārbaudīti. --- */
  const spellOn = () => { try { return localStorage.getItem('cp.teSpell') !== '0'; } catch (e) { return true; } };
  const myDict = () => { try { return new Set(JSON.parse(localStorage.getItem('cp.spellDict') || '[]')); } catch (e) { return new Set(); } };
  const addMyDict = w => { const d = myDict(); d.add(w); try { localStorage.setItem('cp.spellDict', JSON.stringify([...d].slice(-2000))); } catch (e) { } };
  let SW = null, swSeq = 0; const swWait = new Map(), ignored = new Set(), cache = new Map();   // vārds → true (pareizs) / false
  function sw(op, data = {}) {
    if (!SW) { SW = new Worker(CP.VENDOR + 'spell/worker.js'); SW.onmessage = e => { const w = swWait.get(e.data.id); if (w) { swWait.delete(e.data.id); e.data.ok ? w.res(e.data) : w.rej(Error(e.data.error)); } }; SW.onerror = e => { for (const w of swWait.values()) w.rej(Error('pārbaudi neizdevās ielādēt')); swWait.clear(); SW = null; }; }
    const id = ++swSeq; return new Promise((res, rej) => { swWait.set(id, { res, rej }); SW.postMessage({ id, op, ...data }); });
  }
  const WORD = /[\p{L}][\p{L}\p{M}'’-]*[\p{L}]|[\p{L}]/gu;
  /** Vārdi rindkopā ar pozīcijām; izlaiž {atzīmes}, e-pastus, adreses */
  function wordsOf(text) {
    const skip = []; for (const m of text.matchAll(/\{[^{}]*\}|\S+@\S+|https?:\/\/\S+|www\.\S+/g)) skip.push([m.index, m.index + m[0].length]);
    const out = [];
    for (const m of text.matchAll(WORD)) {
      const a = m.index, b = a + m[0].length; if (skip.some(([x, y]) => a < y && b > x)) continue;
      let w = m[0].replace(/^['’-]+|['’-]+$/g, ''); if (w.length < 2) continue;
      if (w.length <= 4 && (text[b] === '.' || w === w.toLocaleUpperCase('lv'))) continue;   // saīsinājumi (Nr., piem., u.c.) un īsi lielo burtu vārdi (JC, VFS)
      out.push({ w, a: a + m[0].indexOf(w) });
    }
    return out;
  }
  let spellGen = 0, spellBad = [];
  /** Pārbauda visu dokumentu (vai vienu rindkopu) — ar īstu progresu */
  async function spellRun(only) {
    const gen = ++spellGen, box = U.$('teProg'), host = U.$('teDoc'); if (!host) return;
    if (!spellOn()) { CSS.highlights?.delete('cp-spell'); if (box) box.hidden = true; return; }
    const els = only ? [only] : U.qsa('#teDoc .te-p'), bar = box?.querySelector('i'), lbl = box?.querySelector('span');
    const show = (pct, t) => { if (!box || only) return; box.hidden = false; bar.style.width = pct + '%'; lbl.textContent = t; };
    try {
      if (!SW || !cache.size) { show(5, 'Ielādē latviešu vārdnīcu…'); await sw('init'); if (gen !== spellGen) return; }
      const items = els.map(el => ({ el, ws: wordsOf(el.textContent) })), uniq = [...new Set(items.flatMap(x => x.ws.map(o => o.w)))].filter(w => !cache.has(w));
      const mine = myDict();
      for (let k = 0; k < uniq.length; k += 150) {
        const part = uniq.slice(k, k + 150), r = await sw('check', { words: part }); if (gen !== spellGen) return;
        const bad = new Set(r.bad); part.forEach(w => cache.set(w, !bad.has(w)));
        show(10 + Math.round(85 * Math.min(1, (k + part.length) / uniq.length)), `Pārbauda pareizrakstību… ${Math.min(uniq.length, k + part.length)} no ${uniq.length} vārdiem`);
      }
      // iezīmes
      if (only) spellBad = spellBad.filter(x => x.el !== only && x.el.isConnected); else spellBad = [];
      for (const { el, ws } of items) for (const o of ws) if (cache.get(o.w) === false && !ignored.has(o.w) && !mine.has(o.w)) spellBad.push({ el, w: o.w, a: o.a });
      paintSpell();
      const n = spellBad.length;
      if (!only) { show(100, n ? `✓ Pārbaudīts — ${n} ${n === 1 ? 'iespējama kļūda' : 'iespējamas kļūdas'} pasvītrotas sarkanā krāsā (labā peles poga — ieteikumi)` : '✓ Pārbaudīts — kļūdu nav'); setTimeout(() => { if (gen === spellGen && box?.isConnected && !n) box.hidden = true; }, 4000); }
      else if (box && !box.hidden) lbl.textContent = n ? `${n} ${n === 1 ? 'iespējama kļūda' : 'iespējamas kļūdas'} — labā peles poga uz vārda — ieteikumi` : '✓ Kļūdu nav';
    } catch (e) { show(100, 'Pareizrakstības pārbaudi neizdevās ielādēt: ' + e.message); }
  }
  function rangeOf(el, a, len) {
    let pos = 0; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, r = null;
    while ((n = tw.nextNode())) { const L = n.textContent.length; if (!r && a < pos + L) { r = document.createRange(); r.setStart(n, a - pos); } if (r && a + len <= pos + L) { r.setEnd(n, a + len - pos); return r; } pos += L; }
    return null;
  }
  function paintSpell() {
    if (!window.CSS?.highlights || typeof Highlight === 'undefined') return;
    const rs = []; for (const x of spellBad) { if (!x.el.isConnected) continue; const r = rangeOf(x.el, x.a, x.w.length); if (r) { x.r = r; rs.push(r); } }
    CSS.highlights.set('cp-spell', new Highlight(...rs));
  }
  const spellAgain = U.debounce(el => { if (el?.isConnected) spellRun(el); }, 700);
  document.addEventListener('input', e => { const el = e.target.closest?.('#teDoc') && pOf(getSelection().anchorNode); if (el && spellOn()) { spellBad = spellBad.filter(x => x.el !== el); paintSpell(); spellAgain(el); } }, true);
  /* Labā peles poga uz pasvītrota vārda — ieteikumi */
  document.addEventListener('contextmenu', async e => {
    if (!e.target.closest?.('#teDoc') || !spellOn()) return;
    const cp = document.caretRangeFromPoint?.(e.clientX, e.clientY); if (!cp) return;
    const hit = spellBad.find(x => x.r && x.el.contains(cp.startContainer) && x.r.comparePoint(cp.startContainer, cp.startOffset) === 0);
    if (!hit) return;
    e.preventDefault();
    let m = U.$('teSpellMenu'); if (!m) { m = document.createElement('div'); m.id = 'teSpellMenu'; m.className = 'te-spell-menu'; U.$('tplEditDialog').appendChild(m); }
    m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px'; m.hidden = false;
    m.innerHTML = `<div class="small muted pad">Meklē ieteikumus…</div>`;
    const list = await sw('suggest', { word: hit.w }).then(r => r.list).catch(() => []);
    m.innerHTML = (list.length ? list.map(s => `<button type="button" data-spfix="${esc(s)}"><b>${esc(s)}</b></button>`).join('') : '<div class="small muted pad">Nav ieteikumu</div>')
      + `<hr><button type="button" data-spign="1">Ignorēt “${esc(hit.w)}”</button><button type="button" data-spadd="1">Pievienot manai vārdnīcai</button>`;
    m.onclick = ev => {
      const b = ev.target.closest('button'); if (!b) return; m.hidden = true;
      if (b.dataset.spfix != null) { const host = U.$('teDoc'); host.focus({ preventScroll: true }); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(hit.r); document.execCommand('insertText', false, b.dataset.spfix); mark(); return; }
      if (b.dataset.spign) ignored.add(hit.w); else addMyDict(hit.w);
      spellBad = spellBad.filter(x => x.w !== hit.w); paintSpell();
    };
  });
  document.addEventListener('mousedown', e => { const m = U.$('teSpellMenu'); if (m && !m.hidden && !m.contains(e.target)) m.hidden = true; }, true);
  function poke() { spellRun(); }
  CP.changeHandlers.push(e => {
    if (e.target.dataset?.te !== 'spell') return false;
    try { localStorage.setItem('cp.teSpell', e.target.checked ? '1' : '0'); } catch (x) { }
    spellRun();
    return true;
  });

  /* --- Rindkopas izskats redaktorā (tikai attēlošanai — dokumentā nekas netiek mainīts): līdzinājums, treknraksts, slīpraksts, izmērs, saraksts --- */
  const val = (el, tag) => { const x = el?.getElementsByTagNameNS(W, tag)[0]; if (!x) return null; const v = x.getAttributeNS(W, 'val'); return v == null ? true : v; };
  const on = v => v === true || (v != null && !/^(0|false|off|none)$/i.test(v));
  function look(p) {
    const pPr = [...p.childNodes].find(n => n.localName === 'pPr'), css = [];
    const jc = val(pPr, 'jc'); if (jc) css.push(`text-align:${{ center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }[jc] || 'left'}`);
    const runs = [...p.getElementsByTagNameNS(W, 'r')].filter(r => tEls(r).some(t => t.textContent.trim()));
    const rp = r => [...r.childNodes].find(n => n.localName === 'rPr');
    if (runs.length && runs.every(r => on(val(rp(r), 'b')))) css.push('font-weight:700');
    if (runs.length && runs.every(r => on(val(rp(r), 'i')))) css.push('font-style:italic');
    const sz = runs.length ? Number(val(rp(runs[0]), 'sz')) : NaN; if (sz > 0) css.push(`font-size:${Math.round(sz / 2 * 1.333)}px`);
    const ind = Number(pPr?.getElementsByTagNameNS(W, 'ind')[0]?.getAttributeNS(W, 'left') || 0); if (ind > 0) css.push(`padding-left:${Math.min(120, Math.round(ind / 15))}px`);
    const st = String(val(pPr, 'pStyle') || '');
    return { css: css.join(';'), li: !!pPr?.getElementsByTagNameNS(W, 'numPr')[0] || /list|saraksts/i.test(st) };
  }
  /* --- Attēlošana --- */
  function draw() {
    let d = U.$('tplEditDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'tplEditDialog'; d.className = 'wide'; document.body.appendChild(d); }
    ed.paras = []; ed.orig = [];
    const body = ed.doc.getElementsByTagNameNS(W, 'body')[0];
    const para = p => { const i = ed.paras.push(p) - 1, s = ptext(p); ed.orig[i] = s; const st = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
      return `<div class="te-p ${/heading|virsraksts|title/i.test(st) ? 'h' : ''}${look(p).li ? ' li' : ''}" style="${look(p).css}" data-pi="${i}">${esc(s)}</div>`; };
    const block = el => {
      if (el.namespaceURI !== W) return '';
      if (el.localName === 'p') return para(el);
      if (el.localName === 'tbl') return `<table class="te-tbl">${[...el.childNodes].filter(r => r.localName === 'tr').map(tr => `<tr>${[...tr.childNodes].filter(c => c.localName === 'tc').map(tc => `<td>${[...tc.childNodes].map(block).join('')}</td>`).join('')}</tr>`).join('')}</table>`;
      if (el.localName === 'sdt') return [...(el.getElementsByTagNameNS(W, 'sdtContent')[0]?.childNodes || [])].map(block).join('');
      return '';
    };
    const html = [...body.childNodes].map(block).join('');
    d.innerHTML = `<header class="dlg-head"><h2>${ic('edit', '✎')} Atzīmes veidnē — ${esc(ed.t.name)}</h2><button type="button" class="ghost" data-act="tplEditClose" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body te-wrap">
        <div class="te-col"><div class="te-prog" id="teProg" hidden><div class="te-bar"><i></i></div><span></span></div>
        <div class="te-doc" id="teDoc" lang="lv" contenteditable="plaintext-only" spellcheck="false">${html || '<p class="muted">Dokumentā nav teksta.</p>'}</div></div>
        <aside class="te-side">
          <div class="te-spell"><label class="check"><input type="checkbox" data-te="spell" ${spellOn() ? 'checked' : ''}> <b>Pārbaudīt pareizrakstību</b> (latviešu)</label>
            <p class="small muted" style="margin:4px 0 0">Kļūdas tiek pasvītrotas ar sarkanu viļņoto līniju; <b>labā peles poga</b> uz vārda — labojuma ieteikumi. Rīka vārdnīca darbojas datorā, arī bez interneta — teksts netiek sūtīts. Atzīmes {…} netiek pārbaudītas.</p></div>
          <p class="small" style="margin-top:10px"><b>Kā ielikt atzīmi:</b> noklikšķini tekstā vietā, kur jābūt datiem (vai iezīmē paraugtekstu, piem. “Jānis Paraugs”), un izvēlies atzīmi zemāk.</p>
          <div class="actions" style="margin-bottom:8px"><button type="button" class="sm" data-act="tplEditPara">＋ Rindkopa zemāk</button><button type="button" class="sm" data-act="tplEditRow" title="Tukša tabulas rinda zem izvēlētās šūnas rindas — sarakstam ieliec tajā personas atzīmes">＋ Tabulas rinda</button></div>
          ${ed.t.type === 'custom' ? '<p class="small muted">Personas atzīmes <b>tabulas rindā</b> → saraksts (rinda katrai personai). <b>Tekstā</b> → katrai personai savs dokuments.</p>' : ed.t.type !== 'contract' ? '<p class="small muted">Dalībnieka atzīmes jāliek <b>tabulas rindā</b> — tā atkārtosies katram dalībniekam.</p>' : ''}
          ${tagsFor(ed.t.type).map(g => `<div class="te-grp"><div class="small muted">${esc(g.label)}</div>${g.tags.map(k => `<button type="button" class="chipbtn te-tag" data-act="tplEditTag" data-arg="${esc(k)}">${esc(k)}</button>`).join('')}</div>`).join('')}
          <p class="small muted">Formatējums (fonts, treknraksts) saglabājas. Galvenes un kājenes tekstu var labot Word programmā.</p></aside>
      </div>
      <footer class="dlg-foot"><span class="small muted grow" id="teState">Nav izmaiņu</span><button type="button" data-act="tplEditClose">Aizvērt</button><button type="button" class="mainbtn" data-act="tplEditSave">${ic('save', '💾')} Saglabāt veidni</button></footer>`;
    if (!d.open) d.showModal();
    if (spellOn()) poke();
    d.oncancel = e => { if (ed?.dirty && !confirm('Aizvērt bez saglabāšanas? Izmaiņas tiks zaudētas.')) e.preventDefault(); };
  }
  const mark = () => { ed.dirty = true; const s = U.$('teState'); if (s) s.textContent = 'Ir nesaglabātas izmaiņas'; };
  document.addEventListener('selectionchange', () => {
    if (!ed || Date.now() < (ed.pokeUntil || 0)) return; const s = getSelection(); if (!s.rangeCount) return; const el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest?.('#tplEditDialog .te-p');
    if (el) { ed.last = { i: +el.dataset.pi, range: s.getRangeAt(0).cloneRange() }; if (!el.classList.contains('on')) { U.qsa('#tplEditDialog .te-p.on').forEach(x => x.classList.remove('on')); el.classList.add('on'); } }
  });
  document.addEventListener('input', e => { if (e.target.closest?.('#teDoc')) mark(); }, true);
  /* Vienā laukumā nedrīkst sapludināt / sadalīt rindkopas (tās atbilst Word rindkopām) — Enter un dzēšana pāri robežai netiek atļauta */
  const pOf = n => (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.('#teDoc .te-p');
  const offIn = (el, node, off) => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(node, off); return r.toString().length; };
  document.addEventListener('beforeinput', e => {
    if (!e.target.closest?.('#teDoc')) return;
    const t = e.inputType, s = getSelection(); if (!s.rangeCount) return;
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); return; }
    const r = s.getRangeAt(0), a = pOf(r.startContainer), b = pOf(r.endContainer);
    if (!a || a !== b) { e.preventDefault(); if (a !== b) ui.toast('Iezīmē tekstu vienas rindkopas robežās', 'warn', 2500); return; }
    if (r.collapsed && t === 'deleteContentBackward' && offIn(a, r.startContainer, r.startOffset) === 0) { e.preventDefault(); return; }
    if (r.collapsed && t === 'deleteContentForward' && offIn(a, r.startContainer, r.startOffset) >= a.textContent.length) { e.preventDefault(); return; }
  }, true);
  document.addEventListener('paste', e => { if (!e.target.closest?.('#teDoc')) return; e.preventDefault(); const tx = (e.clipboardData?.getData('text/plain') || '').replace(/\s*\n\s*/g, ' '); if (pOf(getSelection().anchorNode)) document.execCommand('insertText', false, tx); }, true);
  A.tplEditTag = tag => {
    if (!ed?.last) return ui.toast('Vispirms noklikšķini tekstā vietā, kur ielikt atzīmi', 'warn');
    const el = U.qs(`#tplEditDialog .te-p[data-pi="${ed.last.i}"]`); if (!el) return;
    const rg = ed.last.range, i = ed.last.i; U.$('teDoc').focus({ preventScroll: true }); ed.last = { i, range: rg };
    if (rg && el.contains(rg.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(rg); }
    else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    document.execCommand('insertText', false, tag);
    mark();
  };
  A.tplEditPara = () => {
    if (!ed?.last) return ui.toast('Vispirms noklikšķini rindkopā, zem kuras pievienot jaunu', 'warn');
    sync(); const p = ed.paras[ed.last.i]; if (!p) return;
    const np = ed.doc.createElementNS(W, 'w:p'), pPr = p.getElementsByTagNameNS(W, 'pPr')[0], r0 = p.getElementsByTagNameNS(W, 'r')[0]?.getElementsByTagNameNS(W, 'rPr')[0];
    if (pPr) np.appendChild(pPr.cloneNode(true));
    const r = ed.doc.createElementNS(W, 'w:r'); if (r0) r.appendChild(r0.cloneNode(true)); const t = ed.doc.createElementNS(W, 'w:t'); t.setAttributeNS(XS, 'xml:space', 'preserve'); r.appendChild(t); np.appendChild(r);
    p.parentNode.insertBefore(np, p.nextSibling);
    const i = ed.last.i + 1; mark(); draw(); mark();
    const el = U.qs(`#tplEditDialog .te-p[data-pi="${i}"]`); if (el) { U.$('teDoc').focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); ed.last = { i, range: r.cloneRange() }; }
  };

  A.tplEditRow = () => {
    const p = ed?.last && ed.paras[ed.last.i], tr = p && (() => { let x = p.parentNode; while (x && !(x.namespaceURI === W && x.localName === 'tr')) x = x.parentNode; return x; })();
    if (!tr) return ui.toast('Vispirms noklikšķini tabulas šūnā, zem kuras rindas pievienot jaunu', 'warn');
    sync(); const nr = tr.cloneNode(true);
    tEls(nr).forEach(t => { t.textContent = ''; });
    tr.parentNode.insertBefore(nr, tr.nextSibling); mark(); draw(); mark();
  };
  /* --- Izmaiņu ierakstīšana XML: tikai mainītā daļa, tajā pašā run --- */
  function applyEdit(p, oldT, newT) {
    if (oldT === newT) return;
    let ts = tEls(p);
    if (!ts.length) { const r = ed.doc.createElementNS(W, 'w:r'), t = ed.doc.createElementNS(W, 'w:t'); r.appendChild(t); p.appendChild(r); ts = [t]; }
    let a = 0; while (a < oldT.length && a < newT.length && oldT[a] === newT[a]) a++;
    let b = 0; while (b < oldT.length - a && b < newT.length - a && oldT[oldT.length - 1 - b] === newT[newT.length - 1 - b]) b++;
    const from = a, to = oldT.length - b, ins = newT.slice(a, newT.length - b);
    let pos = 0, done = false;
    for (const t of ts) {
      const s = t.textContent, st = pos, en = pos + s.length; pos = en;
      const keepA = s.slice(0, Math.max(0, Math.min(s.length, from - st))), keepB = s.slice(Math.max(0, Math.min(s.length, to - st)));
      let mid = ''; if (!done && from >= st && (from < en || (from === en && (to === from || t === ts.at(-1))))) { mid = ins; done = true; }   // aizstājot — tajā run, kur sākas aizstājamais teksts
      const v = keepA + mid + keepB; if (v !== s) { t.textContent = v; t.setAttributeNS(XS, 'xml:space', 'preserve'); }
    }
  }
  function sync() {
    U.qsa('#tplEditDialog .te-p').forEach(el => {
      const i = +el.dataset.pi, nt = el.innerText.replace(/\n+$/, '').replace(/\n+/g, ' ').replace(/ /g, ' ');
      if (nt !== ed.orig[i]) { applyEdit(ed.paras[i], ed.orig[i], nt); ed.orig[i] = nt; }
    });
  }
  A.tplEditSave = async () => {
    if (!ed) return; sync();
    try {
      ed.files.set('word/document.xml', new TextEncoder().encode(new XMLSerializer().serializeToString(ed.doc)));
      const blob = await CP.docxFill.zip([...ed.files]);
      const base = ed.t.name.replace(/ \(labots [\d.]+\)( \(\d+\))?$/, '');
      const path = await CP.store.saveFile(['Veidnes'], `${base} (labots ${U.fmtDate(U.iso())}).docx`, blob);
      ed.t.prev = [...(ed.t.prev || []), ed.t.path]; ed.t.path = path; ed.t.editedAt = U.now();
      if (ed.t.type === 'custom' && CP.customForms) { try { await CP.customForms.analyse(ed.t); } catch (e) { } }
      CP.store.changed(); ed.dirty = false;
      ui.toast(`Veidne saglabāta: ${path}. Iepriekšējā versija paliek mapē Veidnes.`, 'ok', 8000);
      U.$('tplEditDialog').close(); ed = null; CP.render();
    } catch (e) { console.error(e); ui.toast('Neizdevās saglabāt: ' + e.message, 'err', 10000); }
  };
  A.tplEditClose = () => { if (ed?.dirty && !confirm('Aizvērt bez saglabāšanas? Izmaiņas tiks zaudētas.')) return; U.$('tplEditDialog')?.close(); ed = null; };
  document.addEventListener('close', e => { if (e.target.id === 'tplEditDialog') { spellGen++; spellBad = []; window.CSS?.highlights?.delete('cp-spell'); } }, true);
  CP.tplEdit = { applyEdit: (p, o, n) => applyEdit(p, o, n) };
})(window.CP);
