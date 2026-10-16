/* =====================================================================
   Dalībnieki no citām vienībām (instruktāžas lapai / nometnes žurnālam).
   • Eksports: instruktors savam pasākumam izvēlētos dalībniekus (un, ja vajag, darbiniekus) saglabā
     failā “CADET dalībnieki … .json” — pēc izvēles šifrētu ar paroli (AES-GCM, PBKDF2-SHA-256).
   • Imports: pasākuma logā ievelk šādu failu vai Excel/CSV (arī no tiem, kam rīka nav — ir veidne).
     Dalībnieki glabājas TIKAI šajā pasākumā (ev.external), netiek pievienoti personu sarakstam.
   Rīks neko nesūta internetā — failu instruktori nodod paši (e-pasts, WhatsApp…).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const FORMAT = 'cadet-dalibnieki';
  const PF = ['first', 'last', 'personalCode', 'birth', 'group', 'school', 'schoolClass', 'phone', 'email', 'addressDeclared', 'addressActual',
    'parentName', 'parentRelation', 'parentPhone', 'parentEmail', 'parent2Name', 'parent2Relation', 'parent2Phone', 'emergencyName', 'emergencyPhone'];
  const SF = ['name', 'role', 'personalCode', 'phone', 'address', 'counselor'];
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null && o[k] !== '').map(k => [k, o[k]]));
  const inst = () => S.db.settings.instructor || {};
  const ev = () => S.formEdit;

  /* --- Šifrēšana (pārlūka WebCrypto) --- */
  const b64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function key(pw, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(obj, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 250000;
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pw, salt, iter), new TextEncoder().encode(JSON.stringify(obj)));
    return { format: FORMAT, v: 1, enc: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv) }, data: b64(data) };
  }
  async function decrypt(file, pw) {
    const e = file.enc, k = await key(pw, unb64(e.salt), e.iter || 250000);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, k, unb64(file.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* --- Sadaļa pasākuma logā --- */
  function card(e) {
    const ext = e.external || [], xs = e.extStaff || [], camp = e.type === 'camp';
    const staff = [...(S.db.settings.staff || []), ...xs];
    const units = [...new Set(ext.map(x => x.unit || 'Cita vienība'))];
    const coun = x => camp && staff.length ? `<select class="sm" data-extcoun="${x.id}" title="Audzinātājs nometnē"><option value="">${esc(x.group ? 'Kā grupai' : '— audzinātājs —')}</option>${staff.map(s => `<option value="${s.id}" ${x.counselorId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : '';
    return `<section class="card ext-card" data-extdrop><h3>${ic('users')}Dalībnieki no citām vienībām ${ext.length ? `<span class="pill">${ext.length}</span>` : ''}</h3>
      ${ext.length ? units.map(u => `<div class="ext-unit"><div class="small muted ext-uh">${esc(u)}</div>${ext.filter(x => (x.unit || 'Cita vienība') === u).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b))).map(x => `<div class="row ext-row"><div class="grow"><b>${esc(U.sortName(x))}</b> <small class="muted">${esc([x.group, x.birth && U.fmtDate(x.birth)].filter(Boolean).join(' · '))}</small>${!x.personalCode && !x.birth ? ' <small class="warn">nav personas koda</small>' : ''}</div>${coun(x)}<button class="sm ghost danger" data-act="extDel" data-arg="${x.id}" title="Noņemt no pasākuma">✕</button></div>`).join('')}</div>`).join('')
        : '<p class="small muted" style="margin-top:0">Ja pasākumā piedalās jaunsargi no citas vienības, ievelc šeit to instruktora atsūtīto failu. Dati glabāsies tikai šajā pasākumā, nevis tavā personu sarakstā.</p>'}
      ${xs.length ? `<div class="small muted" style="margin-top:6px">Darbinieki no citām vienībām: ${xs.map(s => esc(s.name)).join(', ')} <a href="#" data-act="extStaffClear">noņemt</a></div>` : ''}
      <div class="ext-drop" data-act="extImport" role="button" tabindex="0"><b>⬆ Ievelc failu vai spied šeit</b><span class="small muted">CADET dalībnieku fails (.json) vai Excel / CSV saraksts</span></div>
      <div class="actions"><button class="sm" data-act="extExport" title="Sagatavot failu ar taviem šī pasākuma dalībniekiem citam instruktoram">⇪ Nosūtīt savus dalībniekus citam instruktoram</button><button class="sm ghost" data-act="extTemplate" title="Excel veidne instruktoriem, kam nav CADET PERSONĀLS">⇩ Excel veidne</button></div></section>`;
  }
  CP.changeHandlers.push(e => {
    const id = e.target.dataset?.extcoun; if (!id || !ev()) return false;
    const x = (ev().external || []).find(y => y.id === id); if (x) x.counselorId = e.target.value; return true;
  });
  A.extDel = id => { const e = ev(), x = (e?.external || []).find(y => y.id === id); if (!x || !confirm(`Noņemt ${U.full(x)} no šī pasākuma?`)) return; e.external = e.external.filter(y => y !== x); CP.forms.renderKeepScroll(); };
  A.extStaffClear = () => { const e = ev(); if (!e || !confirm('Noņemt citu vienību darbiniekus no šī pasākuma?')) return; const ids = new Set((e.extStaff || []).map(s => s.id)); e.staff = (e.staff || []).filter(x => !ids.has(x)); e.extStaff = []; CP.forms.renderKeepScroll(); };

  /* --- Eksports --- */
  function dlg(id, html, cls = '') { let d = U.$(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); } d.className = cls; d.innerHTML = html; if (!d.open) d.showModal(); return d; }
  A.extExport = () => {
    const e = ev(); if (!e) return;
    const own = CP.forms.evPeople(e).filter(p => !p._ext);
    if (!own.length) return ui.toast('Vispirms izvēlies savus dalībniekus sarakstā augšā', 'warn', 6000);
    const st = (S.db.settings.staff || []).filter(s => (e.staff || []).includes(s.id));
    const d = dlg('extExpDialog', `<form><header class="dlg-head"><h2>Nosūtīt dalībniekus citam instruktoram</h2><button type="button" class="ghost" data-close="extExpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p style="margin-top:0">Failā būs <b>${own.length}</b> ${own.length === 1 ? 'dalībnieks' : 'dalībnieki'} ar datiem, kas vajadzīgi instruktāžas lapai un nometnes žurnālam (vārds, personas kods, dzimšanas datums, grupa, adrese, tālrunis, vecāki).</p>
        ${st.length ? `<label class="check"><input type="checkbox" name="staff" checked> Pievienot arī darbiniekus / audzinātājus (${st.length}): ${esc(st.map(s => s.name).join(', '))}</label>` : ''}
        <div class="choice-list">
          <label class="choice"><input type="radio" name="prot" value="pw" checked><div class="grow"><b>Aizsargāt ar paroli (ieteicams)</b><div class="small muted">Paroli pasaki otram instruktoram atsevišķi, piem., piezvanot. Bez paroles failu nevar atvērt.</div><input type="text" name="pw" placeholder="Parole (vismaz 6 zīmes)" autocomplete="off" style="margin-top:8px"></div></label>
          <label class="choice"><input type="radio" name="prot" value="none"><div class="grow"><b>Bez paroles</b><div class="small muted">Fails ir lasāms jebkuram, kas to saņem.</div></div></label>
        </div>
        <p class="small muted">Fails tiek saglabāts tavā datorā. Rīks to nekur nesūta — nodod to pats (e-pastā, WhatsApp…).</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="extExpDialog">Atcelt</button><button class="mainbtn" type="submit">⇩ Saglabāt failu</button></footer></form>`);
    const f = d.querySelector('form');
    f.pw.addEventListener('focus', () => { f.prot.value = 'pw'; });
    f.onsubmit = async x => {
      x.preventDefault();
      const pw = f.prot.value === 'pw' ? f.pw.value : '';
      if (f.prot.value === 'pw' && pw.length < 6) { ui.toast('Parolei jābūt vismaz 6 zīmes garai', 'warn'); f.pw.focus(); return; }
      const I = inst(), unit = [I.name, [I.parvalde, I.nodala].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const body = { format: FORMAT, v: 1, created: U.now(), from: { instructor: I.name || '', unit, phone: I.phone || '' }, event: { title: e.title || '', when: e.when || '', dateFrom: e.dateFrom || '', type: e.type },
        people: own.map(p => ({ ...pick(p, PF), group: D.groupOf(p, e.yearId) || '' })), staff: f.staff?.checked ? st.map(s => pick(s, SF)) : [] };
      try {
        const out = pw ? await encrypt(body, pw) : body;
        const name = `CADET dalībnieki — ${(e.title || 'pasākums').slice(0, 40)} — ${(I.name || 'instruktors')}.json`.replace(/[\\/:*?"<>|]+/g, ' ');
        U.download(new Blob([JSON.stringify(out, null, pw ? 0 : 1)], { type: 'application/json' }), name);
        d.close(); ui.toast(pw ? 'Fails saglabāts. Paroli pasaki otram instruktoram atsevišķi.' : 'Fails saglabāts', 'ok', 8000);
      } catch (err) { console.error(err); ui.toast('Failu neizdevās sagatavot: ' + err.message, 'err', 9000); }
    };
  };
  A.extTemplate = async () => {
    try { const r = await fetch(CP.VENDOR + `templates/dalibnieku-veidne.xlsx?v=${CP.VERSION}`, { cache: 'no-cache' }); if (!r.ok) throw Error(r.status); U.download(await r.blob(), 'Dalībnieku saraksts (veidne).xlsx'); ui.toast('Nosūti šo veidni otram instruktoram — viņš aizpilda un atsūta atpakaļ, tu to ievelc pasākumā', 'ok', 9000); }
    catch (e) { ui.toast('Veidni neizdevās ielādēt: ' + e.message, 'err'); }
  };

  /* --- Imports --- */
  A.extImport = () => {
    let inp = U.$('extFile'); if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'extFile'; inp.hidden = true; inp.accept = '.json,.xlsx,.csv,.txt,application/json'; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files[0]; inp.value = ''; if (f) take(f); }; }
    inp.click();
  };
  const askPw = (msg = '') => new Promise(res => {
    const d = dlg('extPwDialog', `<form><header class="dlg-head"><h2>🔒 Fails ir aizsargāts ar paroli</h2></header>
      <div class="dlg-body"><p style="margin-top:0">Ievadi paroli, ko tev pateica instruktors, kurš atsūtīja failu.</p>${msg ? `<p class="red small">${esc(msg)}</p>` : ''}<input type="password" name="pw" autocomplete="off" required autofocus></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-v="cancel">Atcelt</button><button class="mainbtn" type="submit">Atvērt</button></footer></form>`);
    const f = d.querySelector('form'); let done = false;
    const fin = v => { if (done) return; done = true; d.close(); res(v); };
    f.onsubmit = x => { x.preventDefault(); fin(f.pw.value); };
    f.querySelector('[data-v=cancel]').onclick = () => fin(null);
    d.addEventListener('close', () => fin(null), { once: true });
    setTimeout(() => f.pw.focus(), 30);
  });
  async function take(file) {
    if (!ev()) return;
    try {
      let people = [], staff = [], unit = '', src = file.name;
      if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        let obj = JSON.parse(await file.text());
        if (obj.format !== FORMAT) throw Error('šis nav CADET dalībnieku fails');
        if (obj.enc) {
          let msg = '';
          for (;;) {
            const pw = await askPw(msg); if (pw == null) return;
            try { obj = await decrypt(obj, pw); break; } catch (e) { msg = 'Nepareiza parole. Mēģini vēlreiz.'; }
          }
        }
        people = (obj.people || []).map(p => pick(p, PF)); staff = (obj.staff || []).map(s => pick(s, SF));
        unit = obj.from?.unit || obj.from?.instructor || '';
        src = `${obj.from?.instructor || 'cits instruktors'}${obj.event?.title ? ' — ' + obj.event.title : ''}`;
      } else {
        const r = await CP.io.peopleFromFile(file);
        people = r.people.map(p => pick(p, PF));
        // veidnē: “Vienība / instruktors:” šūna virs tabulas
        for (const row of r.rows.slice(0, r.headerRow)) { const i = row.findIndex(c => /vien[īi]ba|instruktors/i.test(String(c))); if (i >= 0) { const v = row.slice(i + 1).find(c => String(c).trim()); if (v) { unit = String(v).trim(); break; } } }
      }
      if (!people.length && !staff.length) throw Error('failā nav neviena dalībnieka');
      preview(people, staff, unit, src);
    } catch (e) { console.error(e); ui.toast('Failu neizdevās nolasīt: ' + e.message, 'err', 10000); }
  }
  const code = p => U.codeDigits ? U.codeDigits(p.personalCode || '') : String(p.personalCode || '').replace(/\D/g, '');
  const same = (a, b) => (code(a).length === 11 && code(a) === code(b)) || (U.norm(U.full(a)) === U.norm(U.full(b)) && (a.birth || '') === (b.birth || '') && !!a.birth);
  function preview(people, staff, unit, src) {
    const e = ev(), ext = e.external || [], ownIds = new Set((e.participants || []).map(x => x.pid));
    const rows = people.map((p, i) => {
      const mine = D.peopleInYear(e.yearId).find(q => same(q, p)), dup = ext.find(x => same(x, p));
      return { i, p, mine, dup, on: !(mine && ownIds.has(mine.id)) };
    });
    const d = dlg('extImpDialog', `<form><header class="dlg-head"><h2>Dalībnieki no citas vienības</h2><button type="button" class="ghost" data-close="extImpDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><p class="small muted" style="margin-top:0">Fails: ${esc(src)}</p>
        <div class="field"><label>Vienība / instruktors (redzams tikai rīkā)</label><input name="unit" value="${esc(unit)}" placeholder="piem., 3. novada pārvalde, J. Bērziņš"></div>
        <div class="ext-prev">${rows.map(r => `<label class="check ext-prow"><input type="checkbox" name="r" value="${r.i}" ${r.on ? 'checked' : ''}><span class="grow"><b>${esc(U.sortName(r.p))}</b> <small class="muted">${esc([r.p.group, r.p.birth && U.fmtDate(r.p.birth), r.p.personalCode ? 'p.k. ' + String(r.p.personalCode).slice(0, 6) + '-…' : ''].filter(Boolean).join(' · '))}</small>
          ${r.mine ? `<br><small class="okc">ir tavā personu sarakstā — tiks izvēlēts no tava saraksta${ownIds.has(r.mine.id) ? ' (jau izvēlēts)' : ''}</small>` : r.dup ? '<br><small class="warn">jau ir pasākumā — dati tiks atjaunoti</small>' : ''}${!r.p.personalCode && !r.p.birth ? '<br><small class="warn">nav personas koda un dzimšanas datuma</small>' : ''}</span></label>`).join('')}</div>
        ${staff.length && e.type === 'camp' ? `<label class="check" style="margin-top:8px"><input type="checkbox" name="staff" checked> Pievienot darbiniekus / audzinātājus: ${esc(staff.map(s => s.name).join(', '))}</label>` : ''}
        <p class="small muted">Dati glabājas tikai šajā pasākumā un nonāk instruktāžas lapā / nometnes žurnālā kopā ar taviem dalībniekiem.</p></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="extImpDialog">Atcelt</button><button class="mainbtn" type="submit">Pievienot pasākumam</button></footer></form>`, 'wide');
    const f = d.querySelector('form');
    f.onsubmit = x => {
      x.preventDefault();
      const u = f.unit.value.trim(), chosen = new Set([...f.querySelectorAll('[name=r]:checked')].map(c => Number(c.value)));
      let add = 0, upd = 0, own = 0;
      e.external = e.external || []; e.participants = e.participants || [];
      for (const r of rows) {
        if (!chosen.has(r.i)) continue;
        if (r.mine) { if (!e.participants.some(y => y.pid === r.mine.id)) { e.participants.push({ pid: r.mine.id }); own++; } continue; }
        if (r.dup) { Object.assign(r.dup, r.p, { unit: u || r.dup.unit, updatedAt: U.now() }); upd++; continue; }
        e.external.push({ id: 'x' + U.uid(), ...r.p, unit: u, addedAt: U.now() }); add++;
      }
      if (f.staff?.checked) {
        e.extStaff = e.extStaff || []; e.staff = e.staff || [];
        for (const s of staff) { let y = e.extStaff.find(z => U.norm(z.name) === U.norm(s.name)); if (!y) { y = { id: 'xs' + U.uid(), ...s, _ext: true, unit: u }; e.extStaff.push(y); } else Object.assign(y, s); if (!e.staff.includes(y.id)) e.staff.push(y.id); }
      }
      d.close(); CP.forms.renderKeepScroll();
      ui.toast([add && `pievienoti ${add}`, upd && `atjaunoti ${upd}`, own && `${own} izvēlēti no tava saraksta`].filter(Boolean).join(', ') || 'Nekas netika mainīts', 'ok', 6000);
    };
  }

  /* --- Ievilkšana pasākuma logā --- */
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const zone = e => S.page === 'formEdit' && !U.qs('dialog[open]') ? e.target.closest?.('[data-extdrop]') : null;
  document.addEventListener('dragover', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone(e).classList.add('over'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget?.closest?.('[data-extdrop]')) document.querySelectorAll('[data-extdrop].over').forEach(x => x.classList.remove('over')); });
  document.addEventListener('drop', e => { if (!hasFiles(e) || !zone(e)) return; e.preventDefault(); zone(e).classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) take(f); });
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.ext-drop')) { e.preventDefault(); A.extImport(); } });

  CP.extPeople = { card, encrypt, decrypt, take, FORMAT };
})(window.CP);
