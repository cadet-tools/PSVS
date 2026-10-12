/* =====================================================================
   Iestatījumi. Glabājas datu failā, tātad līdzi datu mapei.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, ui = CP.ui, A = CP.actions, esc = U.esc;

  CP.pages.settings = {
    render() {
      const s = S.db.settings, o = s.ocr;
      return `<div class="page narrow">${ui.pageHead('Iestatījumi', `CADET PERSONĀLS ${CP.VERSION} · datu shēma v${CP.SCHEMA}`, ui.saveBtn())}
      ${CP.D2 ? `<section class="card"><h3>${CP.ic('layout')}Izskats</h3><div class="actions"><span class="themepick" role="group" aria-label="Tēma">${[['dark', 'Tumšā'], ['light', 'Gaišā'], ['auto', 'Kā datorā']].map(([v, l]) => `<button type="button" data-act="setTheme" data-arg="${v}" class="${CP.theme.get() === v ? 'on' : ''}">${l}</button>`).join('')}</span><span class="small muted">Tēma tiek atcerēta šajā pārlūkā.</span></div></section>` : ''}
      <section class="card"><h3>Datu glabāšana</h3>
        ${ui.dl([['Datu mape', S.rootName || 'nav izvēlēta'], ['Datu fails', CP.DATAFILE], ['JSON kopijas', 'mape _rezerves, ar datumu un laiku (netiek dzēstas)'], ['Pēdējā saglabāšana', U.fmtDateTime(S.db.updatedAt) || '—']])}
        <div class="actions" style="margin-top:12px"><button data-act="pickRoot">📁 Mainīt datu mapi</button><button data-act="backupNow">Izveidot JSON kopiju</button><button data-act="backup">⬇ Lejupielādēt JSON</button><button data-act="exportCsv">⬇ Personas CSV</button><button data-act="createYear">Izveidot ${U.schoolYear()} mapes</button></div>
        ${ui.rootDrop()}
        ${CP.WEB ? `<div class="actions" style="margin-top:10px">${CP.installPrompt ? '<button data-act="installApp">⬇ Instalēt kā lietotni</button>' : ''}<span class="small muted">Tīmekļa versija · ${CP.CHANNEL === 'test' ? 'TESTA kanāls' : 'stabilā'} · dati tikai šajā datorā, uz serveri netiek sūtīti</span></div>` : ''}
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
        <div id="sourceList"></div></section>

      <section class="card"><h3>Mācību gadi</h3>
        <p class="small">Aktīvais gads: <b>${esc(U.yearLabel(S.db.settings.activeYear))}</b>. Gadu maiņa nepārvieto personas, dokumentus un ekipējumu. Viena persona ir viens profils, un katram gadam ir savs dalības ieraksts.</p>
        ${(S.db.years || []).map(y => `<div class="row"><div class="grow"><b>${esc(U.yearLabel(y.id))}</b> <small class="muted">${(S.db.enrollments || []).filter(e => e.yearId === y.id).length} dalības</small>${y.id === S.db.settings.activeYear ? ' <span class="tag">izvēlēts</span>' : ''}${y.id === U.schoolYear() ? ' <span class="tag">pašreizējais</span>' : ''}</div><button class="sm" data-act="setYear" data-arg="${esc(y.id)}">Atvērt</button></div>`).join('')}
        <div class="actions" style="margin-top:10px"><button class="mainbtn sm" data-act="openAddYear">＋ Pievienot mācību gadu</button><button class="sm" data-act="openMove">Pārcelt personas</button><button class="sm" data-act="ensureFolders">Izveidot gada mapes</button></div>
        <p class="muted small">Mapē Macibu_gadi katram gadam ir Dokumenti, Pasakumi un Atskaites. Esošie personu dokumenti netiek pārvietoti.</p></section>

      <section class="card"><h3>Datu aizsardzība</h3>
        <p class="small">Dati glabājas tikai šajā datorā, vienkāršā JSON failā <b>bez šifrēšanas</b>. Aizsardzību nodrošina datora lietotāja konts un mapes tiesības — neglabā datu mapi publiski koplietotā vietā. Personas kodi saskarnē tiek maskēti, CSV eksportā netiek iekļauti, un saitēs uz ārējiem rīkiem netiek nodoti.</p>
        <div class="fieldgrid"><div class="field"><label>Noklusētais glabāšanas termiņš pēc izstāšanās (mēn.)</label><input type="number" min="0" max="1200" data-set="retentionDefault" value="${esc(s.retentionDefault)}"></div></div>
        <p class="muted small">Pēc termiņa beigām sistēma atgādina pārskatīt datus. Dzēšana notiek tikai manuāli (kartiņā → ⋯ → Dzēst neatgriezeniski).</p></section>

      <section class="card"><h3>Dokumenti</h3><div class="fieldgrid">
        <div class="field wide"><label>Dokumentu kategorijas (ar komatu)</label><input data-set="docKinds" value="${esc(s.docKinds.join(', '))}"></div>
        <div class="field wide"><label>Obligātie dokumenti katrai personai (ar komatu)</label><input data-set="requiredDocs" value="${esc(s.requiredDocs.join(', '))}"></div></div></section>

      <section class="card"><h3>Anketu nolasīšana</h3><div class="fieldgrid">
        <div class="field"><label>Atpazīšanas dzinējs</label><select data-ocr="engine">
          <option value="tesseract" ${o.engine === 'tesseract' ? 'selected' : ''}>Lokāli datorā (drukāts teksts)</option>
          <option value="google" ${o.engine === 'google' ? 'selected' : ''}>Google Cloud Vision (arī rokraksts)</option></select></div>
        <div class="field"><label>Atpazīšanas ticamības atzīme (%)</label><input type="number" min="30" max="95" data-ocr="minConf" value="${esc(o.minConf)}"><div class="hint muted">Zonas teksts nonāk pārbaudes logā un kartītē tikai pēc apstiprinājuma.</div></div>
        ${o.engine === 'google' ? `<div class="field wide"><label>Google Cloud Vision API atslēga</label><input type="password" data-ocr="googleKey" value="${esc(o.googleKey)}" autocomplete="off">
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

      <section class="card"><h3>Saziņa</h3><div class="fieldgrid">
        <div class="field"><label>Valsts kods 8 ciparu numuriem</label><input data-set="countryCode" value="${esc(s.countryCode)}"></div>
        <div class="field"><label>WhatsApp atvērt</label><select data-set="waMode"><option value="web" ${s.waMode === 'web' ? 'selected' : ''}>Caur wa.me (lietotne vai WhatsApp Web)</option><option value="app" ${s.waMode === 'app' ? 'selected' : ''}>Tieši WhatsApp Desktop lietotnē</option></select></div></div>
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
        <p class="muted small" style="margin-top:10px"><b>E-klase:</b> tai nav publiskas saskarnes, ko var izmantot no lokālas programmas. Kartiņā ir saite uz e-klasi; skolēnu sarakstus var importēt no e-klases Excel eksporta (⬆ Imports) un eksportēt atpakaļ CSV.</p></section></div>`;
    }
  };

  CP.changeHandlers.push(e => {
    const t = e.target, d = t.dataset, s = S.db.settings;
    if (d.set) {
      if (d.set === 'autosave') s.autosave = t.checked;
      else if (d.set === 'docKinds' || d.set === 'requiredDocs') { s[d.set] = t.value.split(',').map(x => x.trim()).filter(Boolean); if (!s.docKinds.length) s.docKinds = CP.defaultSettings().docKinds; }
      else if (d.set === 'retentionDefault') s.retentionDefault = Number(t.value || 12);
      else s[d.set] = t.value.trim();
      CP.store.changed(); return true;
    }
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
      }).join('') : '<p class="muted small">Nav papildu mapju. Dokumentos spied “Papildu mape”.</p>';
    }
  };
  A.backupNow = () => CP.store.backupNow();
  A.verifyBackup = async name => {
    try {
      const r = await CP.store.verifyBackup(name);
      ui.toast(r.ok ? `Kopija derīga: ${r.people} personas, ${r.documents} dokumenti, shēma v${r.version}.` : 'Kopija nav derīga: ' + r.error, r.ok ? 'ok' : 'err', 9000);
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
  A.restoreRoot = () => CP.store.restoreRoot();
  A.retryRestore = () => CP.store.retryRestore();
  A.bootNew = () => CP.store.bootNew();
  A.createYear = () => CP.store.createYear();
  A.save = () => CP.store.save(false);
})(window.CP);
