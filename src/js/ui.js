/* =====================================================================
   Saskarne: ziņojumi, maršrutēšana, sānjosla, kopīgie komponenti.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data;
  const ui = {};

  /* --- Ziņojumi: vienmēr redzami tajā logā, kurā lietotājs strādā --- */
  ui.toast = (msg, type = 'ok', ms = 5000, action = null) => {
    const dialogs = U.qsa('dialog[open]'), top = dialogs.at(-1);
    if (top && top.id === 'scanDialog' && CP.scan) { CP.scan.msg(msg, type); return; }
    const parent = top || document.body;
    let host = parent.querySelector(':scope > .toast-host');
    if (!host) { host = document.createElement('div'); host.className = 'toast-host'; parent.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'toast ' + type; el.setAttribute('role', 'status');
    el.innerHTML = `<span>${U.esc(msg)}</span>${action ? `<button class="sm mainbtn" data-act="${action.act}" data-arg="${U.esc(action.arg || '')}">${U.esc(action.label)}</button>` : ''}<button class="x" aria-label="Aizvērt">✕</button>`;
    if (action) el.querySelector('[data-act]').addEventListener('click', () => setTimeout(() => el.remove(), 50));
    el.querySelector('.x').onclick = () => el.remove();
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  };

  ui.updateSaveState = () => {
    const lbl = U.$('rootLabel');
    const B = S.boot;
    if (lbl) lbl.innerHTML = S.root
      ? `<span class="dotstate ${S.conflict ? 'err' : S.dirty ? 'warn' : 'ok'}"></span>${U.esc(S.rootName)} · ${S.conflict ? 'konflikts' : S.dirty ? 'nesaglabāts' : B?.step === 'index' ? 'indeksē…' : 'saglabāts'}`
      : B && !B.error ? `<span class="spin"></span> Atver ${B.name ? '“' + U.esc(B.name) + '”' : 'datu mapi'}…`
      : B?.error ? '<span class="dotstate err"></span> Mape nav pieejama'
      : S.pendingRoot ? 'Jāapstiprina piekļuve' : 'Datu mape nav izvēlēta';
    U.qsa('[data-act="save"]').forEach(b => { b.classList.toggle('pending', S.dirty); });
  };

  /* --- Maršrutēšana --- */
  ui.go = (page, opts = {}) => {
    S.page = page;
    if (opts.person) { S.selected = opts.person; S.tab = opts.tab || 'overview'; }
    CP.render();
    U.$('view').scrollTop = 0;
  };
  CP.render = () => {
    renderNav(); renderSide();
    const pg = CP.pages[S.page] || CP.pages.dashboard;
    U.$('main').innerHTML = pg.render();
    pg.after?.();
    CP.years?.paint();
    ui.updateSaveState();
  };

  /** Lauks datu mapes ievilkšanai no File Explorer (rezerves veids, ja mapes dialogs nedarbojas). */
  ui.rootDrop = () => {
    const l = CP.store.diag?.last;
    const net = CP.store.netPath ? `<div class="netwarn">⚠ ${U.esc(CP.store.netPathMsg())}<br><span class="small muted">Pašreizējā adrese: ${U.esc(decodeURI(location.href))}</span></div>` : '';
    return net + `<div class="rootdrop" data-rootdrop="1"><b>⇩ Ievelc datu mapi šeit</b><span class="small muted">Atver File Explorer, satver mapi (piem. “CADET PERSONALS”) un ievelc to šajā laukā. Darbojas arī tad, ja mapes dialogs rāda kļūdu.</span></div>`
      + (l && l.error && !S.boot?.error ? `<p class="small err-text">Pēdējā kļūda (${U.esc(l.via)} → ${U.esc(l.step)}${l.ms != null ? ', ' + l.ms + ' ms' : ''}): ${U.esc(l.error)}</p>` : '');
  };

  function renderNav() {
    const nav = S.page === 'person' ? 'people' : S.page;
    U.qsa('.nav [data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === nav));
    const n = D.alerts().filter(a => a.sev > 0).length, badge = U.$('alertBadge');
    if (badge) { badge.textContent = n; badge.classList.toggle('hidden', !n); }
  }

  function renderSide() {
    const extras = (S.roots || []).filter(r => r.id !== 'main' && !r.ok);
    U.$('restoreBox').innerHTML = (S.pendingRoot && !S.root
      ? `<button class="mainbtn sm block" data-act="restoreRoot">🔓 Atļaut piekļuvi “${U.esc(S.pendingRoot.name)}”</button>` : '')
      + extras.map(r => `<button class="sm block" data-act="reconnectSource" data-arg="${U.esc(r.id)}" style="margin-top:6px">🔓 Pieslēgt “${U.esc(r.name)}”</button>`).join('');
    const gs = D.groups(); if (S.groupFilter && !gs.includes(S.groupFilter)) S.groupFilter = '';
    U.$('groupFilter').innerHTML = `<option value="">Visas grupas</option>` + gs.map(g => `<option ${g === S.groupFilter ? 'selected' : ''}>${U.esc(g)}</option>`).join('');
    U.$('sideArchive').checked = S.sideArchive;
    const q = U.norm(U.$('search').value).replace(/ /g, '');
    const people = S.db.people.filter(p => D.inYear(p) && (S.sideArchive ? p.status === 'archived' : p.status !== 'archived') && (!S.groupFilter || D.groupOf(p) === S.groupFilter)
      && (!q || U.norm([U.full(p), U.sortName(p), D.groupOf(p), p.parentName, p.parent2Name, p.phone, p.parentPhone, p.email, p.parentEmail, p.school].join(' ')).replace(/ /g, '').includes(q)))
      .sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)));
    U.$('sideCount').textContent = people.length;
    U.$('sideList').innerHTML = people.map(p => {
      const miss = p.status !== 'archived' && D.missingDocs(p).length;
      return `<button class="person ${S.page === 'person' && S.selected === p.id ? 'active' : ''} ${p.status === 'archived' ? 'archived' : ''}" data-person="${p.id}">
        ${ui.avatar(p)}<span class="p-meta"><b>${U.esc(U.sortName(p))}</b><small>${U.esc(D.groupOf(p) || 'Bez grupas')}${D.partStatus(p) !== 'active' ? ' · ' + (CP.STATUSES[D.partStatus(p)] || '') : ''}</small></span>
        ${miss ? `<span class="dot" title="Trūkst dokumentu: ${miss}"></span>` : ''}</button>`;
    }).join('') || `<p class="muted small pad">${S.boot && !S.root ? (S.boot.error ? 'Datu mape nav pieejama' : 'Gaida datu mapi…') : S.db.people.length ? 'Šajā mācību gadā neviens nav atrasts' : 'Vēl nav personu'}</p>`;
  }
  ui.renderSide = renderSide;

  /* --- Komponenti --- */
  ui.avatar = (p, size = '') => `<span class="avatar ${size}" style="--h:${hue(p.id)}">${U.esc(U.initials(p))}</span>`;
  function hue(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
  ui.status = s => `<span class="status s-${s}">${CP.STATUSES[s] || s}</span>`;
  ui.pageHead = (title, sub = '', actions = '') =>
    `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="actions">${actions}</div></header>`;
  ui.saveBtn = () => `<button data-act="save" class="mainbtn ${S.dirty ? 'pending' : ''}" title="Ctrl+S">💾 Saglabāt</button>`;
  ui.empty = (text, action = '') => `<div class="empty"><p>${text}</p>${action}</div>`;
  /** Definīciju saraksts: etiķete pa kreisi, vērtība blakus (nevis ekrāna otrā malā) */
  ui.dl = rows => `<dl class="dl">${rows.filter(Boolean).map(([k, v, raw]) => `<dt>${U.esc(k)}</dt><dd>${raw ? (v || '<span class="muted">—</span>') : (v ? U.esc(v) : '<span class="muted">—</span>')}</dd>`).join('')}</dl>`;
  ui.chips = (items) => `<div class="chips">${items.join('')}</div>`;

  /** Formas lauki no CP.FIELDS — viena definīcija kartiņai un anketu ievadei */
  ui.fieldsHTML = ({ prefix = 'f_', filter = () => true, sectionIds = false } = {}) => {
    let h = '';
    for (const [sid, title] of CP.SECTIONS) {
      const fields = CP.FIELDS.filter(f => f.s === sid && filter(f)); if (!fields.length) continue;
      h += `<fieldset class="fs" ${sectionIds ? `id="${prefix}sec_${sid}"` : ''}><legend>${title}</legend><div class="fieldgrid">`;
      for (const f of fields) {
        const id = prefix + f.k, t = f.t || 'text'; let input;
        if (t === 'select') input = `<select id="${id}" name="${f.k}">${f.opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
        else if (t === 'textarea') input = `<textarea id="${id}" name="${f.k}" rows="2"></textarea>`;
        else input = `<input id="${id}" name="${f.k}" type="${t}" autocomplete="off" ${t === 'number' ? 'min="0" max="1200"' : ''} ${f.ph ? `placeholder="${U.esc(f.ph)}"` : ''} ${f.list ? `list="${f.list}"` : ''}>`;
        const pin = f.k === 'group' ? `<button type="button" class="pinbtn" data-act="pinGroup" title="Atcerēties grupu nākamajām personām" tabindex="-1">📌</button>` : '';
        h += `<div class="field ${f.wide ? 'wide' : ''}" data-f="${f.k}"><label for="${id}">${f.l}${f.req ? ' <span class="reqmark">*</span>' : ''}${pin}<span class="fx"></span></label>${input}${f.k === 'group' ? '<div class="pinnote hidden"></div>' : ''}<div class="hint"></div></div>`;
      }
      h += `</div></fieldset>`;
    }
    return h;
  };
  ui.fillForm = (form, p) => {
    for (const f of CP.FIELDS) {
      const el = form.elements[f.k]; if (!el) continue;
      el.value = p?.[f.k] ?? (f.k === 'retentionMonths' ? String(S.db.settings.retentionDefault) : f.k === 'status' ? 'active' : f.k === 'group' && !p ? (S.db.settings.stickyGroup || '') : '');
      el.closest('.field')?.classList.remove('auto', 'warn', 'bad');
      const hint = el.closest('.field')?.querySelector('.hint'); if (hint) hint.innerHTML = '';
    }
    ui.syncPins();
  };
  /** Atcerētā grupa: jaunām personām ieliek automātiski, līdz to nomet */
  ui.syncPins = () => {
    const g = S.db.settings.stickyGroup || '';
    U.qsa('.pinbtn').forEach(b => { b.classList.toggle('on', !!g); b.title = g ? `Atcerēta grupa “${g}” — klikšķis nomet` : 'Atcerēties šo grupu nākamajām personām'; });
    U.qsa('.pinnote').forEach(n => { n.classList.toggle('hidden', !g); n.innerHTML = g ? `📌 Atcerēta: <b>${U.esc(g)}</b> <button type="button" class="sm ghost" data-act="pinGroup" data-arg="drop">✕ Nomest</button>` : ''; });
  };
  CP.actions.pinGroup = (arg, el) => {
    const s = S.db.settings, input = el?.closest('form')?.elements.group;
    if (arg === 'drop' || (s.stickyGroup && (!input || !input.value.trim() || input.value.trim() === s.stickyGroup))) { s.stickyGroup = ''; ui.toast('Grupa vairs netiek atcerēta', 'ok'); }
    else { const v = input?.value.trim(); if (!v) { ui.toast('Vispirms ieraksti grupu, ko atcerēties', 'warn'); input?.focus(); return; } s.stickyGroup = v; ui.toast(`Grupa “${v}” tiks ielikta katrai jaunai personai`, 'ok'); }
    CP.store.changed({ silent: true }); ui.syncPins();
  };
  // Ja grupa ir piesprausta un lietotājs to nomaina — atceras jauno vērtību
  document.addEventListener('change', e => {
    if (e.target.name === 'group' && S.db.settings.stickyGroup && e.target.value.trim() && e.target.closest('#personForm,#scanForm')) { S.db.settings.stickyGroup = e.target.value.trim(); CP.store.changed({ silent: true }); ui.syncPins(); }
  });
  ui.readForm = form => {
    const o = {};
    for (const f of CP.FIELDS) { const el = form.elements[f.k]; if (el) o[f.k] = String(el.value || '').trim(); }
    if ('retentionMonths' in o) o.retentionMonths = Number(o.retentionMonths || S.db.settings.retentionDefault);
    return o;
  };
  /** Pārbauda laukus; atgriež {errors, warnings}. Brīdinājumi neaptur saglabāšanu. */
  /** Rāda pie tālruņa laukiem, ja numurs jau ir kādam citam (nebloķē saglabāšanu) */
  ui.phoneHints = (form, selfId) => {
    let suspicious = 0;
    for (const f of Object.keys(D.PHONE_FIELDS)) {
      const el = form.elements[f]; if (!el) continue;
      const box = el.closest('.field'); box.querySelector('.duphint')?.remove();
      if (!U.normPhone(el.value)) continue;
      const others = D.phoneMatches(el.value, selfId, f).filter(e => e.p.id !== selfId || e.f !== f);
      // tas pats numurs šajā formā citā laukā
      const local = Object.keys(D.PHONE_FIELDS).filter(g => g !== f && form.elements[g] && U.normPhone(form.elements[g].value) === U.normPhone(el.value));
      const ext = others.filter(e => e.p.id !== selfId);
      if (!ext.length && !local.length) continue;
      // aizdomīgi, ja numura īpašnieks (vārds) atšķiras; viens vecāks vairākiem bērniem — normāli
      const ownerHere = U.norm(f === 'phone' ? `${form.elements.first?.value || ''} ${form.elements.last?.value || ''}` : form.elements[f.replace('Phone', 'Name')]?.value);
      const owners = new Set([ownerHere, ...ext.map(e => D.phoneOwner(e.p, e.f)), ...local.map(g => U.norm(g === 'phone' ? `${form.elements.first?.value || ''} ${form.elements.last?.value || ''}` : form.elements[g.replace('Phone', 'Name')]?.value))].filter(Boolean));
      const bad = owners.size > 1;
      if (bad) suspicious++;
      const fam = !bad && ext.length > 0;
      const d = document.createElement('div'); d.className = 'duphint ' + (bad ? 'bad' : 'info');
      d.innerHTML = `${bad ? '⚠' : 'ℹ'} Šis numurs jau ir: ${[...ext.map(e => e.f === 'phone' ? `<b>${U.esc(U.full(e.p))}</b> (jaunietis)` : `<b>${U.esc(e.p[e.f.replace('Phone', 'Name')] || '?')}</b> (${e.role}, ${U.esc(U.full(e.p))})`), ...local.map(g => `šajā kartiņā — ${D.PHONE_FIELDS[g]}`)].join(', ')}${fam ? ' — tas pats vecāks (brāļi/māsas)' : bad ? ' — <b>dažādi īpašnieki, pārbaudi</b>' : ''}`;
      box.appendChild(d);
    }
    return suspicious;
  };
  ui.checkForm = (form, o) => {
    let errors = 0, warnings = 0;
    for (const f of CP.FIELDS) {
      const el = form.elements[f.k]; if (!el) continue;
      const box = el.closest('.field'), hint = box.querySelector('.hint');
      box.classList.remove('bad', 'warn'); hint.textContent = '';
      if (f.req && !o[f.k]) { box.classList.add('bad'); hint.textContent = 'Obligāts lauks'; errors++; continue; }
      if (f.v && o[f.k]) {
        const r = U.validate(f.v, o[f.k]);
        if (!r.ok) { box.classList.add('warn'); hint.textContent = 'Pārbaudi: ' + r.msg; warnings++; }
        else if (['personalCode', 'phone', 'email'].includes(f.v)) { o[f.k] = r.value; el.value = r.value; }
      }
    }
    return { errors, warnings };
  };
  ui.datalists = () => {
    U.$('dl_groups').innerHTML = D.groups().map(g => `<option value="${U.esc(g)}">`).join('');
  };
  ui.personOptions = (sel, chosen, all = false) => {
    U.$(sel).innerHTML = S.db.people.filter(p => (all || D.isCurrent(p) || p.id === chosen) && (D.inYear(p) || p.id === chosen)).sort((a, b) => U.cmp(U.sortName(a), U.sortName(b)))
      .map(p => `<option value="${p.id}" ${p.id === chosen ? 'selected' : ''}>${U.esc(U.sortName(p))}${D.groupOf(p) ? ' · ' + U.esc(D.groupOf(p)) : ''}</option>`).join('');
  };
  ui.kindOptions = sel => S.db.settings.docKinds.map(k => `<option ${k === sel ? 'selected' : ''}>${U.esc(k)}</option>`).join('');

  CP.ui = ui;
})(window.CP);
