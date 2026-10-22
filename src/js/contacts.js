/* =====================================================================
   Kontakti uz telefonu / Google kontaktiem
   - QR kods: noskenē ar telefona kameru → kontakts tiek saglabāts telefonā
     (un Google kontaktos, ja telefons sinhronizējas ar Google kontu)
   - .vcf fails: importē contacts.google.com → Importēt (der arī daudziem)
   Tiešs savienojums ar Google no lokāla faila nav iespējams (Google neatļauj
   pieteikšanos no file:// lapām), tāpēc izmantots standarta vCard formāts.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const QR_URL = CP.VENDOR + 'qrcode/qrcode.min.js';

  /* --- vCard 3.0 --- */
  const ve = s => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const splitName = full => { const p = String(full || '').trim().split(/\s+/); return p.length > 1 ? [p.slice(0, -1).join(' '), p.at(-1)] : [p[0] || '', '']; };
  /** Visi personas kontakti kā vCard ieraksti (jaunietis, vecāki, ārkārtas).
      Vārds pie numura ir tikai šī cilvēka vārds un uzvārds: “Valters Bricka”, “Mārtiņš Bricka”, “Inga Bricka”.
      Bērns, vecāki, ārkārtas persona un viņu numuri ir piezīmē, nevis vārdā.
      Kartītē ir tikai šī cilvēka numurs.
      Etiķetes (Google “Labels”): “Jaunsardze – jaunsargi” / “Jaunsardze – vecāki”. */
  function entries(p) {
    const st = S.db.settings, org = st.contactOrg || 'Jaunsardze';
    const labYouth = st.labelYouth || `${org} – jaunsargi`, labParents = st.labelParents || `${org} – vecāki`;
    const child = U.full(p), all = D.contacts(p), out = [];
    const roleHead = c => c.kind === 'youth' ? 'Bērns' : c.kind === 'emergency' ? 'Ārkārtas persona' + (p.emergencyRelation ? ` (${p.emergencyRelation})` : '') : (c.role || 'Vecāks');
    const otherLine = o => {
      const who = o.kind === 'youth' ? [child, D.groupOf(p) ? 'grupa ' + D.groupOf(p) : ''].filter(Boolean).join(', ') : (String(o.name || '').trim() || '—');
      return [roleHead(o) + ':', who, U.normPhone(o.phone) ? U.prettyPhone(o.phone) : '', o.email || ''].filter(Boolean).join(' ');
    };
    for (const c of all) {
      const n = U.normPhone(c.phone); if (!n && !c.email) continue;
      const isYouth = c.kind === 'youth';
      const others = all.filter(o => o !== c);
      const name = String(c.name || '').trim();
      let first, last, full;
      if (isYouth) { first = p.first || ''; last = p.last || ''; full = child || 'Bērns'; }
      else if (name) { [first, last] = splitName(name); full = name; }
      else { first = roleHead(c); last = ''; full = roleHead(c); }
      const school = [p.school, p.schoolClass].filter(Boolean).join(' ');
      const selfLine = isYouth ? ['Bērns', D.groupOf(p) ? 'grupa ' + D.groupOf(p) : '', school].filter(Boolean).join(', ') : roleHead(c);
      const note = [selfLine, ...others.map(otherLine)].join('\n');
      const rel = [];
      others.forEach((o, i) => {
        if (o.name || o.kind === 'youth') rel.push(`item${i + 1}.X-ABRELATEDNAMES:${ve(o.kind === 'youth' ? child : o.name)}`, `item${i + 1}.X-ABLabel:${ve(roleHead(o))}`);
      });
      out.push({ key: c.idx, kind: c.kind, label: `${c.role}: ${c.name || '—'}`, full, note, phone: n ? '+' + n : '', email: c.email || '', relCount: others.length,
        vcf: ['BEGIN:VCARD', 'VERSION:3.0', `N:${ve(last)};${ve(first)};;;`, `FN:${ve(full)}`,
          n && `TEL;TYPE=CELL:+${n}`, c.email && `EMAIL;TYPE=INTERNET:${ve(c.email)}`, `ORG:${ve(org)}${D.groupOf(p) ? ';' + ve(D.groupOf(p)) : ''}`,
          ...rel, `NOTE:${ve(note)}`,
          `CATEGORIES:${[org, isYouth ? labYouth : labParents].map(x => x.replace(/,/g, ' ')).join(',')}`,
          'END:VCARD'].filter(Boolean).join('\r\n') });
    }
    return out;
  }
  const download = (text, name) => U.download(new Blob([text + '\r\n'], { type: 'text/vcard;charset=utf-8' }), name.replace(/[\\/:*?"<>|]/g, '_'));

  /* --- Dialogs vienai personai --- */
  let cur = null;
  A.vcard = async pid => {
    const p = D.person(pid); if (!p) return;
    const list = entries(p); if (!list.length) return ui.toast('Personai nav tālruņa vai e-pasta', 'warn');
    cur = { p, list, sel: list[0].key };
    U.$('vcTitle').textContent = '📇 Uz telefonu — ' + U.full(p);
    U.$('vcList').innerHTML = list.map(e => `<label class="vcrow"><input type="radio" name="vcpick" value="${e.key}" ${e.key === cur.sel ? 'checked' : ''}><span><b>${esc(e.full)}</b><small class="muted">${esc([e.phone && U.prettyPhone(e.phone), e.email].filter(Boolean).join(' · '))}</small></span><input type="checkbox" class="vcchk" value="${e.key}" checked title="Iekļaut .vcf failā"></label>`).join('');
    U.$('vcDone').textContent = p.contactsSavedAt ? `Pēdējo reizi saglabāts: ${U.fmtDate(p.contactsSavedAt)}` : '';
    U.$('vcardDialog').showModal(); await drawQr();
  };
  U.$('vcList').addEventListener('change', e => { if (e.target.name === 'vcpick') { cur.sel = Number(e.target.value); drawQr(); } });
  async function drawQr() {
    const box = U.$('vcQr'), e = cur.list.find(x => x.key === cur.sel);
    box.innerHTML = '<p class="muted small">Sagatavo QR…</p>';
    try {
      await CP.reader.loadScript(QR_URL);
      const q = window.qrcode; q.stringToBytes = q.stringToBytesFuncs['UTF-8'];
      const qr = q(0, 'L'); qr.addData(e.vcf, 'Byte'); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true }) + `<p class="small"><b>${esc(e.full)}</b></p>` + (e.note ? `<p class="small" style="text-align:left;white-space:pre-line">${esc(e.note)}</p>` : '');
    } catch (err) { box.innerHTML = `<p class="warn small">QR kodu neizdevās izveidot no lokālās bibliotēkas. Lieto .vcf failu.</p>`; }
  }
  A.vcDownload = () => {
    const keys = U.qsa('.vcchk:checked', U.$('vcList')).map(c => Number(c.value)); if (!keys.length) return ui.toast('Atzīmē vismaz vienu kontaktu', 'warn');
    download(cur.list.filter(e => keys.includes(e.key)).map(e => e.vcf).join('\r\n'), `Kontakti ${U.full(cur.p)}.vcf`);
    markSaved(cur.p, `.vcf fails (${keys.length})`);
  };
  A.vcScanned = () => { markSaved(cur.p, 'QR kods'); U.$('vcardDialog').close(); ui.toast('Atzīmēts, ka kontakti saglabāti telefonā', 'ok'); };
  function markSaved(p, how) { p.contactsSavedAt = U.iso(); D.log(p.id, 'note', `Kontakti saglabāti telefonā / Google kontaktos (${how})`); CP.store.changed({ silent: true }); U.$('vcDone').textContent = `Pēdējo reizi saglabāts: ${U.fmtDate(p.contactsSavedAt)}`; }

  /* --- Vairākas personas vienā failā (importam Google Contacts) --- */
  A.bulkVcard = () => {
    const people = S.db.people.filter(p => S.list.sel.has(p.id)), all = people.flatMap(entries);
    if (!all.length) return ui.toast('Atlasītajiem nav tālruņu vai e-pastu', 'warn');
    download(all.map(e => e.vcf).join('\r\n'), `Kontakti ${people.length} personas ${U.iso()}.vcf`);
    for (const p of people) { p.contactsSavedAt = U.iso(); }
    CP.store.changed({ silent: true });
    ui.toast(`Sagatavoti ${all.length} kontakti. Google Contacts → Importēt → izvēlies lejupielādēto .vcf failu.`, 'ok', 12000, { label: 'Atvērt Google Contacts', act: 'openGoogleContacts' });
  };
  A.openGoogleContacts = () => window.open('https://contacts.google.com/', '_blank', 'noopener');
  CP.contacts = { entries };
})(window.CP);
