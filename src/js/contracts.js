/* =====================================================================
   Līgums par dalību Jaunsardzē — automātiska aizpildīšana no personas kartītes.
   4 standarta veidnes (jaunietis 18+ / likumiskais pārstāvis × papīrs / EDOC)
   vai lietotāja Word veidne ar {atzīmēm}. Rezultāts — rediģējams Word fails
   (kopija personas mapē) + priekšskatījums un drukāšana rīkā.
   Līguma numuru piešķir cita sistēma — to ieraksta lietotājs.
   Instruktora dati glabājas settings.instructor, līdz instruktors tos maina.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const MONTHS_LOC = ['janvārī', 'februārī', 'martā', 'aprīlī', 'maijā', 'jūnijā', 'jūlijā', 'augustā', 'septembrī', 'oktobrī', 'novembrī', 'decembrī'];
  const STD = { 'jaunietis-papirs': 'Jaunietis 18+, papīra forma', 'parstavis-papirs': 'Likumiskais pārstāvis, papīra forma', 'jaunietis-edoc': 'Jaunietis 18+, EDOC', 'parstavis-edoc': 'Likumiskais pārstāvis, EDOC' };
  const FIELDS_HELP = [
    ['{liguma_nr}', 'līguma numurs'], ['{liguma_datums}', 'piem. 2026.gada 15.oktobrī'], ['{vieta}', 'līguma vieta'],
    ['{i_parvalde} {i_nodala}', 'novada pārvaldes un nodaļas nr.'], ['{i_vards_gen}', 'instruktora vārds ģenitīvā (Jāņa Egļa)'], ['{i_vards} {i_amats} {i_talrunis} {i_epasts}', 'instruktora dati'], ['{i_paraksta_datums}', 'piem. 2026. gada 15. oktobrī'],
    ['{j_vards} {j_statuss_vards} {j_vards_pk}', 'jaunietis'], ['{j_pk1} … {j_pk11}', 'jaunieša personas koda cipari pa vienam'], ['{j_dzimsanas_datums}', 'bērna / jaunieša dzimšanas datums, dd.mm.gggg'], ['{j_personas_kods} {j_adrese_dekl} {j_adrese_fakt} {j_talrunis} {j_epasts}', 'jaunieša dati'],
    ['{p_vards} {p_statuss_vards} {p_vards_pk} {p_pk1} … {p_pk11}', 'likumiskais pārstāvis'], ['{p_personas_kods} {p_adrese_dekl} {p_adrese_fakt} {p_talrunis} {p_epasts}', 'pārstāvja dati']
  ];
  CP.CONTRACT_FIELDS_HELP = FIELDS_HELP;
  const inst = () => (S.db.settings.instructor = S.db.settings.instructor || { parvalde: '', nodala: '', name: '', nameGen: '', position: 'Jaunsargu instruktors', phone: '', email: '', place: '' });

  /** Vārda ģenitīva ieteikums (Jānis Eglis → Jāņa Egļa). Tikai ieteikums — lietotājs var labot. */
  function genitive(full) {
    return String(full || '').trim().split(/\s+/).map(w => {
      const l = w.toLowerCase();
      if (/nis$/.test(l)) return w.slice(0, -3) + 'ņa';
      if (/lis$/.test(l)) return w.slice(0, -3) + 'ļa';
      if (/[vpbm]is$/.test(l)) return w.slice(0, -2) + 'ja';
      if (/sis$/.test(l) || /tis$/.test(l)) return w.slice(0, -3) + 'ša';
      if (/zis$/.test(l) || /dis$/.test(l)) return w.slice(0, -3) + 'ža';
      if (/cis$/.test(l)) return w.slice(0, -3) + 'ča';
      if (/is$/.test(l)) return w.slice(0, -2) + 'a';
      if (/us$/.test(l)) return w + 'a';
      if (/[sš]$/.test(l)) return w.slice(0, -1) + 'a';
      if (/[ae]$/.test(l)) return w + 's';
      return w;
    }).join(' ');
  }
  const dateLv = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[1]}.gada ${+m[3]}.${MONTHS_LOC[m[2] - 1]}` : ''; };
  const phone = n => n ? (U.prettyPhone ? U.prettyPhone(n) : n) : '';
  const STATUS_WORD = { candidate: 'jaunsarga kandidāts', active: 'jaunsargs', paused: 'jaunsargs' };
  const relWord = r => String(r || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('lv');

  /** Pārstāvja statuss: māte / tēvs / likumiskais pārstāvis / cits (jāizvēlas, nav noklusējuma) */
  const REL = [['māte', 'Māte'], ['tēvs', 'Tēvs'], ['likumiskais pārstāvis', 'Likumiskais pārstāvis'], ['cits', 'Cits — norādīt pats']];
  function relPick(rel) {
    const r = relWord(rel); if (!r) return { p_rel: '', p_rel_other: '' };
    if (/^m[aā]te|^mamma/.test(r)) return { p_rel: 'māte', p_rel_other: '' };
    if (/^t[eē]vs|^t[eē]tis/.test(r)) return { p_rel: 'tēvs', p_rel_other: '' };
    if (/likumisk/.test(r)) return { p_rel: 'likumiskais pārstāvis', p_rel_other: '' };
    return { p_rel: 'cits', p_rel_other: r };
  }
  const relText = f => f.p_rel === 'cits' ? (f.p_rel_other || '').trim() : (f.p_rel || '');
  const dateLvSp = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[1]}. gada ${+m[3]}. ${MONTHS_LOC[m[2] - 1]}` : ''; };

  const findC = arg => { const [pid, cid] = String(arg).split('|'), p = D.person(pid); return { p, c: (p?.contracts || []).find(x => x.id === cid) }; };
  /* --- Dialogs --- */
  let cur = null;   // { pid, kind, form, tpl, parent, no, date, place, fields:{} }
  function personData(p, parentIdx) {
    const two = parentIdx === 2;
    const pn = two ? p.parent2Name : p.parentName, rel = two ? p.parent2Relation : p.parentRelation;
    return {
      j_vards: U.full(p), j_status: STATUS_WORD[D.partStatus(p)] || 'jaunsargs', j_pk: p.personalCode || '', j_dzimsanas: p.birth ? String(p.birth).slice(0, 10) : (U.pkDate(p.personalCode).kind === 'old' ? U.pkDate(p.personalCode).birth : ''),
      j_adrese_dekl: p.addressDeclared || '', j_adrese_fakt: p.addressActual && U.norm(p.addressActual) !== U.norm(p.addressDeclared || '') ? p.addressActual : '',
      j_talrunis: phone(p.phone), j_epasts: p.email || '',
      p_vards: pn || '', ...relPick(rel), p_pk: two ? '' : (p.parentCode || ''),
      p_adrese_dekl: (two ? '' : p.parentAddressDeclared) || '', p_adrese_fakt: (two ? '' : p.parentAddressActual) || '',
      p_talrunis: phone(two ? p.parent2Phone : p.parentPhone), p_epasts: (two ? p.parent2Email : p.parentEmail) || ''
    };
  }
  A.contractNew = arg => {
    const [pid, want] = String(arg || '').split('|'), p = pid && D.person(pid);
    const age = p ? U.age(p.birth) : null;
    cur = { pid: p ? p.id : '', kind: want === 'jaunietis' ? 'jaunietis' : age != null && age < 18 ? 'parstavis' : (age == null ? 'parstavis' : 'jaunietis'), form: S.db.settings.contractForm || 'papirs', tpl: '',
      parent: 1, no: p?.contractNo || '', date: U.iso(), place: inst().place || '', signMode: inst().signMode || 'same', signDate: '', fields: p ? personData(p, 1) : {} };
    openDlg();
  };
  const PARAMS = ['kind', 'form', 'tpl', 'parent', 'no', 'date', 'place', 'signMode', 'signDate'];
  const snapshot = () => ({ ...Object.fromEntries(PARAMS.map(k => [k, cur[k]])), fields: { ...cur.fields } });
  function openDlg() {
    const ed = !!cur.editId;
    U.$('contractTitle').textContent = ed ? 'Labot līgumu' : 'Līgums par dalību Jaunsardzē';
    U.$('contractWordBtn').textContent = ed ? 'Saglabāt izmaiņas (jauna versija)' : 'Sagatavot Word failu';
    renderDialog(); U.$('contractDialog').showModal();
  }
  /** Labot: atver logu ar iepriekš ievadītajiem datiem; saglabājot rodas jauna versija (vecais fails netiek pārrakstīts) */
  A.contractEdit = arg => {
    const { p, c } = findC(arg); if (!c) return;
    const base = personData(p, c.params?.parent || 1);
    cur = { pid: p.id, kind: c.kind, form: c.form, tpl: '', parent: 1, no: c.no || p.contractNo || '', date: c.date || U.iso(), place: inst().place || '', signMode: inst().signMode || 'same', signDate: '',
      ...(c.params || {}), fields: { ...base, ...(c.params?.fields || {}) }, editId: c.id };
    if (U.$('printDialog').open) U.$('printDialog').close();
    openDlg();
  };
  /** Ielādēt Word programmā labotu līgumu kā jaunu versiju */
  let upTarget = null;
  A.contractUpload = arg => { if (!S.root) return ui.toast('Vispirms pieslēdz datu mapi', 'warn'); upTarget = arg; U.$('ctUpload').click(); };
  U.$('ctUpload').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !upTarget) return;
    if (!/\.docx$/i.test(f.name)) return ui.toast('Ielādē Word .docx failu', 'warn');
    const { p, c } = findC(upTarget); if (!c) return;
    try {
      const base = (c.path ? c.path.split('/').pop() : `Līgums ${U.full(p)}.docx`).replace(/( \(labots [^)]*\))*(\s\(\d+\))?\.docx$/i, '');
      const path = await CP.store.saveFile(CP.store.yearPersonDir(p), `${base} (labots ${U.fmtDate(U.iso())}).docx`, f);
      newVersion(c, path, 'ielādēts labots fails');
      D.audit(p.id, 'update', ['Ielādēts labots līgums' + (c.no ? ' Nr. ' + c.no : '')]);
      CP.store.changed(); ui.toast('Labotais līgums saglabāts kā jauna versija. Iepriekšējā versija paliek mapē.', 'ok', 7000);
    } catch (err) { ui.toast('Neizdevās saglabāt: ' + err.message, 'err', 9000); }
  });
  function newVersion(c, path, how) {
    (c.versions = c.versions || []).push({ path: c.path, at: c.editedAt || c.at });
    c.path = path; c.editedAt = U.now(); c.editHow = how;
  }
  function renderDialog() {
    const c = cur, p = D.person(c.pid), I = inst(), age = p ? U.age(p.birth) : null, f = c.fields;
    const own = (S.db.settings.docTemplates || []).filter(t => t.type === 'contract');
    const opt = (v, l, curV) => `<option value="${esc(v)}" ${v === curV ? 'selected' : ''}>${esc(l)}</option>`;
    const people = D.peopleInYear().filter(x => x.status !== 'archived').sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    const inp = (k, label, val, extra = '') => `<div class="field ${extra}"><label>${label}</label><input data-ct="${k}" value="${esc(val ?? '')}"></div>`;
    const CAPS = { name: 'words', nameGen: 'words', position: 'first', place: 'first' };
    const iinp = (k, label, ph = '', extra = '') => `<div class="field ${extra}"><label>${label}</label><input data-ci="${k}" value="${esc(I[k] ?? '')}" placeholder="${esc(ph)}" ${CAPS[k] ? `data-cap="${CAPS[k]}"` : ''}></div>`;
    const warn = [];
    if (p && !f.j_pk) warn.push('jaunietim nav personas koda');
    if (p && !bIso(f.j_dzimsanas)) {
      const k = U.pkDate(f.j_pk).kind;
      warn.push(k === 'new' ? 'jaunajā personas kodā nav dzimšanas datuma — norādi to kalendārā' : k === 'bad' ? 'personas koda pirmā daļa nav dzimšanas datums — norādi datumu kalendārā' : 'nav dzimšanas datuma');
    }
    if (c.kind === 'parstavis' && !f.p_vards) warn.push('nav norādīts likumiskais pārstāvis');
    if (c.kind === 'parstavis' && !f.p_pk) warn.push('nav pārstāvja personas koda');
    if (c.kind === 'parstavis' && p && !relText(f)) warn.push('izvēlies pārstāvja statusu (māte, tēvs, likumiskais pārstāvis vai cits)');
    if (!c.no) warn.push('nav ievadīts līguma numurs (vietā paliks tukša līnija)');
    { const bad = CP.setup?.instProblems?.(I) || (!I.name || !I.parvalde || !I.nodala ? { x: 1 } : {}); if (Object.keys(bad).length) warn.push('aizpildi instruktora darba datus' + (bad.email && I.email ? ' (e-pastam jābūt …@jc.gov.lv)' : '')); }
    U.$('contractBody').innerHTML = `
      <div class="fieldgrid">
        <div class="field wide"><label>Persona</label><select id="ctPerson" ${c.editId ? "disabled title=\"Labojot personu mainīt nevar\"" : ""}><option value="">— izvēlies —</option>${people.map(x => opt(x.id, `${U.sortName(x)}${D.groupOf(x) ? ' · ' + D.groupOf(x) : ''}`, c.pid)).join('')}</select>
          ${p ? `<small class="muted">${age != null ? `${age} g.` : 'dzimšanas datums nav zināms'} — ${age != null && age >= 18 ? 'pilngadīgs: līgums ar jaunieti' : 'nepilngadīgs: līgums ar likumisko pārstāvi'}</small>` : ''}</div>
        <div class="field"><label>Līguma veids</label><select data-cc="kind">${opt('parstavis', 'Ar likumisko pārstāvi (līdz 18 g.)', c.kind)}${opt('jaunietis', 'Ar jaunieti (no 18 g.)', c.kind)}</select></div>
        <div class="field"><label>Forma</label><select data-cc="form">${opt('papirs', 'Papīra forma (parakstīt ar roku)', c.form)}${opt('edoc', 'EDOC (e-paraksts)', c.form)}</select></div>
        <div class="field"><label>Veidne</label><select data-cc="tpl">${opt('', 'Standarta veidne', c.tpl)}${own.map(t => opt(t.id, 'Mana: ' + t.name, c.tpl)).join('')}</select></div>
        <div class="field"><label>Līguma Nr. <small class="muted">(no citas sistēmas)</small></label><input data-cc="no" value="${esc(c.no)}" placeholder="piem. 124/JS-2026/8"></div>
        <div class="field"><label>Datums</label><input type="date" data-cc="date" value="${esc(c.date)}"></div>
        <div class="field"><label>Vieta</label><input data-cc="place" data-cap="first" value="${esc(c.place)}" placeholder="piem. Rīga"></div>
        ${c.form === 'papirs' ? `<div class="field"><label>Instruktora paraksta datums</label><select data-cc="signMode">${opt('same', 'Tāds pats kā līguma datums', c.signMode)}${opt('custom', 'Cits datums…', c.signMode)}${opt('blank', 'Tukšs — rakstīšu ar roku', c.signMode)}</select>${c.signMode === 'custom' ? `<input type="date" data-cc="signDate" value="${esc(c.signDate || c.date)}" style="margin-top:6px">` : ''}</div>` : ''}
        ${c.kind === 'parstavis' && p && p.parent2Name ? `<div class="field wide"><label>Likumiskais pārstāvis</label><div class="actions"><label class="check"><input type="radio" name="ctParent" data-cc="parent" value="1" ${c.parent === 1 ? 'checked' : ''}> ${esc(p.parentName || '1. pārstāvis')}</label><label class="check"><input type="radio" name="ctParent" data-cc="parent" value="2" ${c.parent === 2 ? 'checked' : ''}> ${esc(p.parent2Name)}</label></div></div>` : ''}
      </div>
      ${warn.length ? `<div class="notice">⚠ ${esc(warn.join('; '))}.</div>` : ''}
      ${p ? `<details class="ct-box" open><summary><b>Dati līgumā</b> <small class="muted">— no kartītes; šeit labotais attiecas tikai uz šo līgumu</small></summary><div class="fieldgrid">
        ${inp('j_status', 'Jaunieša statuss', f.j_status)}${inp('j_vards', 'Jaunieša vārds, uzvārds', f.j_vards)}${inp('j_pk', 'Jaunieša personas kods', f.j_pk)}<div class="field"><label>Dzimšanas datums</label><input type="date" data-ct="j_dzimsanas" value="${esc(bIso(f.j_dzimsanas))}"></div>${pkBirthNote(f.j_pk, bIso(f.j_dzimsanas)) ? `<div class="field wide" id="ctPkBirthWrap"><div class="notice">${esc(pkBirthNote(f.j_pk, bIso(f.j_dzimsanas)))}</div></div>` : ''}
        ${inp('j_talrunis', 'Jaunieša tālrunis', f.j_talrunis)}${inp('j_epasts', 'Jaunieša e-pasts', f.j_epasts)}
        ${c.kind === 'jaunietis' ? `${inp('j_adrese_dekl', 'Deklarētā adrese', f.j_adrese_dekl, 'wide')}${inp('j_adrese_fakt', 'Faktiskā adrese (ja atšķiras)', f.j_adrese_fakt, 'wide')}` : `
        <div class="field"><label>Pārstāvja statuss <b class="red">*</b></label><select data-ct="p_rel" class="${f.p_rel ? '' : 'need'}"><option value="">— izvēlies —</option>${REL.map(([v, l]) => `<option value="${v}" ${f.p_rel === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${f.p_rel === 'cits' ? `<div class="field"><label>Statuss (ieraksti) <b class="red">*</b></label><input data-ct="p_rel_other" value="${esc(f.p_rel_other || '')}" list="dl_ctrel" placeholder="piem. aizbildnis, vecmāmiņa"><datalist id="dl_ctrel">${(S.db.settings.contractRelations || []).map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>` : ''}${inp('p_vards', 'Pārstāvja vārds, uzvārds', f.p_vards)}${inp('p_pk', 'Pārstāvja personas kods', f.p_pk)}
        ${inp('p_talrunis', 'Pārstāvja tālrunis', f.p_talrunis)}${inp('p_epasts', 'Pārstāvja e-pasts', f.p_epasts)}
        ${inp('p_adrese_dekl', 'Pārstāvja deklarētā adrese', f.p_adrese_dekl, 'wide')}${inp('p_adrese_fakt', 'Pārstāvja faktiskā adrese (ja atšķiras)', f.p_adrese_fakt, 'wide')}`}
      </div></details>` : ''}
      <details class="ct-box" ${!I.name ? 'open' : ''}><summary><b>Instruktora dati</b> <small class="muted">— saglabājas nākamajiem līgumiem</small></summary><div class="fieldgrid">
        ${iinp('parvalde', 'Novada pārvaldes nr.', 'piem. 3')}${iinp('nodala', 'Nodaļas nr.', 'piem. 1')}
        ${iinp('name', 'Vārds, uzvārds', 'Jānis Paraugs')}<div class="field"><label>Vārds ģenitīvā <small class="muted">(“…instruktora <i>Jāņa Parauga</i> personā”)</small></label><input data-ci="nameGen" data-cap="words" value="${esc(I.nameGen || genitive(I.name))}"></div>
        ${iinp('position', 'Amats', 'Jaunsargu instruktors')}${iinp('place', 'Vieta pēc noklusējuma', 'piem. Rīga')}${iinp('phone', 'Tālrunis')}${iinp('email', 'E-pasts', 'vards.uzvards@jc.gov.lv')}
      </div></details>`;
  }
  const ctDlg = () => U.$('contractDialog');
  const bIso = v => /^\d{4}-\d{2}-\d{2}/.test(v || '') ? String(v).slice(0, 10) : (U.parseDate(v) || '');
  function pkBirthNote(pk, birth) {
    const info = U.pkDate(pk);
    if (info.kind === 'new') return birth ? 'Jaunais personas kods — dzimšanas datums nav kodā.' : U.PK_BIRTH_MSG.new;
    if (info.kind === 'bad' && !birth) return U.PK_BIRTH_MSG.bad;
    return '';
  }
  function ctPkNote() {
    const note = cur ? pkBirthNote(cur.fields.j_pk, bIso(cur.fields.j_dzimsanas)) : '';
    let wrap = U.$('ctPkBirthWrap');
    if (!note) { wrap?.remove(); return; }
    if (!wrap) {
      const birth = ctDlg()?.querySelector('[data-ct="j_dzimsanas"]')?.closest('.field');
      if (!birth) return;
      wrap = document.createElement('div'); wrap.id = 'ctPkBirthWrap'; wrap.className = 'field wide';
      wrap.innerHTML = '<div class="notice"></div>';
      birth.insertAdjacentElement('afterend', wrap);
    }
    wrap.querySelector('.notice').textContent = note;
  }
  function ctPk(t, open) {
    if (!cur) return;
    const info = U.pkDate(t.value);
    if (info.kind === 'old' && !bIso(cur.fields.j_dzimsanas)) {
      cur.fields.j_dzimsanas = info.birth;
      const b = ctDlg().querySelector('[data-ct="j_dzimsanas"]');
      if (b && !b.value) b.value = info.birth;
    }
    ctPkNote();
    if (open && (info.kind === 'new' || info.kind === 'bad') && U.codeDigits(t.value).length >= 6 && !bIso(cur.fields.j_dzimsanas) && t.dataset.pkTold !== info.kind) {
      t.dataset.pkTold = info.kind;
      ui.toast(U.PK_BIRTH_MSG[info.kind], 'warn', 9000);
      const b = ctDlg().querySelector('[data-ct="j_dzimsanas"]');
      if (b) { b.focus(); try { b.showPicker(); } catch (e) { /* kalendārs */ } }
    }
    if (info.kind !== 'new' && info.kind !== 'bad') delete t.dataset.pkTold;
  }
  document.addEventListener('change', e => {
    const t = e.target; if (!ctDlg()?.contains(t) || !cur) return;
    if (t.dataset.ct) {
      cur.fields[t.dataset.ct] = t.value;
      if (t.dataset.ct === 'j_pk') ctPk(t, true);
      if (t.dataset.ct === 'j_dzimsanas') ctPkNote();
    }
    if (t.id === 'ctPerson') { const p = D.person(t.value); cur.pid = t.value; if (p) { const age = U.age(p.birth); cur.kind = age != null && age >= 18 ? 'jaunietis' : 'parstavis'; cur.no = p.contractNo || cur.no; cur.parent = 1; cur.fields = personData(p, 1); } renderDialog(); return; }
    const k = t.dataset.cc;
    if (k) {
      if (k === 'parent') { cur.parent = Number(t.value); const p = D.person(cur.pid); if (p) Object.assign(cur.fields, Object.fromEntries(Object.entries(personData(p, cur.parent)).filter(([x]) => x.startsWith('p_')))); }
      else cur[k] = t.value;
      if (k === 'kind' || k === 'parent' || k === 'form' || k === 'signMode') renderDialog();
      return;
    }
    if (t.dataset.ci) {
      const I = inst(); I[t.dataset.ci] = t.dataset.ci === 'email' ? t.value.trim().toLowerCase() : t.value.trim();
      if (t.dataset.ci === 'email' && I.email && !/^[^\s@]+@jc\.gov\.lv$/i.test(I.email)) ui.toast('Darba e-pastam jābeidzas ar @jc.gov.lv (piem., vards.uzvards@jc.gov.lv). Privātu e-pastu līgumā neliek.', 'warn', 9000);
      if (t.dataset.ci === 'name') { I.nameGen = genitive(I.name); const g = ctDlg().querySelector('[data-ci="nameGen"]'); if (g) g.value = I.nameGen; }
      CP.store.changed({ silent: true }); return;
    }
  });
  document.addEventListener('input', e => {
    const t = e.target; if (!ctDlg()?.contains(t) || !cur) return;
    if (t.dataset.ct) {
      cur.fields[t.dataset.ct] = t.value;
      if (t.dataset.ct === 'j_pk') ctPk(t, U.codeDigits(t.value).length >= 11);
      if (t.dataset.ct === 'j_dzimsanas') ctPkNote();
      if (t.dataset.ct === 'p_rel') renderDialog();
    }
    if (t.dataset.cc && t.dataset.cc !== 'parent') cur[t.dataset.cc] = t.value;
    if (t.dataset.ci) { inst()[t.dataset.ci] = t.value.trim(); CP.store.changed({ silent: true }); }
  });

  /* --- Aizpildīšana --- */
  function fillData() {
    const c = cur, f = c.fields, I = inst(), L = s => s || '';
    const digits = (pk, pre) => { const d = U.codeDigits(pk || ''); const o = {}; for (let i = 0; i < 11; i++) o[`${pre}_pk${i + 1}`] = d.length === 11 ? d[i] : ''; return o; };
    const line = (v, n = 25) => v ? v : '_'.repeat(n);
    const pkFmt = pk => U.codeDigits(pk || '').length === 11 ? U.fmtCode(pk) : (pk || '');
    const g = {
      liguma_nr: line(c.no, 18), liguma_datums: c.date ? dateLv(c.date) : '20___.gada ___.___________', vieta: line(c.place, 12),
      i_parvalde: line(I.parvalde, 4), i_nodala: line(I.nodala, 3), i_vards_gen: line(I.nameGen || genitive(I.name), 30), i_vards: L(I.name), i_amats: L(I.position),
      i_talrunis: line(phone(I.phone), 25), i_epasts: line(I.email, 26),
      j_vards: L(f.j_vards), j_statuss_vards: [f.j_status, f.j_vards].filter(Boolean).join(' '), j_personas_kods: pkFmt(f.j_pk), j_vards_pk: [f.j_vards, pkFmt(f.j_pk)].filter(Boolean).join(', '),
      j_dzimsanas_datums: bIso(f.j_dzimsanas) ? U.fmtDate(bIso(f.j_dzimsanas)) : '____________________',
      j_adrese_dekl: L(f.j_adrese_dekl), j_adrese_fakt: L(f.j_adrese_fakt), j_talrunis: line(f.j_talrunis, c.kind === 'parstavis' ? 15 : 25), j_epasts: line(f.j_epasts, c.kind === 'parstavis' ? 21 : 26),
      p_vards: L(f.p_vards), p_statuss_vards: [relText(f), f.p_vards].filter(Boolean).join(' '), p_statuss: relText(f), p_personas_kods: pkFmt(f.p_pk), p_vards_pk: [f.p_vards, pkFmt(f.p_pk)].filter(Boolean).join(', '),
      p_adrese_dekl: L(f.p_adrese_dekl), p_adrese_fakt: L(f.p_adrese_fakt), p_talrunis: line(f.p_talrunis, 25), p_epasts: line(f.p_epasts, 26),
      i_paraksta_datums: c.signMode === 'blank' ? '_____.\u00a0gada ____.\u00a0________________' : dateLvSp(c.signMode === 'custom' ? (c.signDate || c.date) : c.date) || '_____.\u00a0gada ____.\u00a0________________',
      ...digits(f.j_pk, 'j'), ...digits(f.p_pk, 'p')
    };
    return { global: g, rows: [], staff: [], blankRows: 0, staffBlank: 0 };
  }
  async function templateBuf() {
    if (cur.tpl) {
      const t = (S.db.settings.docTemplates || []).find(x => x.id === cur.tpl); if (!t) throw Error('veidne nav atrasta');
      const h = await CP.store.handleFor(t.path, 'main'); if (!h) throw Error('veidnes fails mapē Veidnes nav atrasts');
      return (await h.getFile()).arrayBuffer();
    }
    const r = await fetch(CP.VENDOR + `templates/ligums-${cur.kind}-${cur.form}.docx?v=${CP.VERSION}`, { cache: "no-cache" }); if (!r.ok) throw Error('standarta veidne nav ielādējama (' + r.status + ')');
    return r.arrayBuffer();
  }
  /** Pirms sagatavošanas: obligātais pārstāvja statuss, jautājums par trūkstošu līguma numuru */
  function ready() {
    if (!cur?.pid) { ui.toast('Izvēlies personu', 'warn'); return false; }
    if (cur.kind === 'parstavis' && !relText(cur.fields)) { ui.toast('Izvēlies likumiskā pārstāvja statusu: māte, tēvs, likumiskais pārstāvis vai cits.', 'warn', 8000); ctDlg().querySelector('[data-ct="p_rel"],[data-ct="p_rel_other"]')?.focus(); return false; }
    if (!String(cur.no || '').trim() && !confirm('Līguma numurs nav ievadīts.\n\nLīgumā numura vietā paliks tukša līnija, ko varēs aizpildīt vēlāk.\n\nVai turpināt bez līguma numura?')) { ctDlg().querySelector('[data-cc="no"]')?.focus(); return false; }
    return true;
  }
  async function build() {
    if (!cur?.pid) throw Error('izvēlies personu');
    return CP.docxFill.fill(await templateBuf(), fillData());
  }
  const fileName = () => { const p = D.person(cur.pid); return `Līgums ${cur.no ? cur.no.replace(/[\\/:*?"<>|]/g, '_') + ' ' : ''}${U.full(p)} ${cur.date || U.iso()}.docx`.replace(/\s+/g, ' '); };
  /** Saglabā atkārtoti noderīgo: formu, vietu, paraksta datuma izvēli, statusus — un kartītē tukšos laukus */
  function remember() {
    const p = D.person(cur.pid); if (!p) return;
    const S2 = S.db.settings, I = inst(), f = cur.fields;
    S2.contractForm = cur.form; if (cur.place) I.place = cur.place.trim(); I.signMode = cur.signMode;
    if (cur.no && p.contractNo !== cur.no) { p.contractNo = cur.no.trim(); D.audit(p.id, 'update', ['Līguma Nr.']); }
    if (f.p_rel === 'cits' && f.p_rel_other) S2.contractRelations = [...new Set([f.p_rel_other.trim(), ...(S2.contractRelations || [])])].slice(0, 12);
    // kartītē papildina tikai tukšos laukus (esošie dati netiek pārrakstīti)
    const two = cur.parent === 2, put = [], set = (k, v) => { v = String(v || '').trim(); if (v && !String(p[k] || '').trim()) { p[k] = v; put.push(CP.FIELD[k]?.l || k); } };
    set('personalCode', U.codeDigits(f.j_pk).length === 11 ? U.fmtCode(f.j_pk) : f.j_pk); set('phone', f.j_talrunis); set('email', f.j_epasts);
    if (cur.kind === 'jaunietis') { set('addressDeclared', f.j_adrese_dekl); set('addressActual', f.j_adrese_fakt); }
    if (cur.kind === 'parstavis') {
      set(two ? 'parent2Name' : 'parentName', f.p_vards); set(two ? 'parent2Relation' : 'parentRelation', relText(f));
      set(two ? 'parent2Phone' : 'parentPhone', f.p_talrunis); set(two ? 'parent2Email' : 'parentEmail', f.p_epasts);
      if (!two) { set('parentCode', U.codeDigits(f.p_pk).length === 11 ? U.fmtCode(f.p_pk) : f.p_pk); set('parentAddressDeclared', f.p_adrese_dekl); set('parentAddressActual', f.p_adrese_fakt); }
    }
    if (put.length) { p.updatedAt = U.now(); D.audit(p.id, 'update', put); ui.toast('Kartītē papildināts: ' + put.join(', '), 'ok', 6000); }
  }
  /** Word fails: lejupielāde + kopija personas mapē + ieraksts kartītē */
  A.contractWord = async () => {
    if (!ready()) return;
    try {
      const blob = await build(), p = D.person(cur.pid), name = fileName();
      U.download(blob, name); remember();
      if (S.root) {
        const path = await CP.store.saveFile(CP.store.yearPersonDir(p), name, blob);
        const old = cur.editId && (p.contracts || []).find(x => x.id === cur.editId);
        if (old) {
          newVersion(old, path, 'labots rīkā'); Object.assign(old, { no: cur.no || '', date: cur.date, kind: cur.kind, form: cur.form, params: snapshot() });
          D.audit(p.id, 'update', ['Labots līgums' + (cur.no ? ' Nr. ' + cur.no : '')]);
          ui.toast('Izmaiņas saglabātas kā jauna līguma versija. Iepriekšējā versija paliek personas mapē.', 'ok', 8000);
          U.$('contractDialog').close();
        } else {
          (p.contracts = p.contracts || []).push({ id: U.uid(), no: cur.no || '', date: cur.date, kind: cur.kind, form: cur.form, path, at: U.now(), params: snapshot() });
          D.audit(p.id, 'update', ['Sagatavots līgums' + (cur.no ? ' Nr. ' + cur.no : '')]);
          ui.toast('Līgums sagatavots. Kopija saglabāta personas mapē — to var atvērt un labot Word programmā.', 'ok', 8000);
          // pilngadīgs: jauns līgums ar jaunsargu → piedāvā arhivēt veco līgumu ar pārstāvi (vecāku dati kartītē paliek)
          const old = cur.kind === 'jaunietis' ? (p.contracts || []).filter(x => x.kind === 'parstavis' && !x.archived) : [];
          if (old.length && confirm(`Jauns līgums ar jaunsargu sagatavots. Arhivēt iepriekšējo līgumu ar likumisko pārstāvi (${old.length})?\n\nLīgums paliek sarakstā un personas mapē; vecāku dati kartītē netiek mainīti.`)) { old.forEach(x => { x.archived = U.iso(); }); D.audit(p.id, 'update', ['Arhivēts līgums ar pārstāvi']); }
        }
      }
      CP.store.changed();
    } catch (e) { console.error(e); ui.toast('Līgumu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  /** Priekšskatījums un drukāšana rīkā (Word → HTML ar docx-preview) */
  A.contractPreview = async () => {
    if (!ready()) return;
    try {
      const blob = await build(); remember(); CP.store.changed({ silent: true });
      await CP.printDocx(blob, fileName());
    } catch (e) { console.error(e); ui.toast('Priekšskatījumu neizdevās sagatavot: ' + e.message, 'err', 10000); }
  };
  CP.printDocx = async (blob, name) => {
    await CP.reader.loadScript(CP.VENDOR + 'docx/jszip.min.js');
    await CP.reader.loadScript(CP.VENDOR + 'docx/docx-preview.min.js');
    const d = U.$('printDialog'), box = U.$('printPages');
    box.innerHTML = '<p class="muted pad">Sagatavo priekšskatījumu…</p>'; U.$('printInfo').textContent = ''; if (!d.open) d.showModal();
    const holder = document.createElement('div'); holder.className = 'docx-holder';
    await window.docx.renderAsync(blob, holder, null, { inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, experimental: false, useBase64URL: true, renderHeaders: true, renderFooters: true });
    box.innerHTML = ''; box.appendChild(holder);
    const pages = holder.querySelectorAll('section.docx').length;
    U.$('printInfo').textContent = `${pages} ${pages === 1 ? 'lapa' : 'lapas'} · priekšskatījums var nedaudz atšķirties no Word`;
    CP.setPrintSource({ kind: 'html', node: holder, blob, name: name.replace(/\.docx$/i, '') + '.docx' });
    U.$('printGo').disabled = false;
  };

  /* --- Kartītē: sagatavotie līgumi --- */
  CP.contracts = {
    personCard(p) {
      const list = [...(p.contracts || [])].sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || String(b.at).localeCompare(String(a.at)));
      return `<section class="card"><h3>${CP.ic('file', '📄')}Līgums</h3>
        ${p.contractNo ? `<p class="small" style="margin:0 0 6px">Līguma Nr.: <b>${esc(p.contractNo)}</b></p>` : ''}
        ${list.slice(0, 6).map(c => `<div class="row ${c.archived ? 'ct-arch' : ''}"><div class="grow small">${esc(c.no ? 'Nr. ' + c.no : 'bez numura')} · ${esc(U.fmtDate(c.date))}${c.archived ? ` <span class="pill">arhivēts ${esc(U.fmtDate(c.archived))}</span>` : ''}<div class="muted">${esc(STD[`${c.kind}-${c.form}`] || '')}</div></div>${c.archived ? '' : `<button class="sm ghost" data-act="contractEdit" data-arg="${p.id}|${c.id}" title="Labot">✎</button>`}${c.path ? `<button class="sm ghost" data-act="contractOpen" data-arg="${p.id}|${c.id}" title="Lejupielādēt Word failu">⬇</button>` : ''}<button class="sm ghost" data-act="contractArchive" data-arg="${p.id}|${c.id}" title="${c.archived ? 'Atjaunot kā spēkā esošu' : 'Arhivēt (līgums vairs nav spēkā, piem., pēc pilngadības)'}">${c.archived ? '↶' : '🗄'}</button></div>`).join('')}
        <div class="actions" style="margin-top:8px"><button class="sm mainbtn" data-act="contractNew" data-arg="${p.id}">${CP.ic('file', '📄')} Sagatavot līgumu</button></div></section>`;
    },
    FIELDS_HELP
  };
  A.contractView = async arg => {
    const { c } = findC(arg); if (!c?.path) return;
    try { const h = await CP.store.handleFor(c.path, 'main'); if (!h) return ui.toast('Fails personas mapē nav atrasts: ' + c.path, 'warn', 8000); await CP.printDocx(await h.getFile(), c.path.split('/').pop()); }
    catch (e) { ui.toast('Neizdevās atvērt: ' + e.message, 'err', 9000); }
  };
  A.contractArchive = arg => {
    const { p, c } = findC(arg); if (!c) return;
    if (c.archived) { delete c.archived; D.audit(p.id, 'update', ['Līgums atjaunots kā spēkā esošs']); }
    else { if (!confirm(`Arhivēt “Līgums ${c.no ? 'Nr. ' + c.no : '(bez numura)'}”? Tas paliek sarakstā un personas mapē, bet vairs netiek uzskatīts par spēkā esošu.`)) return; c.archived = U.iso(); D.audit(p.id, 'update', ['Arhivēts līgums']); }
    CP.store.changed();
  };
  A.contractDel = arg => {
    const { p, c } = findC(arg); if (!c || !confirm(`Noņemt “Līgums ${c.no ? 'Nr. ' + c.no : '(bez numura)'}” no saraksta?\n\nWord fails personas mapē paliek.`)) return;
    p.contracts = p.contracts.filter(x => x.id !== c.id); D.audit(p.id, 'update', ['Noņemts līguma ieraksts']); CP.store.changed();
  };
  A.contractOpen = async arg => {
    const [pid, cid] = String(arg).split('|'), p = D.person(pid), c = (p?.contracts || []).find(x => x.id === cid); if (!c) return;
    const h = await CP.store.handleFor(c.path, 'main'); if (!h) return ui.toast('Fails personas mapē nav atrasts: ' + c.path, 'warn', 8000);
    U.download(await h.getFile(), c.path.split('/').pop());
  };
})(window.CP);
