/* =====================================================================
   Iestatījumi. Glabājas datu failā, tātad līdzi datu mapei.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;

  const STABS = [['base', 'Pamata', 'sliders'], ['sec', 'Drošība un kopijas', 'shield'], ['docs', 'Dokumenti', 'file'], ['comms', 'Saziņa', 'chat'], ['perm', 'Atļaujas', 'lock']];
  A.setTab = k => { S.setTab = k; U.qsa('[data-stab]').forEach(el => { el.hidden = el.dataset.stab !== k; }); U.qsa('.set-tabs [data-act=setTab]').forEach(b => { const on = b.dataset.arg === k; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); }); };
  /** Ritina tā, lai kartīte būtu ekrāna vidū; ja tā ir augstāka par ekrānu — tās augša redzama zem cilnēm */
  ui.scrollToCard = c => {
    let sc = c.parentElement; while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const box = sc && sc !== document.body ? sc.getBoundingClientRect() : { top: 0, height: innerHeight };
    const top0 = Math.max(box.top, 0), tabs = document.querySelector('.set-tabs'), stick = tabs && getComputedStyle(tabs).position === 'sticky' ? tabs.getBoundingClientRect().height + 8 : 8;
    const visH = Math.min(box.height, innerHeight - top0) - stick, r = c.getBoundingClientRect();
    const want = r.height < visH ? top0 + stick + (visH - r.height) / 2 : top0 + stick;
    const dy = r.top - want;
    if (sc && sc !== document.body) sc.scrollBy({ top: dy, behavior: 'smooth' }); else window.scrollBy({ top: dy, behavior: 'smooth' });
  };
  /** Atver Iestatījumus pie konkrētas kartītes (pareizajā cilnē), ritina un iezīmē */
  ui.goSettingsCard = id => {
    const tabOf = { watchCard: 'base', instCard: 'base', unitCard: 'base', lockCard: 'sec', encCard: 'sec', healthCard: 'sec', retCard: 'sec', dataCard: 'sec', docsCard: 'docs', commsCard: 'comms', permsCard: 'perm', yearsCard: 'base' };
    if (tabOf[id]) S.setTab = tabOf[id];
    ui.go('settings');
    setTimeout(() => { const c = U.$(id); if (!c) return; const t = c.closest('[data-stab]'); if (t?.hidden) A.setTab(t.dataset.stab); ui.scrollToCard(c); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 2200); }, 80);
  };
  A.goSetCard = id => ui.goSettingsCard(id);
  CP.pages.settings = {
    render() {
      const s = S.db.settings, o = s.ocr;
      const tab = STABS.some(t => t[0] === S.setTab) ? S.setTab : 'base', T = k => `<div class="set-tab" data-stab="${k}" ${tab === k ? '' : 'hidden'}>`;
      return `<div class="page narrow">${ui.pageHead('Iestatījumi', `CADET PERSONĀLS ${CP.VERSION}`, ui.saveBtn())}
      <nav class="tabs set-tabs" role="tablist">${STABS.map(([k, l, i]) => `<button role="tab" type="button" data-act="setTab" data-arg="${k}" class="${tab === k ? 'active' : ''}" aria-selected="${tab === k}">${CP.ic(i)}${l}</button>`).join('')}</nav>
      ${T('base')}
      ${CP.D2 ? `<section class="card"><h3>${CP.ic('layout')}Izskats</h3><div class="lookrow">
        <span>Tēma</span><div class="actions"><span class="themepick" role="group" aria-label="Tēma">${[['dark', 'Tumšā'], ['light', 'Gaišā'], ['auto', 'Kā datorā']].map(([v, l]) => `<button type="button" data-act="setTheme" data-arg="${v}" class="${CP.theme.get() === v ? 'on' : ''}" aria-pressed="${CP.theme.get() === v}">${l}</button>`).join('')}</span></div>
        <span>Akcenta krāsa</span><div class="swatches" role="group" aria-label="Akcenta krāsa">${(() => { const cur = CP.theme.accent(), known = CP.ACCENTS.some(([c]) => c === cur); return CP.ACCENTS.map(([c, n]) => `<button type="button" class="swatch ${c === cur ? 'on' : ''}" style="--sw:${c}" data-act="setAccent" data-arg="${c}" title="${n}" aria-label="${n}" aria-pressed="${c === cur}"></button>`).join('') + `<label class="btn swatch custom ${known ? '' : 'on'}" title="Sava krāsa" ${known ? '' : `style="--sw:${cur};background:${cur}"`}><input type="color" id="accentPick" value="${cur}" aria-label="Sava krāsa"></label>`; })()}</div>
      </div><p class="small muted" style="margin:12px 0 0">Akcents nosaka pogas, izcēlumus, saites un vieglu fona toni. Izskats tiek saglabāts šajā pārlūkā un datu failā.</p></section>` : ''}
      ${CP.watchPrefs ? (() => { const w = CP.watchPrefs(); return `<section class="card" id="watchCard"><h3>${CP.ic('clock')}Pulkstenis un pauzes</h3><div class="lookrow">
        <span>Ciparnīca</span><div class="actions"><span class="themepick" role="group" aria-label="Ciparnīca">${CP.WATCH_FACES.map(([k, l]) => `<button type="button" data-act="watchFace" data-arg="${k}" class="${w.face === k ? 'on' : ''}" aria-pressed="${w.face === k}">${l}</button>`).join('')}</span></div>
        <span>Atgādināt par pauzi</span><div class="actions"><label class="check"><input type="checkbox" data-watch="remind" ${w.remind ? 'checked' : ''}> pēc</label><input type="number" class="w-num-in" min="10" max="180" step="5" data-watch="workMin" value="${w.workMin}" aria-label="Minūtes līdz pauzei"> <span class="small muted">min darba, pauze</span><input type="number" class="w-num-in" min="1" max="30" data-watch="breakMin" value="${w.breakMin}" aria-label="Pauzes minūtes"> <span class="small muted">min, atkārtot pēc</span><input type="number" class="w-num-in" min="1" max="60" data-watch="snoozeMin" value="${w.snoozeMin}" aria-label="Atkārtot pēc minūtēm"> <span class="small muted">min</span></div>
        <span>Liels pulkstenis</span><div class="actions"><label class="check"><input type="checkbox" data-watch="idle" ${w.idle ? 'checked' : ''}> parādīt virs rīka, ja nav darbības</label><input type="number" class="w-num-in" min="1" max="60" data-watch="idleMin" value="${w.idleMin}" aria-label="Minūtes bez darbības"> <span class="small muted">min</span><button type="button" class="sm" data-act="watchBig">Parādīt tagad</button></div>
        <span>Skaņa</span><div class="actions"><label class="check"><input type="checkbox" data-watch="sound" ${w.sound ? 'checked' : ''}> signāls, kad beidzas taimeris vai pauze</label><button type="button" class="sm ghost" data-act="watchTestBeep">Pārbaudīt</button></div>
      </div><p class="small muted" style="margin:12px 0 0">Lielais pulkstenis paslēpj arī personu datus, kamēr dators stāv bez uzraudzības.</p></section>`; })() : ''}
      ${CP.setup ? CP.setup.instCard() : ''}
      ${CP.unit ? CP.unit.card() : ''}
      <section class="card" id="yearsCard"><h3>Mācību gadi</h3>
        <p class="small">Aktīvais gads: <b>${esc(U.yearLabel(S.db.settings.activeYear))}</b>. Gadu maiņa nepārvieto personas, dokumentus un ekipējumu. Viena persona ir viens profils, un katram gadam ir savs dalības ieraksts.</p>
        ${(S.db.years || []).map(y => `<div class="row"><div class="grow"><b>${esc(U.yearLabel(y.id))}</b> <small class="muted">${(S.db.enrollments || []).filter(e => e.yearId === y.id).length} dalības</small>${y.id === S.db.settings.activeYear ? ' <span class="tag">izvēlēts</span>' : ''}${y.id === U.schoolYear() ? ' <span class="tag">pašreizējais</span>' : ''}</div><button class="sm" data-act="setYear" data-arg="${esc(y.id)}">Atvērt</button>${y.id === S.db.settings.activeYear || y.id === U.schoolYear() ? '' : `<button class="sm ghost danger" data-act="yearDelete" data-arg="${esc(y.id)}" title="Dzēst mācību gadu">✕ Dzēst</button>`}</div>`).join('')}
        <div class="actions" style="margin-top:10px"><button class="mainbtn sm" data-act="openAddYear">＋ Pievienot mācību gadu</button><button class="sm" data-act="openMove">⇄ Pārcelt dalībniekus uz citu gadu</button><button class="sm" data-act="ensureFolders">Izveidot gada mapes</button>${CP.yearEnd ? '<button class="sm" data-act="yearEnd">✓ Mācību gada noslēgums…</button>' : ''}</div>
        <p class="muted small">Mapē Macibu_gadi katram gadam ir Dokumenti, Pasakumi un Atskaites. Esošie personu dokumenti netiek pārvietoti.</p></section>
      </div>${T('sec')}
      <section class="card" id="dataCard"><h3>Datu glabāšana</h3>
        ${ui.dl([['Datu mape', S.rootName || 'nav izvēlēta'], ['Datu fails', CP.DATAFILE], ['JSON kopijas', 'mape _rezerves, ar datumu un laiku (netiek dzēstas)'], ['Pēdējā saglabāšana', U.fmtDateTime(S.db.updatedAt) || '—']])}
        <div class="actions" style="margin-top:12px"><button data-act="pickRoot">📁 Mainīt datu mapi</button><button data-act="backupNow">Izveidot JSON kopiju</button><button data-act="backup">⬇ Lejupielādēt JSON</button><button data-act="exportCsv">⬇ Personas CSV</button><button data-act="createYear">Izveidot ${U.schoolYear()} mapes</button></div>
        ${ui.rootDrop()}
        ${CP.WEB ? `<div class="actions" style="margin-top:10px">${CP.installPrompt ? '<button data-act="installApp">⬇ Instalēt kā lietotni</button>' : ''}<span class="small muted">Dati glabājas tikai tavā datu mapē.</span></div>` : ''}
        <details class="small" style="margin-top:8px"><summary>Mapes piekļuves diagnostika</summary>${(() => { const g = CP.store.diag || {}, l = g.last; return ui.dl([['Protokols', g.protocol], ['Programmas atrašanās', g.host === '(lokāls)' ? 'lokāls ceļš ✓' : 'tīkla ceļš \\\\' + g.host + ' ⚠'], ['Drošs konteksts', String(g.secure)], ['Mapes dialogs', g.picker === 'function' ? 'pieejams' : 'nav'], ['Ievilkšana', g.dropHandle === 'function' ? 'pieejama' : 'nav'], ['Pēdējais notikums', l ? `${l.at} · ${l.via} → ${l.step}${l.ms != null ? ' (' + l.ms + ' ms)' : ''}${l.error ? ' · ' + l.error : ''}` : '—']]); })()}</details>
        <label class="check" style="margin-top:12px"><input type="checkbox" data-set="autosave" ${s.autosave ? 'checked' : ''}> Saglabāt automātiski pēc katras izmaiņas</label>
        <p class="muted small">JSON kopija satur datubāzi, nevis dokumentu failus. Tā netiek saukta par pilnu arhīvu.</p>
        <h4>Rezerves kopijas</h4>
        <div id="backupList"><p class="muted small">Ielādē sarakstu…</p></div>
        <h4>Datu arhīvs</h4>
        <p class="small">Arhīvs mapē <b>_arhivi</b> ietver JSON un reģistrētos failus no pamatmapes. Ārējo mapju faili tiek kopēti tikai ar tavu piekrišanu. Ja kāds fails netiek iekļauts, arhīvs ir daļējs.</p>
        <div class="actions"><button data-act="makeArchive">Izveidot datu arhīvu</button></div>
        <div id="archiveList"></div>
        <h4>Papildu dokumentu mapes</h4>
        <div id="sourceList"></div>
        <div class="actions" style="margin-top:8px"><button class="sm" data-act="extra">＋ Pievienot papildu mapi</button></div></section>

      ${CP.lock ? CP.lock.card() : ''}
      ${CP.encBackup ? CP.encBackup.card() : ''}
      ${CP.health ? CP.health.card() : ''}

      <section class="card"><h3>Datu aizsardzība</h3>
        <p class="small">Dati glabājas tikai šajā datorā, vienkāršā JSON failā <b>bez šifrēšanas</b>. Aizsardzību nodrošina datora lietotāja konts un mapes tiesības — neglabā datu mapi publiski koplietotā vietā. Personas kodi saskarnē tiek maskēti, CSV eksportā netiek iekļauti, un saitēs uz ārējiem rīkiem netiek nodoti.</p>
        <p class="muted small">Cik ilgi dati tiek glabāti — kartītē <a href="#" data-act="retSettings">Datu glabāšanas termiņi</a>.</p></section>
      ${CP.retention ? CP.retention.settingsCard() : ''}

      </div>${T('docs')}
      <section class="card" id="docsCard"><h3>Dokumenti</h3><div class="fieldgrid">
        <div class="field wide"><label>Dokumentu kategorijas (ar komatu)</label><input data-set="docKinds" value="${esc(s.docKinds.join(', '))}"></div>
        <div class="field wide"><label>Obligātie dokumenti katrai personai (ar komatu)</label><input data-set="requiredDocs" value="${esc(s.requiredDocs.join(', '))}"></div>
        <div class="field wide"><label>Dokumenti, kuru oriģināli jānodod Centra arhīvam (ar komatu)</label><input data-set="archiveDocs" value="${esc((s.archiveDocs || ['Pieteikuma anketa', 'Līgums']).join(', '))}"></div>
        <div class="field wide"><label>Pasākumi — katra dalībnieka dokumenti visiem pasākumiem (ar komatu)</label><input data-set="evDocsAll" value="${esc((s.evDocsAll || []).join(', '))}"></div>
        <div class="field wide"><label>Nometnēs — katra dalībnieka papildu dokumenti</label><input data-set="evDocsCamp" value="${esc((s.evDocsCamp || []).join(', '))}"></div>
        <div class="field wide"><label>Pasākuma kopīgie dokumenti (visiem pasākumiem)</label><input data-set="evDocsEvent" value="${esc((s.evDocsEvent || []).join(', '))}"></div>
        <div class="field wide"><label>Nometnes kopīgie dokumenti</label><input data-set="evDocsEventCamp" value="${esc((s.evDocsEventCamp || []).join(', '))}"><div class="hint muted">Tos pievieno pasākuma lapā (Veidlapas). “Cits” dokumentu var pievienot vienmēr.</div></div>
        <div class="field wide"><label>Atgādināt, ja persona nav atzīmēta kā ievadīta / nodota</label><div class="actions">${CP.REGS.map(r => `<label class="check"><input type="checkbox" data-reg-set="${r.k}" ${(s.registries || []).includes(r.k) ? 'checked' : ''}> ${esc(r.l)}</label>`).join('')}</div></div></div></section>

      <section class="card"><h3>Anketu nolasīšana</h3><div class="fieldgrid">
        <div class="field"><label>Atpazīšanas dzinējs</label><select data-ocr="engine">
          <option value="tesseract" ${o.engine === 'tesseract' ? 'selected' : ''}>Lokāli datorā (drukāts teksts)</option>
          <option value="google" ${o.engine === 'google' ? 'selected' : ''}>Google Cloud Vision (arī rokraksts)</option></select></div>
        <div class="field"><label>Atpazīšanas ticamības atzīme (%)</label><input type="number" min="30" max="95" data-ocr="minConf" value="${esc(o.minConf)}"><div class="hint muted">Zonas teksts nonāk pārbaudes logā un kartītē tikai pēc apstiprinājuma.</div></div>
        ${o.engine === 'google' ? `<div class="field wide"><label>Google Cloud Vision API atslēga</label><input type="text" class="pw-mask" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" data-ocr="googleKey" value="${esc(o.googleKey)}" autocomplete="off">
          <div class="hint warn">Izvēloties šo dzinēju, anketas attēls (ar personas datiem) tiek nosūtīts Google serverim. Pirms lietošanas pārliecinies, ka organizācijai ir tiesisks pamats un līgums ar Google par datu apstrādi.</div></div>` : ''}
        <label class="check wide"><input type="checkbox" data-ocr="enhance" ${o.enhance ? 'checked' : ''}> Uzlabot attēlu pirms atpazīšanas (kontrasts, ēnu izlīdzināšana)</label></div>
        <h4>Dokumentu nolasīšanas veidnes</h4>
        <div class="actions" style="margin:8px 0">
          <button type="button" class="mainbtn sm" data-act="tplCreate">＋ Jauna veidne</button>
          <button type="button" class="sm" data-act="tplExport">Eksportēt JSON</button>
          <label class="btn sm">Importēt JSON<input id="tplImport" type="file" accept="application/json,.json" hidden></label>
        </div>
        ${s.formTemplates.length ? s.formTemplates.map(t => `<div class="row"><div class="grow"><b>${esc(t.name)}</b> <small class="muted">${t.zones.length} zonas</small>${s.activeTemplate === t.id ? ' <span class="tag">pēdējā lietotā</span>' : ''}</div><button class="sm" data-act="tplEdit" data-arg="${t.id}">Rediģēt</button><button class="sm" data-act="tplDup" data-arg="${t.id}">Dublēt</button><button class="sm ghost" data-act="tplDelete" data-arg="${t.id}">Dzēst</button></div>`).join('') : '<p class="muted small">Nav veidņu. Izveido pirmo: augšupielādē skenētas anketas paraugu un iezīmē zonas.</p>'}
        <p class="muted small">Bez veidnes lauki tiek atrasti automātiski pēc anketas etiķetēm (Word, eDoc un PDF ar tekstu — precīzi; skenējumi — ar izvēlēto dzinēju). Veidne glabā tikai zonu vietas lapas daļās, nevis dokumenta attēlu vai personas datus.</p></section>

      </div>${T('comms')}
      <section class="card" id="commsCard"><h3>Saziņa</h3><div class="fieldgrid">
        <div class="field"><label>Valsts kods 8 ciparu numuriem</label><input data-set="countryCode" value="${esc(s.countryCode)}"></div>
        <div class="field"><label>WhatsApp atvērt</label><select data-set="waMode"><option value="web" ${s.waMode === 'web' ? 'selected' : ''}>Caur wa.me (lietotne vai WhatsApp Web)</option><option value="app" ${s.waMode === 'app' ? 'selected' : ''}>Tieši WhatsApp Desktop lietotnē</option></select></div>
        <div class="field"><label>Signal atvērt</label><select data-set="sigMode"><option value="web" ${s.sigMode !== 'app' ? 'selected' : ''}>Caur signal.me (piedāvā atvērt lietotni)</option><option value="app" ${s.sigMode === 'app' ? 'selected' : ''}>Tieši Signal Desktop lietotnē</option></select><div class="hint muted">Signal neļauj saitē ielikt ziņas tekstu — rīks to nokopē, un tu ielīmē ar Ctrl+V.</div></div></div>
        <div class="fieldgrid" style="margin-top:10px"><div class="field"><label>Organizācija telefona kontaktos</label><input data-set="contactOrg" value="${esc(s.contactOrg || 'Jaunsardze')}"><div class="hint muted">Kontaktiem tiek pievienots “Uzņēmums” un grupa, lai tos telefonā var atrast.</div></div>
          <div class="field"><label>Google etiķete jaunsargiem</label><input data-set="labelYouth" value="${esc(s.labelYouth || 'Jaunsardze – jaunsargi')}"></div>
          <div class="field"><label>Google etiķete vecākiem</label><input data-set="labelParents" value="${esc(s.labelParents || 'Jaunsardze – vecāki')}"></div></div>
        <h4>Ziņu veidnes</h4>
        ${s.templates.map((t, i) => `<div class="tplrow"><input data-tpl="${i}:name" value="${esc(t.name)}"><textarea data-tpl="${i}:text" rows="3">${esc(t.text)}</textarea><button class="sm ghost" data-act="delTpl" data-arg="${i}" title="Dzēst">✕</button></div>`).join('')}
        <button class="sm" data-act="addTpl">＋ Jauna veidne</button>
        <p class="muted small">Vietturi: {saņēmējs} {vārds} {uzvārds} {pilns} {grupa} {vecāks} {datums} {trūkst} {ekipējums}</p></section>

      <section class="card"><h3>Ārējie rīki kartiņā</h3>
        <p class="muted small">Saites, kas parādās personas kartiņā. Saitē var izmantot {vārds} {uzvārds} {pilns} {tālrunis} {epasts} {grupa} {klase} {skola}. Personas kods un adrese netiek nodoti.</p>
        ${s.tools.map((t, i) => `<div class="inline-form"><input data-tool="${i}:name" value="${esc(t.name)}" placeholder="Nosaukums" style="max-width:180px"><input data-tool="${i}:url" value="${esc(t.url)}" placeholder="https://…"><button class="sm ghost" data-act="delTool" data-arg="${i}">✕</button></div>`).join('')}
        <button class="sm" data-act="addTool">＋ Pievienot rīku</button>
        <p class="muted small" style="margin-top:10px"><b>E-klase:</b> skolēnu personas datus var pārņemt ar e-klases eksporta palīgu: <b>⬆ Imports → No e-klases</b>. Tur ir soli pa solim instrukcija.</p></section>
      </div>${T('perm')}${CP.perms ? CP.perms.card() : ''}
      </div></div>`;
    }
  };

  CP.changeHandlers.push(e => {
    const t = e.target, d = t.dataset, s = S.db.settings;
    if (d.set) {
      if (d.set === 'autosave') s.autosave = t.checked;
      else if (['archiveDocs', 'evDocsAll', 'evDocsCamp', 'evDocsEvent', 'evDocsEventCamp'].includes(d.set)) s[d.set] = t.value.split(',').map(x => x.trim()).filter(Boolean);
      else if (d.set === 'docKinds' || d.set === 'requiredDocs') { s[d.set] = t.value.split(',').map(x => x.trim()).filter(Boolean); if (!s.docKinds.length) s.docKinds = CP.defaultSettings().docKinds; }
      else if (d.set === 'retentionDefault') s.retentionDefault = Number(t.value || 12);
      else s[d.set] = t.value.trim();
      CP.store.changed(); return true;
    }
    if (d.regSet) { const set = new Set(s.registries || []); t.checked ? set.add(d.regSet) : set.delete(d.regSet); s.registries = CP.REGS.map(r => r.k).filter(k => set.has(k)); CP.store.changed(); return true; }
    if (d.ocr) { s.ocr[d.ocr] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value.trim(); CP.store.changed(); return true; }
    if (d.tpl) { const [i, k] = d.tpl.split(':'); s.templates[i][k] = t.value; CP.store.changed({ silent: true }); return true; }
    if (d.tool) { const [i, k] = d.tool.split(':'); s.tools[i][k] = t.value.trim(); CP.store.changed({ silent: true }); return true; }
    if (t.id === 'tplImport') {
      const file = t.files?.[0]; t.value = '';
      if (file) file.text().then(txt => {
        let data; try { data = JSON.parse(txt); } catch { ui.toast('JSON nav nolasāms', 'err'); return; }
        const arr = Array.isArray(data) ? data : data?.formTemplates;
        if (!Array.isArray(arr)) { ui.toast('Failā nav veidņu saraksta', 'warn'); return; }
        const clean = arr.map(x => CP.scan.normalizeTemplate(x)).filter(Boolean);
        if (!clean.length) { ui.toast('Nav derīgu veidņu. Jānorāda nosaukums, lauks un zonas koordinātas no 0 līdz 1.', 'warn'); return; }
        const have = new Set(s.formTemplates.map(x => x.id));
        for (const tpl of clean) { if (have.has(tpl.id)) tpl.id = U.uid(); s.formTemplates.push(tpl); }
        CP.store.changed(); ui.toast(`Importētas ${clean.length} veidnes`, 'ok');
      }).catch(e => ui.toast(e.message, 'err'));
      return true;
    }
    return false;
  });
  A.addTpl = () => { S.db.settings.templates.push({ name: 'Jauna veidne', text: 'Labdien, {saņēmējs}!\n' }); CP.store.changed(); };
  A.delTpl = i => { const t = S.db.settings.templates; if (t.length < 2) return ui.toast('Jāpaliek vismaz vienai veidnei', 'warn'); if (confirm('Dzēst ziņas veidni “' + t[i].name + '”?')) { t.splice(Number(i), 1); S.comms.tpl = 0; CP.store.changed(); } };
  A.addTool = () => { S.db.settings.tools.push({ name: '', url: 'https://' }); CP.store.changed(); };
  A.delTool = i => { S.db.settings.tools.splice(Number(i), 1); CP.store.changed(); };
  A.tplCreate = () => CP.scan.openEditor();
  A.tplEdit = id => CP.scan.openEditor(id);
  A.tplDup = id => {
    const s = S.db.settings, t = s.formTemplates.find(x => x.id === id); if (!t) return;
    const copy = CP.scan.normalizeTemplate({ ...JSON.parse(JSON.stringify(t)), id: U.uid(), name: t.name + ' (kopija)', createdAt: U.now() });
    if (!copy) return ui.toast('Veidni neizdevās dublēt', 'warn');
    copy.zones.forEach(z => { z.id = U.uid(); });
    s.formTemplates.push(copy); CP.store.changed();
  };
  A.tplExport = () => {
    const data = S.db.settings.formTemplates.map(t => CP.scan.normalizeTemplate(t)).filter(Boolean);
    if (!data.length) return ui.toast('Nav veidņu, ko eksportēt', 'warn');
    U.download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'dokumentu-veidnes.json');
  };
  A.tplDelete = id => {
    const s = S.db.settings, t = s.formTemplates.find(x => x.id === id); if (!t || !confirm(`Dzēst veidni “${t.name}”?`)) return;
    s.formTemplates = s.formTemplates.filter(x => x.id !== id); if (s.activeTemplate === id) s.activeTemplate = ''; CP.store.changed();
  };
  CP.pages.settings.after = async () => {
    const box = U.$('backupList'), arch = U.$('archiveList'), src = U.$('sourceList');
    if (!box) return;
    if (!S.root) {
      box.innerHTML = '<p class="muted small">Izvēlies datu mapi, lai redzētu kopijas.</p>';
      if (arch) arch.innerHTML = '';
      if (src) src.innerHTML = '<p class="muted small">Papildu mapes tiek saglabātas kopā ar datu failu.</p>';
      return;
    }
    try {
      const list = await CP.store.listBackups();
      box.innerHTML = list.length ? list.map(b => `<div class="row"><div class="grow"><b>${esc(b.name)}</b><div class="small muted">${U.fmtDateTime(new Date(b.modified).toISOString())} · ${Math.ceil(b.size / 1024)} KB · JSON, bez dokumentu failiem</div></div><button class="sm" data-act="verifyBackup" data-arg="${esc(b.name)}">Pārbaudīt</button><button class="sm" data-act="restoreBackup" data-arg="${esc(b.name)}">Atjaunot</button></div>`).join('') : '<p class="muted small">Vēl nav kopiju. Pirmā automātiskā kopija parādās līdz ar dienas pirmo saglabāšanu.</p>';
    } catch (e) { box.innerHTML = `<p class="warn">Kopiju sarakstu neizdevās nolasīt: ${esc(e.message)}</p>`; }
    try {
      const list = await CP.store.listArchives();
      if (arch) arch.innerHTML = list.length ? list.map(a => {
        const m = a.manifest;
        const full = m?.pilns === true;
        const label = !m ? 'Manifests nav nolasāms' : full ? 'Pilns reģistrēto dokumentu arhīvs' : 'Daļējs arhīvs — nav visi dokumenti';
        const left = m?.navIeklauti?.length ? `<div class="small warn">Nav iekļauti: ${m.navIeklauti.slice(0, 6).map(f => esc(f.path) + (f.reason ? ' (' + esc(f.reason) + ')' : '')).join('; ')}${m.navIeklauti.length > 6 ? '…' : ''}</div>` : '';
        return `<div class="row"><div class="grow"><b>${esc(a.name)}</b><div class="small">${esc(label)}</div>${a.error ? `<div class="small warn">${esc(a.error)}</div>` : ''}${left}</div></div>`;
      }).join('') : '<p class="muted small">Vēl nav datu arhīvu.</p>';
    } catch (e) { if (arch) arch.innerHTML = `<p class="warn">Arhīvu sarakstu neizdevās nolasīt: ${esc(e.message)}</p>`; }
    if (src) {
      const rows = S.db.sources || [];
      src.innerHTML = rows.length ? rows.map(s => {
        const r = S.roots.find(x => x.id === s.id);
        const ok = !!r?.ok;
        return `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(s.id)}</div></div><span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'Pieslēgta' : 'Nav piekļuves'}</span><button class="sm" data-act="reconnectSource" data-arg="${esc(s.id)}">Pieslēgt atkārtoti</button></div>`;
      }).join('') : '<p class="muted small">Nav papildu mapju. Papildu mape ir cita mape datorā (piem., vecie skenējumi), no kuras rīks var rādīt un piesaistīt dokumentus — failus tā nemaina.</p>';
    }
  };
  A.backupNow = () => CP.store.backupNow();
  A.verifyBackup = async name => {
    try {
      const r = await CP.store.verifyBackup(name);
      ui.toast(r.ok ? `Kopija derīga: ${r.people} personas, ${r.documents} dokumenti, datu versija ${r.version}.` : 'Kopija nav derīga: ' + r.error, r.ok ? 'ok' : 'err', 9000);
    } catch (e) { ui.toast('Pārbaudi neizdevās: ' + e.message, 'err'); }
  };
  A.restoreBackup = name => CP.store.restoreBackup(name);
  A.makeArchive = async () => {
    const ext = S.db.documents.filter(d => d.path && d.sourceId && d.sourceId !== 'main' && !String(d.sourceId).startsWith('fails:'));
    let copyExternal = false;
    if (ext.length) copyExternal = confirm(`Reģistrēti ${ext.length} dokumenti ārējās mapēs.\n\nIekopēt arī tos? Bez piekrišanas tie paliks tikai sarakstā, un arhīvs netiks saukts par pilnu.`);
    try { await CP.store.createArchive({ copyExternal }); CP.render(); }
    catch (e) { ui.toast('Arhīvu neizdevās izveidot: ' + e.message, 'err', 12000); }
  };
  A.reconnectSource = id => CP.store.reconnectSource(id);
  A.pickRoot = () => CP.store.pickRoot();
  A.setTheme = v => { CP.theme.set(v); CP.render(); };
  A.watchTestBeep = () => CP.watchBeep?.(2);
  CP.changeHandlers.push(e => {
    const k = e.target.dataset?.watch; if (!k) return false;
    if (!e.target.isConnected) return true;
    const v = e.target.type === 'checkbox' ? e.target.checked : Math.max(Number(e.target.min) || 1, Math.min(Number(e.target.max) || 999, Number(e.target.value) || 0));
    if (CP.watchPrefs()[k] === v) return true;
    setTimeout(() => { CP.setWatchPref(k, v); CP.render(); }, 0);   // pēc notikuma — lai lapas pārzīmēšana netraucē fokusa notikumiem
    return true;
  });
  A.setAccent = v => { CP.theme.setAccent(v); CP.render(); };
  CP.inputHandlers.push(e => { if (e.target.id !== 'accentPick') return false; CP.theme.setAccent(e.target.value); return true; });   // dzīvs priekšskatījums
  CP.changeHandlers.push(e => { if (e.target.id !== 'accentPick') return false; CP.theme.setAccent(e.target.value); CP.render(); return true; });
  A.restoreRoot = () => CP.store.restoreRoot();
  A.retryRestore = () => CP.store.retryRestore();
  A.bootNew = () => CP.store.bootNew();
  A.createYear = () => CP.store.createYear();
  A.save = () => CP.store.save(false);
})(window.CP);
