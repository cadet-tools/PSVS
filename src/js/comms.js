/* =====================================================================
   Saziņa: WhatsApp / SMS / e-pasts / zvans no kartiņas, ziņa grupai,
   ārējo rīku saites. Ziņa tiek atvērta lietotāja programmā — sūtīšanu
   apstiprina pats lietotājs. Katra saziņa tiek ierakstīta vēsturē.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const comms = {};

  function openExternal(url) {
    if (/^https?:/.test(url)) { window.open(url, '_blank', 'noopener'); return; }
    const a = document.createElement('a'); a.href = url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  }
  const waUrl = (num, text) => {
    const t = encodeURIComponent(text || '');
    return S.db.settings.waMode === 'app' ? `whatsapp://send?phone=${num}&text=${t}` : `https://wa.me/${num}${t ? '?text=' + t : ''}`;
  };
  // Signal saitē tekstu ielikt nevar — to nokopē starpliktuvē, un lietotājs ielīmē (Ctrl+V)
  const sigUrl = num => S.db.settings.sigMode === 'app' ? `sgnl://signal.me/#p/+${num}` : `https://signal.me/#p/+${num}`;
  const sigPrep = async (ch, text) => {
    if (ch !== 'signal') return;
    try { await navigator.clipboard.writeText(text || ''); ui.toast('Signal atvērts. Ziņas teksts nokopēts — sarakstē ielīmē to ar Ctrl+V un nosūti.', 'warn', 12000); }
    catch (e) { ui.toast('Signal atvērts, bet tekstu neizdevās nokopēt — nokopē to no loga ar “Kopēt”.', 'warn', 12000); }
  };
  function channelUrl(ch, c, text, subject) {
    const num = U.normPhone(c.phone);
    if (ch === 'signal') { if (!num) throw Error('Saņēmējam nav tālruņa numura'); return sigUrl(num); }
    if (ch === 'whatsapp') { if (!num) throw Error('Saņēmējam nav tālruņa numura'); return waUrl(num, text); }
    if (ch === 'sms') { if (!num) throw Error('Saņēmējam nav tālruņa numura'); return `sms:+${num}?body=${encodeURIComponent(text || '')}`; }
    if (!c.email) throw Error('Saņēmējam nav e-pasta adreses');
    return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(text || '')}`;
  }
  const CH = { whatsapp: 'WhatsApp', signal: 'Signal', sms: 'SMS', email: 'E-pasts' };

  /* --- Ārējie rīki (iestatāmi) --- */
  comms.toolLinks = p => {
    const vals = { 'vārds': p.first, 'uzvārds': p.last, 'pilns': U.full(p), 'tālrunis': U.normPhone(p.phone), 'epasts': p.email, 'grupa': D.groupOf(p), 'klase': p.schoolClass, 'skola': p.school };
    return (S.db.settings.tools || []).filter(t => t.name && t.url).map(t => {
      let ok = true;
      const url = t.url.replace(/\{([^}]+)\}/g, (m, k) => { if (!(k in vals)) return m; if (!vals[k]) ok = false; return encodeURIComponent(vals[k] || ''); });
      return ok && /^(https?:|mailto:)/.test(url) ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">↗ ${esc(t.name)}</a>` : '';
    }).join('');
  };

  /* --- Ziņa vienai personai --- */
  let ctx = null;
  function openMsg(pid, idx, channel, tplIdx) {
    const p = D.person(pid); if (!p) return;
    const cs = D.contacts(p); if (!cs.length) return ui.toast('Personai nav ievadīts neviens tālrunis vai e-pasts', 'warn');
    ctx = { pid };
    U.$('msgTitle').textContent = 'Ziņa — ' + U.full(p);
    U.$('msgTo').innerHTML = cs.map(c => `<option value="${c.idx}">${esc(c.role)}: ${esc(c.name || '—')}${c.phone ? ' · ' + esc(U.prettyPhone(c.phone)) : ''}</option>`).join('');
    const def = idx != null && cs.some(c => c.idx == idx) ? idx : (cs.find(c => c.kind === 'parent') || cs[0]).idx;
    U.$('msgTo').value = String(def);
    U.$('msgChannel').value = channel || 'whatsapp';
    U.$('msgTpl').innerHTML = S.db.settings.templates.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
    U.$('msgTpl').value = String(tplIdx ?? 0);
    U.$('msgSubj').value = ''; refill(); subj(); U.$('msgDialog').showModal(); U.$('msgText').focus();
  }
  const current = () => D.contacts(D.person(ctx.pid)).find(c => c.idx == U.$('msgTo').value);
  const refill = () => { const t = S.db.settings.templates[U.$('msgTpl').value]; U.$('msgText').value = D.fillTpl(t?.text || '', D.person(ctx.pid), current()); };
  const subj = () => U.$('msgSubjWrap').classList.toggle('hidden', U.$('msgChannel').value !== 'email');
  U.$('msgTpl').onchange = refill; U.$('msgTo').onchange = refill; U.$('msgChannel').onchange = subj;

  A.msg = pid => openMsg(pid, null, 'whatsapp');
  A.msgTo = a => { const [pid, idx, ch] = a.split('|'); openMsg(pid, idx, ch); };
  A.remindDocs = pid => {
    const p = D.person(pid), c = D.contacts(p).find(c => c.kind === 'parent') || D.contacts(p)[0];
    const ti = S.db.settings.templates.findIndex(t => t.text.includes('{trūkst}'));
    openMsg(pid, c?.idx, 'whatsapp', ti >= 0 ? ti : 0);
  };
  A.msgCopy = () => navigator.clipboard.writeText(U.$('msgText').value).then(() => ui.toast('Teksts nokopēts', 'ok'));
  function setMsgActions(opened) {
    U.$('msgOpen').classList.toggle('hidden', opened);
    U.$('msgConfirm').classList.toggle('hidden', !opened);
    U.$('msgCancelSend').classList.toggle('hidden', !opened);
  }
  A.msgSend = () => {
    const c = current(), ch = U.$('msgChannel').value, text = U.$('msgText').value;
    try {
      const url = channelUrl(ch, c, text, U.$('msgSubj').value);
      const id = U.uid();
      S.db.log.push({ id, personId: ctx.pid, at: U.now(), type: ch, detail: `→ ${c.role}: ${c.name || ''}\n${text}`, status: 'prepared' });
      sigPrep(ch, text);
      openExternal(url);
      const row = S.db.log.find(x => x.id === id);
      row.status = 'opened';
      ctx.logId = id;
      setMsgActions(true);
      CP.store.changed({ silent: true });
      if (ch !== 'signal') ui.toast('Atvērts ārējā lietotnē. Ziņa vēl nav nosūtīta — apstiprini tikai tad, ja pats to nosūtīji.', 'warn', 9000);
    } catch (e) { ui.toast(e.message, 'warn'); }
  };
  A.msgConfirm = () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (!row) return;
    row.status = 'confirmed'; row.at = U.now();
    ctx.logId = null;
    U.$('msgDialog').close();
    CP.store.changed();
    ui.toast('Atzīmēts: lietotājs apstiprinājis nosūtīšanu', 'ok');
  };
  A.msgCancelSend = () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (row && row.status !== 'confirmed') row.status = 'cancelled';
    if (ctx) ctx.logId = null;
    U.$('msgDialog').close();
    CP.store.changed();
    ui.toast('Sūtīšana atcelta. Ziņa nav atzīmēta kā nosūtīta.', 'ok');
  };
  U.$('msgDialog').addEventListener('close', () => {
    const row = ctx?.logId && S.db.log.find(x => x.id === ctx.logId);
    if (row && (row.status === 'prepared' || row.status === 'opened')) { row.status = 'cancelled'; CP.store.changed({ silent: true }); }
    setMsgActions(false);
    ctx = null;
  });
  A.call = a => {
    const [pid, idx] = a.split('|'), c = D.contacts(D.person(pid)).find(c => c.idx == idx); if (!c) return;
    D.log(pid, 'call', `${c.role}: ${c.name || ''} ${U.prettyPhone(c.phone)}`); CP.store.changed({ silent: true });
    openExternal('tel:+' + U.normPhone(c.phone));
  };
  A.copy = text => navigator.clipboard.writeText(text).then(() => ui.toast('Nokopēts', 'ok'), () => ui.toast(text, 'ok'));

  /* --- Ziņa grupai / atlasītajiem --- */
  const C = S.comms;
  function recipients() {
    const out = [];
    const people = S.db.people.filter(p => D.inYear(p) && p.status !== 'archived' && (C.ids ? C.ids.has(p.id) : (!C.group || D.groupOf(p) === C.group))).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    for (const p of people) for (const c of D.contacts(p)) {
      if (c.kind === 'emergency') continue;
      if (C.audience === 'youth' && c.kind !== 'youth') continue;
      if (C.audience === 'parents' && c.kind === 'youth') continue;
      if (C.channel === 'email' ? c.email : U.normPhone(c.phone)) out.push({ p, c, key: p.id + '|' + c.idx });
    }
    return out;
  }
  CP.pages.comms = {
    render() {
      const tpls = S.db.settings.templates; if (C.text === null) C.text = tpls[C.tpl]?.text || '';
      const rec = recipients(), gs = D.groups(), done = rec.filter(r => C.done.has(r.key)).length;
      const sel = (k, opts) => `<select data-comms="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(C[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      return `<div class="page">${ui.pageHead('Saziņa', 'Viena ziņa daudziem — katram tiek ievietots viņa vārds un dati.')}
        <div class="comms-layout"><section class="card">
          ${C.ids ? `<div class="notice">Atlasītas <b>${C.ids.size}</b> personas no saraksta <button class="sm" data-act="commsAll">Rādīt pēc grupas</button></div>` : ''}
          <div class="fieldgrid">
            ${C.ids ? '' : `<div class="field"><label>Grupa</label>${sel('group', [['', 'Visas aktīvās personas'], ...gs.map(g => [g, g])])}</div>`}
            <div class="field"><label>Kam</label>${sel('audience', [['parents', 'Vecākiem / pārstāvjiem'], ['youth', 'Jauniešiem'], ['both', 'Abiem']])}</div>
            <div class="field"><label>Kanāls</label>${sel('channel', [['whatsapp', 'WhatsApp'], ['signal', 'Signal'], ['sms', 'SMS'], ['email', 'E-pasts']])}</div>
            <div class="field"><label>Veidne</label>${sel('tpl', tpls.map((t, i) => [i, t.name]))}</div>
            <div class="field wide"><label>Teksts</label><textarea id="commsText" rows="7">${esc(C.text)}</textarea>
              <div class="hint muted">Vietturi katram tiek aizvietoti: {saņēmējs} {vārds} {uzvārds} {grupa} {trūkst} {ekipējums}</div></div>
          </div></section>
          <section class="card"><h3>Saņēmēji <small class="muted">${rec.length} · atvērti lietotnē ${done}</small></h3>
            <div class="actions" style="margin-bottom:10px">${C.channel === 'email' ? `<button class="mainbtn sm" data-act="commsBcc">✉ Viena vēstule visiem (BCC)</button>` : ''}
              <button class="sm" data-act="commsCopy">⧉ Kopēt ${C.channel === 'email' ? 'adreses' : 'numurus'}</button>${done ? `<button class="sm ghost" data-act="commsReset">Notīrīt atzīmes</button>` : ''}</div>
            <p class="muted small">${C.channel === 'email' ? 'BCC vēstulē personīgie vietturi netiek aizvietoti. Personalizētai ziņai sūti katram atsevišķi.' : 'WhatsApp neļauj sūtīt automātiski daudziem — katram spied “Atvērt”, pārbaudi ziņu un nospied “Sūtīt”. Lielai grupai izveido WhatsApp grupu ar nokopētajiem numuriem.'}</p>
            <div class="reclist">${rec.map(r => {
              const slot = C.open?.[r.key];
              const st = slot && slot.channel === C.channel ? slot.status : '';
              return `<div class="row"><div class="grow"><b>${esc(U.sortName(r.p))}</b> <small class="muted">${esc(D.groupOf(r.p) || '')} · ${esc(U.yearLabel(D.activeYear()))}</small><div class="small">${esc(r.c.role)}: ${esc(r.c.name || '—')} · ${esc(C.channel === 'email' ? r.c.email : U.prettyPhone(r.c.phone))}${st ? ' · ' + esc(CP.COMM_STATUS[st] || st) : ''}</div></div>
              <button class="sm ${C.channel === 'whatsapp' ? 'wabtn' : 'mainbtn'}" data-act="commsOpen" data-arg="${r.key}">${st ? 'Atvērt vēlreiz' : 'Atvērt'}</button>
              ${st === 'opened' ? `<button class="sm" data-act="commsMark" data-arg="${esc(r.key)}|confirmed">Nosūtīju</button><button class="sm ghost" data-act="commsMark" data-arg="${esc(r.key)}|cancelled">Atcelt</button>` : ''}</div>`;
            }).join('') || '<p class="muted">Nav saņēmēju ar šim kanālam derīgu kontaktu.</p>'}</div></section></div></div>`;
    }
  };
  CP.changeHandlers.push(e => {
    const k = e.target.dataset.comms; if (!k) return false;
    C[k] = k === 'tpl' ? Number(e.target.value) : e.target.value;
    if (k === 'tpl') C.text = S.db.settings.templates[C.tpl]?.text || ''; else C.done.clear();
    CP.render(); return true;
  });
  CP.inputHandlers.push(e => { if (e.target.id !== 'commsText') return false; C.text = e.target.value; return true; });
  A.groupMsg = g => { C.group = g; C.ids = null; C.done.clear(); ui.go('comms'); };
  A.commsAll = () => { C.ids = null; C.done.clear(); CP.render(); };
  A.commsReset = () => { C.done.clear(); CP.render(); };
  A.commsOpen = key => {
    const r = recipients().find(x => x.key === key); if (!r) return;
    const text = D.fillTpl(C.text, r.p, r.c);
    try {
      const url = channelUrl(C.channel, r.c, text, S.db.settings.templates[C.tpl]?.name);
      const id = U.uid();
      S.db.log.push({ id, personId: r.p.id, at: U.now(), type: C.channel, detail: `→ ${r.c.role}: ${r.c.name || ''} (grupas ziņa)\n${text}`, status: 'prepared' });
      sigPrep(C.channel, text);
      openExternal(url);
      S.db.log.find(x => x.id === id).status = 'opened';
      C.open = C.open || {}; C.open[key] = { id, status: 'opened', channel: C.channel }; C.done.add(key);
      CP.store.changed();
      if (C.channel !== 'signal') ui.toast('Atvērts ārējā lietotnē. Tas vēl nav nosūtīts.', 'warn', 7000);
    } catch (e) { ui.toast(e.message, 'warn'); }
  };
  A.commsMark = arg => {
    const i = String(arg).lastIndexOf('|'), key = String(arg).slice(0, i), status = String(arg).slice(i + 1);
    const slot = C.open?.[key]; if (!slot || slot.channel !== C.channel) return;
    const row = S.db.log.find(x => x.id === slot.id); if (!row || row.status === 'confirmed') return;
    row.status = status === 'confirmed' ? 'confirmed' : 'cancelled';
    if (status === 'confirmed') row.at = U.now();
    slot.status = row.status;
    CP.store.changed();
  };
  A.commsBcc = () => {
    const rec = recipients(), emails = [...new Set(rec.map(r => r.c.email))]; if (!emails.length) return;
    const body = C.text.replace(/\{(vārds|uzvārds|pilns|saņēmējs|trūkst|ekipējums|vecāks)\}/g, '').replace(/,\s*!/g, '!');
    C.open = C.open || {};
    for (const r of rec) {
      const id = U.uid();
      S.db.log.push({ id, personId: r.p.id, at: U.now(), type: 'email', detail: `→ ${r.c.name || ''} (BCC grupas vēstule)\n${body}`, status: 'opened' });
      C.open[r.key] = { id, status: 'opened', channel: 'email' }; C.done.add(r.key);
    }
    openExternal(`mailto:?bcc=${emails.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent(S.db.settings.templates[C.tpl]?.name || '')}&body=${encodeURIComponent(body)}`);
    CP.store.changed();
    ui.toast('E-pasts atvērts. Katram saņēmējam statuss ir “Atvērts ārējā lietotnē”, kamēr neatzīmē “Nosūtīju”.', 'warn', 9000);
  };
  A.commsCopy = () => {
    const list = [...new Set(recipients().map(r => C.channel === 'email' ? r.c.email : '+' + U.normPhone(r.c.phone)))];
    navigator.clipboard.writeText(list.join(C.channel === 'email' ? '; ' : '\n')).then(() => ui.toast(`Nokopēti ${list.length} kontakti`, 'ok'));
  };

  CP.comms = comms;
})(window.CP);
