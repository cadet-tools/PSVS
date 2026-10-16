/* =====================================================================
   Ziņot — kļūdas, ieteikumi, atsauksmes izstrādātājam.
   • Ziņojums (tēma, virsraksts, apraksts, ekrānuzņēmumi, kontakts, tehniskā informācija) tiek nosūtīts
     uz izstrādātāja Google Apps Script tīmekļa lietotni → Google tabula + attēli Drive mapē + e-pasts.
   • Ekrānuzņēmumus pirms sūtīšanas var aizklāt (melni taisnstūri). Aizklātais tiek “iededzināts” attēlā —
     oriģināls netiek sūtīts.
   • Uzņemt ekrānu: pārlūka ekrāna kopīgošana (getDisplayMedia) → peldoša josla, lai pārietu uz vajadzīgo vietu rīkā.
   • Ja sūtīšana nav iestatīta vai nav interneta: ziņojumu var saglabāt failā (HTML ar attēliem) un nodot citādi.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const DKEY = 'cp.fbDraft', HKEY = 'cp.fbSent', CKEY = 'cp.fbContact';
  const MAXIMG = 5, MAXW = 1600;
  const TYPES = [['bug', '🐞', 'Kļūda'], ['idea', '💡', 'Ieteikums'], ['review', '💬', 'Atsauksme'], ['question', '❓', 'Jautājums']];
  const PH = {
    bug: 'Kas notika? Ko tieši darīji pirms tam (soļi)? Ko gaidīji, ka notiks?',
    idea: 'Ko vajadzētu uzlabot vai pievienot? Kā tas palīdzētu darbā?',
    review: 'Kas patīk, kas traucē, kā rīks noder ikdienā?',
    question: 'Ko gribi uzzināt?'
  };
  const sendUrl = () => { try { return localStorage.getItem('cp.fbUrl') || CP.FEEDBACK_URL || ''; } catch (e) { return CP.FEEDBACK_URL || ''; } };
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  /* --- Pēdējās kļūdas (tehniskajai informācijai) --- */
  const ERRS = [];
  const pushErr = m => { m = String(m || '').slice(0, 300); if (!m) return; ERRS.push(`${new Date().toTimeString().slice(0, 8)} ${m}`); if (ERRS.length > 10) ERRS.shift(); };
  window.addEventListener('error', e => pushErr(e.message + (e.filename ? ` (${String(e.filename).split('/').pop()}:${e.lineno})` : '')));
  window.addEventListener('unhandledrejection', e => pushErr('Promise: ' + (e.reason?.message || e.reason)));

  /* --- Melnraksts --- */
  const blank = () => ({ type: 'bug', title: '', text: '', name: '', contact: '', tech: true, page: '' });
  let F = Object.assign(blank(), lsGet(DKEY, {}), lsGet(CKEY, {}));
  let shots = [];          // { id, src (dataURL), w, h, boxes: [{x,y,w,h} 0..1] }
  let sending = false;
  const saveDraft = U.debounce(() => { lsSet(DKEY, { type: F.type, title: F.title, text: F.text, tech: F.tech }); lsSet(CKEY, { name: F.name, contact: F.contact }); }, 400);

  function tech() {
    return {
      version: CP.VERSION, channel: CP.CHANNEL, page: F.page || S.page,
      browser: navigator.userAgent, lang: navigator.language,
      screen: `${screen.width}×${screen.height}, logs ${innerWidth}×${innerHeight}, mērogs ${devicePixelRatio}`,
      theme: document.documentElement.dataset.theme || '', dataFolder: S.root ? 'pieslēgta' : 'nav',
      online: navigator.onLine, errors: ERRS.slice()
    };
  }
  const placeLabel = p => ({ dashboard: 'Pārskats', people: 'Personas', person: 'Personas kartīte', comms: 'Saziņa', schedule: 'Grafiks', attendance: 'Apmeklējums', forms: 'Veidlapas', formEdit: 'Veidlapa', documents: 'Dokumenti', equipment: 'Ekipējums', alerts: 'Uzdevumi', archive: 'Arhīvs', about: 'Par rīku', settings: 'Iestatījumi' }[p] || p || '—');

  /* --- Lapa --- */
  CP.pages.feedback = {
    render() {
      const url = sendUrl(), hist = lsGet(HKEY, []);
      const t = tech();
      return `<div class="page narrow fb">${ui.backBtn()}
        <section class="card fb-card" id="fbForm"><h3>${ic('flag', '⚑')}Ziņot izstrādātājam</h3>
          <p class="small muted" style="margin-top:0">Pamanīji kļūdu, ir ideja vai vienkārši gribi pateikt, kā rīks noder? Uzraksti — ziņojums nonāks pie rīka izstrādātāja. Ja gribi atbildi, norādi savu kontaktu.</p>
          <div class="field"><label>Tēma</label><div class="fb-types">${TYPES.map(([k, e, l]) => `<label class="fb-type ${F.type === k ? 'on' : ''}"><input type="radio" name="fbType" value="${k}" ${F.type === k ? 'checked' : ''}><span class="fb-emo">${e}</span>${l}</label>`).join('')}</div></div>
          <div class="field"><label for="fbTitle">Īsi — par ko ir ziņojums</label><input id="fbTitle" maxlength="140" value="${esc(F.title)}" placeholder="${F.type === 'bug' ? 'piem., Neatveras veidlapa “Instruktāža”' : 'piem., Grafikā pievienot krāsu katrai grupai'}"></div>
          <div class="field"><label for="fbText">Apraksts</label><textarea id="fbText" rows="7" placeholder="${esc(PH[F.type])}">${esc(F.text)}</textarea></div>
          <div class="field"><label>Ekrānuzņēmumi <span class="muted small">(nav obligāti, līdz ${MAXIMG})</span></label>
            <div class="fb-drop" id="fbDrop" tabindex="0"><span class="fb-drop-ic">🖼</span><b>Ievelc attēlu šeit vai ielīmē ar Ctrl+V</b>
              <span class="small muted">Windows: Win+Shift+S izgriež ekrāna daļu, pēc tam šeit Ctrl+V</span>
              <div class="actions" style="justify-content:center;margin-top:6px"><button type="button" class="sm" data-act="fbCapture">📷 Uzņemt rīka ekrānu</button><button type="button" class="sm ghost" data-act="fbPick">Izvēlēties failu…</button></div></div>
            <div class="fb-shots" id="fbShots">${shotsHtml()}</div>
            <p class="fb-warn small">🔒 <b>Pirms sūtīšanas aizklāj jaunsargu datus</b> — vārdus, personas kodus, tālruņus, adreses. Spied <b>✎ Aizklāt</b> pie attēla un ar peli pārvelc pāri melnu taisnstūri.</p></div>
          <div class="fieldgrid"><div class="field"><label for="fbName">Tavs vārds <span class="muted small">(nav obligāti)</span></label><input id="fbName" value="${esc(F.name)}" autocomplete="name"></div>
            <div class="field"><label for="fbContact">E-pasts vai tālrunis atbildei <span class="muted small">(nav obligāti)</span></label><input id="fbContact" value="${esc(F.contact)}" autocomplete="email"></div></div>
          <label class="check"><input type="checkbox" id="fbTech" ${F.tech ? 'checked' : ''}> Pievienot tehnisko informāciju (versija, pārlūks, lapa, pēdējās kļūdas)</label>
          <details class="fb-tech small"><summary>Ko tieši pievieno?</summary><pre>${esc(techText(t))}</pre><p class="muted">Personu dati te netiek iekļauti.</p></details>
          <div class="actions" style="margin-top:12px">
            <button class="mainbtn" data-act="fbSend" ${sending ? 'disabled' : ''}>${sending ? '<span class="spin"></span> Sūta…' : '➤ Nosūtīt'}</button>
            <button class="ghost" data-act="fbSaveFile" title="Saglabā ziņojumu ar attēliem vienā failā, ko var nosūtīt citā veidā">⇩ Saglabāt failā</button>
            <span class="grow"></span><button class="ghost sm" data-act="fbClear">Notīrīt</button></div>
          ${url ? '' : '<p class="small warn">Sūtīšana šajā versijā vēl nav ieslēgta. Ziņojumu var saglabāt failā un nosūtīt izstrādātājam citā veidā.</p>'}
        </section>
        ${hist.length ? `<section class="card"><h3>${ic('clock', '◷')}Mani nosūtītie ziņojumi <span class="muted small">(šajā datorā)</span></h3>
          ${hist.slice(0, 15).map(h => `<div class="row"><span class="fb-emo">${(TYPES.find(x => x[0] === h.type) || TYPES[0])[1]}</span><div class="grow"><b>${esc(h.title || '(bez virsraksta)')}</b><div class="small muted">${esc(U.fmtDateTime(h.at))}${h.shots ? ` · ${h.shots} attēli` : ''}</div></div><span class="small ${h.ok ? 'okc' : 'muted'}">${h.ok ? '✓ nosūtīts' : 'saglabāts failā'}</span></div>`).join('')}</section>` : ''}
      </div>`;
    }
  };
  const techText = t => [`Versija: ${t.version} (${t.channel})`, `Lapa: ${placeLabel(t.page)}`, `Pārlūks: ${t.browser}`, `Ekrāns: ${t.screen}`, `Datu mape: ${t.dataFolder}`, `Kļūdas: ${t.errors.length ? '\n  ' + t.errors.join('\n  ') : 'nav'}`].join('\n');
  function shotsHtml() {
    return shots.map((s, i) => `<figure class="fb-shot"><img src="${s.src}" alt="Ekrānuzņēmums ${i + 1}">${s.boxes.map(b => `<i class="fb-box" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"></i>`).join('')}
      <figcaption><span class="small ${s.boxes.length ? 'okc' : 'muted'}">${s.boxes.length ? `✓ aizklāti ${s.boxes.length}` : 'nav aizklāts'}</span><span class="grow"></span><button type="button" class="sm" data-act="fbMask" data-arg="${s.id}">✎ Aizklāt</button><button type="button" class="sm ghost" data-act="fbDel" data-arg="${s.id}" aria-label="Noņemt">✕</button></figcaption></figure>`).join('');
  }
  const paintShots = () => { const el = U.$('fbShots'); if (el) el.innerHTML = shotsHtml(); };

  /* --- Ievade --- */
  document.addEventListener('input', e => {
    const t = e.target; if (!t.closest?.('#fbForm')) return;
    if (t.id === 'fbTitle') F.title = t.value; else if (t.id === 'fbText') F.text = t.value; else if (t.id === 'fbName') F.name = t.value; else if (t.id === 'fbContact') F.contact = t.value; else return;
    saveDraft();
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest?.('#fbForm')) return;
    if (t.name === 'fbType') { F.type = t.value; document.querySelectorAll('.fb-type').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); const x = U.$('fbText'); if (x) x.placeholder = PH[F.type]; saveDraft(); }
    if (t.id === 'fbTech') { F.tech = t.checked; saveDraft(); }
  });
  // attēli: ievilkt / ielīmēt
  document.addEventListener('dragover', e => { const d = e.target.closest?.('#fbDrop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = e.target.closest?.('#fbDrop'); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { const d = e.target.closest?.('#fbDrop'); if (!d) return; e.preventDefault(); e.stopPropagation(); d.classList.remove('over'); addFiles(e.dataTransfer.files); }, true);
  document.addEventListener('paste', e => {
    if (S.page !== 'feedback' || !U.$('fbForm')) return;
    const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault(); addFiles(imgs);
  });
  A.fbPick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => addFiles(i.files); i.click(); };
  async function addFiles(list) {
    for (const f of [...list || []]) {
      if (!f.type.startsWith('image/')) { ui.toast(`“${f.name}” nav attēls`, 'warn'); continue; }
      await addImage(await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }));
    }
  }
  async function addImage(src) {
    if (shots.length >= MAXIMG) return ui.toast(`Var pievienot ne vairāk kā ${MAXIMG} attēlus`, 'warn');
    const img = await loadImg(src);
    // samazina lielus attēlus jau uzreiz (mazāk atmiņas, ātrāka sūtīšana)
    const k = Math.min(1, MAXW / img.naturalWidth), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
    const s = { id: U.uid(), src: c.toDataURL('image/png'), w, h, boxes: [] };
    shots.push(s); paintShots();
    return s;
  }
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('attēlu neizdevās nolasīt')); i.src = src; });
  A.fbDel = id => { shots = shots.filter(s => s.id !== id); paintShots(); };

  /* --- Ekrāna uzņemšana: kopīgo šo cilni, pāriet uz vajadzīgo vietu, “Uzņemt” --- */
  let cap = null;
  A.fbCapture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) return ui.toast('Šis pārlūks neatbalsta ekrāna uzņemšanu. Lieto Win+Shift+S un ielīmē ar Ctrl+V.', 'warn', 9000);
    if (shots.length >= MAXIMG) return ui.toast(`Var pievienot ne vairāk kā ${MAXIMG} attēlus`, 'warn');
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' }); }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') ui.toast('Ekrānu neizdevās uzņemt: ' + e.message, 'err'); return; }
    const v = document.createElement('video'); v.muted = true; v.srcObject = stream; await v.play().catch(() => { });
    cap = { stream, v };
    stream.getVideoTracks()[0].addEventListener('ended', () => endCapture());
    // atpakaļ uz lapu, kur bija problēma; peldoša josla ļauj pāriet uz jebkuru vietu
    const back = F.page && F.page !== 'feedback' ? F.page : 'dashboard';
    ui.go(back);
    const bar = document.createElement('div'); bar.id = 'fbCapBar'; bar.className = 'fb-capbar';
    bar.innerHTML = `<span>📷 Atver vietu, ko gribi parādīt, tad spied</span><button type="button" id="fbCapNow">Uzņemt</button><button type="button" id="fbCap5" title="Noder, ja jāatver logs vai izvēlne">Pēc 5 s</button><button type="button" id="fbCapX" class="x">Atcelt</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#fbCapNow').onclick = () => grab();
    bar.querySelector('#fbCap5').onclick = e => { let n = 5; const b = e.currentTarget; b.disabled = true; const t = setInterval(() => { n--; b.textContent = n + ' s…'; if (n <= 0) { clearInterval(t); grab(); } }, 1000); b.textContent = '5 s…'; };
    bar.querySelector('#fbCapX').onclick = () => { endCapture(); ui.go('feedback'); };
  };
  async function grab() {
    if (!cap) return;
    const bar = U.$('fbCapBar'); if (bar) bar.style.visibility = 'hidden';
    await new Promise(r => setTimeout(r, 350));   // lai josla nepaliek attēlā
    const { v } = cap, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    endCapture();
    if (!c.width) { ui.go('feedback'); return ui.toast('Attēlu neizdevās uzņemt. Mēģini ar Win+Shift+S un Ctrl+V.', 'warn', 8000); }
    const s = await addImage(c.toDataURL('image/png'));
    ui.go('feedback');
    if (s) setTimeout(() => A.fbMask(s.id), 200);   // uzreiz piedāvā aizklāt
  }
  function endCapture() { if (!cap) return; cap.stream.getTracks().forEach(t => t.stop()); cap = null; U.$('fbCapBar')?.remove(); }

  /* --- Aizklāšana: melni taisnstūri, ko pārvelk ar peli --- */
  A.fbMask = id => {
    const s = shots.find(x => x.id === id); if (!s) return;
    let d = U.$('fbMaskDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'fbMaskDlg'; d.className = 'wide fb-maskdlg'; document.body.appendChild(d); }
    const boxes = s.boxes.map(b => ({ ...b }));
    d.innerHTML = `<header class="dlg-head"><h2>Aizklāt personu datus</h2><button type="button" class="ghost" data-close="fbMaskDlg" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Ar peli pārvelc pāri vārdiem, personas kodiem, tālruņiem u.c. — tie kļūs melni. Nosūtīts tiks tikai aizklātais attēls.</p>
        <div class="fb-maskwrap"><canvas id="fbMaskCv"></canvas></div></div>
      <footer class="dlg-foot"><button type="button" id="fbMaskUndo">↶ Atsaukt</button><button type="button" class="ghost" id="fbMaskClear">Notīrīt visu</button><span class="grow"></span><button type="button" data-close="fbMaskDlg">Atcelt</button><button type="button" class="mainbtn" id="fbMaskOk">✓ Gatavs</button></footer>`;
    if (!d.open) d.showModal();
    const cv = U.$('fbMaskCv'), ctx = cv.getContext('2d');
    loadImg(s.src).then(img => {
      cv.width = s.w; cv.height = s.h;
      const draw = (tmp) => { ctx.drawImage(img, 0, 0, s.w, s.h); ctx.fillStyle = '#000'; for (const b of boxes) ctx.fillRect(b.x * s.w, b.y * s.h, b.w * s.w, b.h * s.h); if (tmp) { ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(tmp.x * s.w, tmp.y * s.h, tmp.w * s.w, tmp.h * s.h); ctx.strokeStyle = '#f0a35e'; ctx.lineWidth = Math.max(2, s.w / 500); ctx.strokeRect(tmp.x * s.w, tmp.y * s.h, tmp.w * s.w, tmp.h * s.h); } };
      draw();
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
      let st = null;
      const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
      cv.onpointerdown = e => { st = pos(e); cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { if (st) draw(rect(st, pos(e))); };
      cv.onpointerup = e => { if (!st) return; const r = rect(st, pos(e)); st = null; if (r.w * s.w > 3 && r.h * s.h > 3) boxes.push(r); draw(); };
      U.$('fbMaskUndo').onclick = () => { boxes.pop(); draw(); };
      U.$('fbMaskClear').onclick = () => { boxes.length = 0; draw(); };
      U.$('fbMaskOk').onclick = () => { s.boxes = boxes; d.close(); paintShots(); };
    });
  };
  /** Gala attēls: aizklātais iededzināts, JPEG */
  async function finalImage(s) {
    const img = await loadImg(s.src), c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, s.w, s.h); x.fillStyle = '#000';
    for (const b of s.boxes) x.fillRect(Math.floor(b.x * s.w), Math.floor(b.y * s.h), Math.ceil(b.w * s.w) + 1, Math.ceil(b.h * s.h) + 1);
    return c.toDataURL('image/jpeg', 0.86);
  }

  /* --- Sūtīšana --- */
  function check() {
    if (!F.title.trim() && !F.text.trim()) { ui.toast('Uzraksti, par ko ir ziņojums', 'warn'); U.$('fbTitle')?.focus(); return false; }
    const unmasked = shots.filter(s => !s.boxes.length).length;
    if (unmasked && !confirm(`${unmasked === 1 ? 'Vienā attēlā' : unmasked + ' attēlos'} nekas nav aizklāts. Vai tur tiešām nav redzami jaunsargu vārdi, personas kodi vai citi personu dati?\n\nOK — sūtīt, Atcelt — atgriezties un aizklāt.`)) return false;
    return true;
  }
  async function payload() {
    return {
      k: 'cadet-zinot-v1', id: U.uid(), at: U.now(),
      type: F.type, typeLabel: (TYPES.find(t => t[0] === F.type) || TYPES[0])[2],
      title: F.title.trim(), text: F.text.trim(), name: F.name.trim(), contact: F.contact.trim(),
      tech: F.tech ? tech() : { version: CP.VERSION, channel: CP.CHANNEL },
      images: await Promise.all(shots.map(async (s, i) => ({ name: `attels_${i + 1}.jpg`, data: (await finalImage(s)).split(',')[1] })))
    };
  }
  function done(p, ok) {
    const h = lsGet(HKEY, []); h.unshift({ id: p.id, at: p.at, type: p.type, title: p.title, shots: p.images.length, ok }); lsSet(HKEY, h.slice(0, 30));
    if (ok) { shots = []; F = Object.assign(blank(), { name: F.name, contact: F.contact, page: F.page }); try { localStorage.removeItem(DKEY); } catch (e) { } }
    CP.render();
  }
  A.fbSend = async () => {
    if (sending || !check()) return;
    const url = sendUrl();
    if (!url) return ui.toast('Sūtīšana šajā versijā vēl nav ieslēgta. Spied “⇩ Saglabāt failā” un nosūti failu izstrādātājam.', 'warn', 9000);
    if (!navigator.onLine) return ui.toast('Nav interneta. Mēģini vēlāk vai saglabā ziņojumu failā.', 'warn', 8000);
    sending = true; CP.render();
    let p;
    try {
      p = await payload();
      const r = await fetch(url, { method: 'POST', body: JSON.stringify(p), redirect: 'follow' });   // text/plain → bez CORS priekšpieprasījuma
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw Error(j.error || ('serveris atbildēja ' + r.status));
      sending = false; done(p, true);
      ui.toast('✓ Paldies! Ziņojums nosūtīts izstrādātājam.', 'ok', 6000);
    } catch (e) {
      console.error(e); sending = false; CP.render();
      ui.toast('Ziņojumu neizdevās nosūtīt: ' + e.message + '. Teksts un attēli saglabājušies — mēģini vēlreiz vai “⇩ Saglabāt failā”.', 'err', 12000);
    }
  };
  A.fbSaveFile = async () => {
    if (!check()) return;
    const p = await payload(), t = p.tech;
    const html = `<!doctype html><html lang="lv"><head><meta charset="utf-8"><title>CADET ziņojums — ${esc(p.title)}</title><style>body{font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:900px;margin:30px auto;padding:0 16px}img{max-width:100%;border:1px solid #ccc;border-radius:8px;margin:8px 0}pre{background:#f4f4f4;padding:10px;border-radius:8px;white-space:pre-wrap}</style></head><body>
      <h1>${esc(p.typeLabel)}: ${esc(p.title || '(bez virsraksta)')}</h1><p>${esc(U.fmtDateTime(p.at))}${p.name ? ' · ' + esc(p.name) : ''}${p.contact ? ' · ' + esc(p.contact) : ''}</p>
      <pre>${esc(p.text)}</pre>${p.images.map(i => `<img src="data:image/jpeg;base64,${i.data}" alt="">`).join('')}<h3>Tehniskā informācija</h3><pre>${esc(JSON.stringify(t, null, 1))}</pre></body></html>`;
    U.download(new Blob([html], { type: 'text/html' }), `CADET zinojums ${U.iso()}.html`);
    done(p, false);
    ui.toast('Ziņojums saglabāts failā. Nosūti to izstrādātājam (piem., e-pastā vai WhatsApp).', 'ok', 8000);
  };
  A.fbClear = () => { if ((F.title || F.text || shots.length) && !confirm('Notīrīt ziņojumu?')) return; shots = []; F = Object.assign(blank(), { name: F.name, contact: F.contact, page: F.page }); try { localStorage.removeItem(DKEY); } catch (e) { } CP.render(); };

  // atceras, no kuras lapas atnāca (tehniskajai informācijai un ekrāna uzņemšanai)
  { const og = ui.go; ui.go = (page, opts) => { if (page === 'feedback' && S.page !== 'feedback' && !cap) F.page = S.page; return og(page, opts); }; }
  CP.feedback = { tech, shots: () => shots, addImage, TYPES };
})(window.CP);
