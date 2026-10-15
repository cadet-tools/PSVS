/* =====================================================================
   Grafiks: instruktora darba kalendārs (nodarbības, pasākumi, VAM, nometnes …).
   Nav saistīts ar jaunsargu datiem — tikai notikumi, laiki, vieta, piezīmes.

   S.db.schedule = [{ id, title, type, date, endDate, allDay, start 'HH:MM', end 'HH:MM', place, notes,
                      remind: [minūtes], seriesId, gcalId, gsig, createdAt, updatedAt }]
   S.db.scheduleDel = [gcalId]  — Google kalendārā vēl jānodzēš
   settings.gcal = { clientId, calendarId, lastSync }   settings.notify = { events: true, alerts: true }
   Atgādinājumi: rīkā (paziņojums) un uz darbvirsmas (Notification API), kamēr rīks ir atvērts.
   Google Calendar: OAuth (pārlūkā, bez servera) → atsevišķs kalendārs; tiek sūtīti tikai notikumi.
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc;
  const ic = (n, f = '') => CP.ic(n, f);
  const TYPES = [
    ['Nodarbība', '#3fa98f'], ['VAM nodarbība', '#5b8def'], ['Pasākums', '#e6a23c'], ['Nometne', '#d9663f'], ['Sacensības', '#b46fd8'],
    ['Sapulce / apmācības', '#4fb3c9'], ['Novada pārvaldes darbs', '#6f8fc9'], ['Metodiskais darbs', '#7fae7a'], ['Administratīvais darbs', '#8a9aa8'], ['Prombūtne', '#a3a7ad'], ['Cits', '#c2a55a']
  ];
  const color = t => (TYPES.find(x => x[0] === t) || TYPES.at(-1))[1];
  const REMIND = [[0, 'sākumā'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [1440, '1 dienu'], [2880, '2 dienas'], [10080, '1 nedēļu']];
  const remLabel = m => (REMIND.find(x => x[0] === m) || [m, m + ' min'])[1];
  const WD = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'], WDL = ['Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena', 'Svētdiena'];
  const MON = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs', 'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];
  const H0 = 7, H1 = 22;   // nedēļas skata stundas

  const st = () => S.db.settings;
  const list = () => (S.db.schedule = S.db.schedule || []);
  const delQ = () => (S.db.scheduleDel = S.db.scheduleDel || []);
  const gc = () => (st().gcal = st().gcal || { clientId: '', calendarId: '', lastSync: '' });
  const nt = () => (st().notify = st().notify || { events: true, alerts: true });
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return U.iso(d); };
  const wd = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;   // 0 = pirmdiena
  const monday = iso => addDays(iso, -wd(iso));
  const endDay = e => e.endDate && e.endDate > e.date ? e.endDate : e.date;
  const onDay = (e, iso) => e.date <= iso && endDay(e) >= iso;
  const startAt = e => new Date(`${e.date}T${e.allDay ? '00:00' : (e.start || '00:00')}:00`);
  const endAt = e => e.allDay ? new Date(`${addDays(endDay(e), 1)}T00:00:00`) : new Date(`${endDay(e)}T${e.end || e.start || '23:59'}:00`);
  const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const hours = e => e.allDay ? 0 : Math.max(0, (endAt(e) - startAt(e)) / 3600000);
  const timeTxt = e => e.allDay ? (e.endDate && e.endDate > e.date ? `visu dienu līdz ${U.fmtDate(e.endDate)}` : 'visu dienu') : `${e.start || ''}${e.end ? '–' + e.end : ''}${e.endDate && e.endDate > e.date ? ` (līdz ${U.fmtDate(e.endDate)})` : ''}`;
  const sorted = arr => [...arr].sort((a, b) => (a.date + (a.allDay ? '00:00' : a.start)).localeCompare(b.date + (b.allDay ? '00:00' : b.start)));
  const dayEvents = iso => sorted(list().filter(e => onDay(e, iso)));
  const chip = (e, cls = '') => `<button class="sch-chip ${cls}" style="--c:${color(e.type)}" data-act="schEdit" data-arg="${e.id}" title="${esc(`${e.title} · ${timeTxt(e)}${e.place ? ' · ' + e.place : ''}`)}">${e.allDay ? '' : `<b>${esc(e.start || '')}</b> `}${esc(e.title)}</button>`;

  /* ================== Lapa ================== */
  const view = () => S.sch || (S.sch = { mode: (() => { try { return localStorage.getItem('cp.schMode') || 'month'; } catch (e) { return 'month'; } })(), date: U.iso(), tab: 'cal' });
  CP.pages.schedule = {
    render() {
      const v = view();
      const tab = (k, l, i) => `<button role="tab" data-act="schTab" data-arg="${k}" class="${v.tab === k ? 'active' : ''}">${ic(i)}${l}</button>`;
      const body = v.tab === 'hours' ? hoursTab(v) : v.tab === 'sync' ? syncTab() : calTab(v);
      return `<div class="page">${ui.pageHead('Grafiks', 'Darba kalendārs: nodarbības, pasākumi, VAM, nometnes — ar atgādinājumiem un Google kalendāru',
        `<button data-act="schImport" title="Darba grafika imports no Excel">${ic('upload', '⬆')} Imports</button><button class="mainbtn" data-act="schNew">${ic('plus', '＋')} Notikums</button>`)}
        <nav class="tabs" role="tablist">${tab('cal', 'Kalendārs', 'calendar')}${tab('hours', 'Stundu kopsavilkums', 'clock')}${tab('sync', 'Atgādinājumi un Google', 'bell')}</nav>${body}</div>`;
    },
    after() { const n = document.querySelector('.sch-week .sch-now'); if (n && !view()._scrolled) { view()._scrolled = true; n.closest('.sch-wscroll')?.scrollTo({ top: Math.max(0, n.offsetTop - 120) }); } }
  };
  A.schTab = k => { view().tab = k; CP.render(); };
  A.schMode = m => { const v = view(); v.mode = m; v._scrolled = false; try { localStorage.setItem('cp.schMode', m); } catch (e) { } CP.render(); };
  A.schNav = d => {
    const v = view(); if (d === '0') v.date = U.iso();
    else if (v.mode === 'month') { const x = new Date(v.date + 'T12:00:00'); x.setDate(1); x.setMonth(x.getMonth() + Number(d)); v.date = U.iso(x); }
    else v.date = addDays(v.date, (v.mode === 'week' ? 7 : 30) * Number(d));
    v._scrolled = false; CP.render();
  };
  CP.changeHandlers.push(e => {
    const t = e.target;
    if (t.id === 'schJump' && t.value) { view().date = t.value; CP.render(); return true; }
    if (t.id === 'schHoursM' && t.value) { view().hm = t.value; CP.render(); return true; }
    if (t.dataset?.notify) { nt()[t.dataset.notify] = t.checked; CP.store.changed(); if (t.checked) askPermission(); return true; }
    if (t.id === 'gcalClient') { gc().clientId = t.value.trim(); CP.store.changed({ silent: true }); const b = document.querySelector('[data-act=gcalSync]'); if (b) b.disabled = !gc().clientId; return true; }
    if (t.id === 'schDefRem') { st().schDefaultRemind = [...document.querySelectorAll('[data-defrem]:checked')].map(x => Number(x.value)); CP.store.changed({ silent: true }); return true; }
    if (t.dataset?.defrem != null) { st().schDefaultRemind = [...document.querySelectorAll('[data-defrem]:checked')].map(x => Number(x.value)); CP.store.changed({ silent: true }); return true; }
    return false;
  });

  function calTab(v) {
    const today = U.iso(), d = new Date(v.date + 'T12:00:00');
    const title = v.mode === 'month' ? `${MON[d.getMonth()]} ${d.getFullYear()}` : v.mode === 'week' ? (() => { const m = monday(v.date), s = addDays(m, 6); return `${U.fmtDate(m).slice(0, 5)}–${U.fmtDate(s)} · ${isoWeek(m)}. nedēļa`; })() : `no ${U.fmtDate(v.date)}`;
    const seg = (k, l) => `<button class="sm ${v.mode === k ? 'on' : ''}" data-act="schMode" data-arg="${k}">${l}</button>`;
    const upcoming = sorted(list().filter(e => endDay(e) >= today)).slice(0, 4);
    const imp = st().schImport;
    return `${imp ? `<p class="small muted sch-impinfo">⬆ Pēdējais imports: <b>${esc(imp.name)}</b> · ${esc(U.fmtDateTime(imp.at))} · ${imp.n} notikumi no Excel. Atjaunots fails? Ievelc to šeit vai spied “Imports”.</p>` : ''}<section class="card" data-schdrop><div class="att-bar">
        <span class="att-month"><button class="sm ghost" data-act="schNav" data-arg="-1" title="Atpakaļ">◀</button><button class="sm" data-act="schNav" data-arg="0">Šodien</button><button class="sm ghost" data-act="schNav" data-arg="1" title="Uz priekšu">▶</button></span>
        <b class="sch-title">${esc(title)}</b><input type="date" id="schJump" value="${esc(v.date)}" title="Pāriet uz datumu" style="width:auto">
        <span class="grow"></span><span class="seg">${seg('month', 'Mēnesis')}${seg('week', 'Nedēļa')}${seg('list', 'Saraksts')}</span></div>
        ${v.mode === 'week' ? week(v) : v.mode === 'list' ? agenda(v) : month(v)}
        <div class="sch-legend">${TYPES.map(([t, c]) => `<span><i style="background:${c}"></i>${esc(t)}</span>`).join('')}</div></section>
      ${upcoming.length && v.mode !== 'list' ? `<section class="card"><h3>${ic('clock')}Tuvākie notikumi</h3>${upcoming.map(row).join('')}</section>` : ''}`;
  }
  const isoWeek = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 3 - wd(iso)); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 86400000 - 3 + (y.getDay() + 6) % 7) / 7); };
  const row = e => `<div class="row sch-row" style="--c:${color(e.type)}"><span class="sch-bar"></span><div class="sch-when"><b>${esc(U.fmtDate(e.date).slice(0, 5))}</b> <small class="muted">${WD[wd(e.date)]}</small><div class="small">${esc(timeTxt(e))}</div></div>
    <div class="grow"><b>${esc(e.title)}</b> <span class="tag">${esc(e.type)}</span>${e.place ? `<div class="small muted">📍 ${esc(e.place)}</div>` : ''}${e.notes ? `<div class="small muted">${esc(e.notes)}</div>` : ''}</div>
    <span class="small muted nowrap" title="Atgādinājumi">${(e.remind || []).length ? '🔔 ' + e.remind.map(remLabel).join(', ') : ''}${e.gcalId ? ' · <span title="Ir Google kalendārā">G✓</span>' : ''}</span><button class="sm ghost" data-act="schEdit" data-arg="${e.id}" title="Labot">✎</button></div>`;

  function month(v) {
    const d = new Date(v.date + 'T12:00:00'), first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, start = monday(first), today = U.iso(), mo = first.slice(0, 7);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const weeks = cells[35].slice(0, 7) !== mo ? 5 : 6;
    return `<div class="sch-month"><div class="sch-mh">${WD.map(w => `<span>${w}</span>`).join('')}</div><div class="sch-mg">${cells.slice(0, weeks * 7).map(iso => {
      const ev = dayEvents(iso);
      return `<div class="sch-day ${iso.slice(0, 7) !== mo ? 'out' : ''} ${iso === today ? 'today' : ''} ${wd(iso) > 4 ? 'we' : ''}" data-act="schNew" data-arg="${iso}" title="Klikšķis — jauns notikums šajā dienā">
        <span class="sch-dn">${Number(iso.slice(8))}</span>${ev.slice(0, 4).map(e => chip(e)).join('')}${ev.length > 4 ? `<button class="sch-more" data-act="schDay" data-arg="${iso}">+${ev.length - 4} vēl</button>` : ''}</div>`;
    }).join('')}</div></div>`;
  }
  A.schDay = iso => { const v = view(); v.date = iso; v.mode = 'week'; CP.render(); };
  function week(v) {
    const m = monday(v.date), days = Array.from({ length: 7 }, (_, i) => addDays(m, i)), today = U.iso(), px = 44, now = new Date();
    const allDay = days.map(iso => `<div class="sch-ad">${dayEvents(iso).filter(e => e.allDay || e.endDate > e.date).map(e => chip(e)).join('')}</div>`).join('');
    const cols = days.map(iso => {
      const ev = dayEvents(iso).filter(e => !e.allDay && !(e.endDate > e.date));
      // pārklāšanās: vienkāršas joslas
      const lanes = []; const place = ev.map(e => { const s = mins(e.start), en = Math.max(s + 30, mins(e.end || e.start) || s + 60); let l = lanes.findIndex(x => x <= s); if (l < 0) { l = lanes.length; lanes.push(en); } else lanes[l] = en; return { e, s, en, l }; });
      const n = Math.max(1, lanes.length);
      const blocks = place.map(({ e, s, en, l }) => `<button class="sch-blk" data-act="schEdit" data-arg="${e.id}" style="--c:${color(e.type)};top:${(Math.max(s, H0 * 60) - H0 * 60) / 60 * px}px;height:${Math.max(22, (Math.min(en, H1 * 60) - Math.max(s, H0 * 60)) / 60 * px - 2)}px;left:${l / n * 100}%;width:${100 / n}%" title="${esc(e.title + ' · ' + timeTxt(e))}"><b>${esc(e.start)}–${esc(e.end || '')}</b> ${esc(e.title)}${e.place ? `<small>${esc(e.place)}</small>` : ''}</button>`).join('');
      const nowLine = iso === today && now.getHours() >= H0 && now.getHours() < H1 ? `<div class="sch-now" style="top:${(now.getHours() * 60 + now.getMinutes() - H0 * 60) / 60 * px}px"></div>` : '';
      return `<div class="sch-col ${iso === today ? 'today' : ''}" data-day="${iso}">${Array.from({ length: H1 - H0 }, (_, h) => `<div class="sch-slot" data-act="schNew" data-arg="${iso}|${String(H0 + h).padStart(2, '0')}:00" style="height:${px}px"></div>`).join('')}${blocks}${nowLine}</div>`;
    }).join('');
    return `<div class="sch-week"><div class="sch-wh"><span></span>${days.map(iso => `<span class="${iso === today ? 'today' : ''}"><b>${WD[wd(iso)]}</b> ${esc(U.fmtDate(iso).slice(0, 5))}</span>`).join('')}</div>
      <div class="sch-wad"><span class="small muted">visu dienu</span>${allDay}</div>
      <div class="sch-wscroll"><div class="sch-wbody"><div class="sch-hours">${Array.from({ length: H1 - H0 }, (_, h) => `<span style="height:${px}px">${H0 + h}:00</span>`).join('')}</div>${cols}</div></div></div>`;
  }
  function agenda(v) {
    const from = v.date, to = addDays(from, 60), ev = sorted(list().filter(e => endDay(e) >= from && e.date <= to));
    if (!ev.length) return ui.empty('Nākamajās 60 dienās nav notikumu.', `<button class="mainbtn" data-act="schNew">＋ Jauns notikums</button>`);
    let last = '', out = '';
    for (const e of ev) { const day = e.date < from ? from : e.date; if (day !== last) { out += `<h4 class="sch-agh ${day === U.iso() ? 'today' : ''}">${WDL[wd(day)]}, ${esc(U.fmtDate(day))}</h4>`; last = day; } out += row(e); }
    return `<div class="sch-agenda">${out}</div>`;
  }

  /* --- Stundu kopsavilkums --- */
  function hoursTab(v) {
    const m = v.hm || U.iso().slice(0, 7), ev = sorted(list().filter(e => e.date.startsWith(m)));
    const byType = TYPES.map(([t, c]) => { const x = ev.filter(e => e.type === t); return { t, c, n: x.length, h: x.reduce((a, e) => a + hours(e), 0) }; }).filter(x => x.n);
    const total = byType.reduce((a, b) => a + b.h, 0), max = Math.max(1, ...byType.map(x => x.h));
    const f = h => (Math.round(h * 100) / 100).toLocaleString('lv-LV');
    return `<section class="card"><div class="att-bar"><input type="month" id="schHoursM" value="${esc(m)}" style="width:auto"><span class="grow"></span><span class="small muted">Plānotās stundas pēc grafika (visu dienu notikumi netiek skaitīti stundās).</span></div>
      <div class="kpis"><div class="kpi"><small>Stundas kopā</small><b>${f(total)}</b></div><div class="kpi"><small>Notikumi</small><b>${ev.length}</b></div><div class="kpi"><small>Kontaktstundas (nodarbības + VAM)</small><b>${f(byType.filter(x => /Nodarbība/.test(x.t)).reduce((a, b) => a + b.h, 0))} h</b></div></div>
      ${byType.map(x => `<div class="gbar"><span class="gname"><i class="sch-dot" style="background:${x.c}"></i>${esc(x.t)}</span><span class="gtrack"><span style="width:${x.h / max * 100}%;background:${x.c}"></span></span><b>${f(x.h)} h</b><small class="muted">${x.n}×</small></div>`).join('') || ui.empty('Šajā mēnesī nav notikumu.')}</section>
      ${ev.length ? `<section class="card"><h3>${ic('list')}Notikumi</h3><table class="table"><thead><tr><th>Datums</th><th>Laiks</th><th>Notikums</th><th>Veids</th><th>Stundas</th></tr></thead><tbody>${ev.map(e => `<tr><td class="nowrap">${esc(U.fmtDate(e.date))} <small class="muted">${WD[wd(e.date)]}</small></td><td class="nowrap">${esc(timeTxt(e))}</td><td><a href="#" data-act="schEdit" data-arg="${e.id}">${esc(e.title)}</a>${e.place ? ` <small class="muted">· ${esc(e.place)}</small>` : ''}</td><td><span class="tag">${esc(e.type)}</span></td><td>${e.allDay ? '—' : f(hours(e))}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
  }

  /* --- Notikuma logs --- */
  let cur = null;
  A.schNew = (arg, el, ev) => {
    if (ev && ev.target.closest('.sch-chip,.sch-more')) return;    // klikšķis uz notikuma dienas šūnā
    const [date, start] = String(arg || '').split('|');
    const st0 = start || '18:00', [h, m] = st0.split(':').map(Number);
    cur = { id: '', title: '', type: 'Nodarbība', date: date || view().date || U.iso(), endDate: '', allDay: false, start: st0, end: `${String(Math.min(23, h + 2)).padStart(2, '0')}:${String(m).padStart(2, '0')}`, place: '', notes: '', remind: st().schDefaultRemind || [60, 1440] };
    dialog();
  };
  A.schEdit = id => { const e = list().find(x => x.id === id); if (!e) return; cur = JSON.parse(JSON.stringify(e)); dialog(); };
  function dialog() {
    let d = U.$('schDialog'); if (!d) { d = document.createElement('dialog'); d.id = 'schDialog'; d.className = 'wide'; document.body.appendChild(d); }
    const e = cur, titles = [...new Set(list().map(x => x.title).filter(Boolean))].slice(-80), places = [...new Set(list().map(x => x.place).filter(Boolean))].slice(-40);
    const series = e.seriesId ? list().filter(x => x.seriesId === e.seriesId && x.date >= e.date).length : 0;
    d.innerHTML = `<form id="schForm"><header class="dlg-head"><h2>${e.id ? 'Labot notikumu' : 'Jauns notikums'}</h2><button type="button" class="ghost" data-close="schDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body"><div class="fieldgrid">
        <div class="field wide"><label>Nosaukums</label><input name="title" value="${esc(e.title)}" list="dl_schT" required placeholder="piem., Nodarbība J1 grupai, VAM 10.b klasei, Rudens nometne"><datalist id="dl_schT">${titles.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field"><label>Veids</label><select name="type">${TYPES.map(([t]) => `<option ${t === e.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Vieta</label><input name="place" value="${esc(e.place || '')}" list="dl_schP" placeholder="piem., skolas sporta zāle"><datalist id="dl_schP">${places.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
        <div class="field"><label>Datums</label><input type="date" name="date" value="${esc(e.date)}" required></div>
        <div class="field"><label>Beigu datums <small class="muted">(vairāku dienu notikumam)</small></label><input type="date" name="endDate" value="${esc(e.endDate || '')}"></div>
        <div class="field"><label class="check"><input type="checkbox" name="allDay" ${e.allDay ? 'checked' : ''}> Visu dienu</label></div>
        <div class="field sch-times"><label>Laiks</label><span><input type="time" name="start" value="${esc(e.start || '')}" ${e.allDay ? 'disabled' : ''}> – <input type="time" name="end" value="${esc(e.end || '')}" ${e.allDay ? 'disabled' : ''}></span></div>
        <div class="field wide"><label>Atgādināt</label><div class="chips">${REMIND.map(([m, l]) => `<label class="wd ${(e.remind || []).includes(m) ? 'on' : ''}"><input type="checkbox" name="rem" value="${m}" ${(e.remind || []).includes(m) ? 'checked' : ''}>${m ? l + ' iepriekš' : 'notikuma sākumā'}</label>`).join('')}</div></div>
        <div class="field wide"><label>Piezīmes</label><textarea name="notes" rows="2" data-autogrow placeholder="piem., līdzi ņemt kartes un kompasus">${esc(e.notes || '')}</textarea></div>
        ${!e.id ? `<div class="field wide sch-rep"><label class="check"><input type="checkbox" name="repeat"> Atkārtot katru nedēļu</label> <span>līdz <input type="date" name="until" value="${esc(addDays(e.date, 7 * 12))}"></span> <span class="small muted">— katra reize būs atsevišķs notikums, ko var labot</span></div>` : ''}
        ${series > 1 ? `<div class="field wide"><label class="check"><input type="checkbox" name="applySeries"> Piemērot izmaiņas arī nākamajiem ${series - 1} šīs sērijas notikumiem (nosaukums, veids, laiks, vieta, atgādinājumi, piezīmes)</label></div>` : ''}
      </div><p class="small muted">Grafiks ir instruktora darba kalendārs. Ja izmanto Google sinhronizāciju, neraksti nosaukumā vai piezīmēs jauniešu personas datus.</p></div>
      <footer class="dlg-foot">${e.id ? `<button type="button" class="ghost danger" data-act="schDel">Dzēst</button>${series > 1 ? `<button type="button" class="ghost danger" data-act="schDel" data-arg="series">Dzēst šo un nākamos (${series})</button>` : ''}<button type="button" class="ghost" data-act="schDup">⧉ Kopēt</button>` : ''}<span class="grow"></span><button type="button" data-close="schDialog">Atcelt</button><button class="mainbtn" type="submit">Saglabāt</button></footer></form>`;
    const f = d.querySelector('form');
    f.allDay.onchange = () => { f.start.disabled = f.end.disabled = f.allDay.checked; };
    f.querySelectorAll('[name=rem]').forEach(c => c.onchange = () => c.parentElement.classList.toggle('on', c.checked));
    f.onsubmit = ev => {
      ev.preventDefault();
      const o = { title: f.title.value.trim(), type: f.type.value, place: f.place.value.trim(), date: f.date.value, endDate: f.endDate.value && f.endDate.value > f.date.value ? f.endDate.value : '', allDay: f.allDay.checked,
        start: f.allDay.checked ? '' : f.start.value, end: f.allDay.checked ? '' : f.end.value, notes: f.notes.value.trim(), remind: [...f.querySelectorAll('[name=rem]:checked')].map(c => Number(c.value)).sort((a, b) => a - b) };
      if (!o.title) return ui.toast('Ieraksti nosaukumu', 'warn');
      if (!o.allDay && !o.start) return ui.toast('Norādi sākuma laiku vai atzīmē “Visu dienu”', 'warn');
      if (!o.allDay && o.end && !o.endDate && o.end <= o.start) return ui.toast('Beigu laikam jābūt vēlākam par sākuma laiku', 'warn');
      const now = U.now();
      if (e.id) {
        const x = list().find(y => y.id === e.id); Object.assign(x, o, { updatedAt: now });
        if (f.applySeries?.checked) for (const y of list()) if (y.seriesId === e.seriesId && y.date > e.date) { const span = o.endDate ? U.daysTo(o.endDate) - U.daysTo(o.date) : 0; Object.assign(y, { title: o.title, type: o.type, place: o.place, allDay: o.allDay, start: o.start, end: o.end, notes: o.notes, remind: o.remind, endDate: span ? addDays(y.date, span) : '', updatedAt: now }); }
      } else {
        const rep = f.repeat?.checked, until = f.until?.value, sid = rep ? U.uid() : '', span = o.endDate ? U.daysTo(o.endDate) - U.daysTo(o.date) : 0;
        let dd = o.date, n = 0;
        do { list().push({ id: U.uid(), ...o, date: dd, endDate: span ? addDays(dd, span) : '', seriesId: sid, createdAt: now, updatedAt: now }); n++; dd = addDays(dd, 7); } while (rep && until && dd <= until && n < 200);
        if (n > 1) ui.toast(`Izveidoti ${n} notikumi (katru nedēļu līdz ${U.fmtDate(until)})`, 'ok');
      }
      d.close(); view().date = o.date; CP.store.changed(); autoSync();
    };
    if (!d.open) d.showModal();
    if (!e.id) f.title.focus();
  }
  A.schDel = how => {
    const e = list().find(x => x.id === cur?.id); if (!e) return;
    const victims = how === 'series' ? list().filter(x => x.seriesId === e.seriesId && x.date >= e.date) : [e];
    if (!confirm(victims.length > 1 ? `Dzēst ${victims.length} notikumus “${e.title}” (no ${U.fmtDate(e.date)})?` : `Dzēst notikumu “${e.title}” ${U.fmtDate(e.date)}?`)) return;
    for (const x of victims) if (x.gcalId) delQ().push(x.gcalId);
    S.db.schedule = list().filter(x => !victims.includes(x)); U.$('schDialog').close(); CP.store.changed(); autoSync();
  };
  A.schDup = () => { const { id, gcalId, gsig, seriesId, createdAt, updatedAt, ...rest } = cur; cur = { ...rest, id: '', date: addDays(rest.date, 7), endDate: rest.endDate ? addDays(rest.endDate, 7) : '' }; dialog(); ui.toast('Kopija nākamajai nedēļai — pārbaudi datumu un saglabā', 'ok', 4000); };
  /* ================== Atgādinājumi ================== */
  const NKEY = 'cp.schNotified';
  const getN = () => { try { return JSON.parse(localStorage.getItem(NKEY) || '{}'); } catch (e) { return {}; } };
  const setN = o => { try { localStorage.setItem(NKEY, JSON.stringify(o)); } catch (e) { } };
  const canDesk = () => 'Notification' in window && Notification.permission === 'granted';
  async function askPermission() {
    if (!('Notification' in window)) return ui.toast('Šis pārlūks neatbalsta paziņojumus uz darbvirsmas', 'warn');
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') { ui.toast('Paziņojumi šim rīkam ir bloķēti. Atļauj tos pārlūka adreses joslā (🔒 → Paziņojumi → Atļaut).', 'warn', 12000); return false; }
    const r = await Notification.requestPermission(); if (CP.state.page === 'schedule') CP.render();
    return r === 'granted';
  }
  A.schPerm = async () => { if (await askPermission()) desk('CADET PERSONĀLS', 'Paziņojumi ieslēgti. Šādi izskatīsies atgādinājumi.', 'perm-test', 'schedule'); };
  async function desk(title, body, tag, page) {
    if (!canDesk()) return false;
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { page } };
    try { const reg = CP._swReg || await navigator.serviceWorker?.getRegistration(); if (reg?.showNotification) { await reg.showNotification(title, opts); return true; } } catch (e) { }
    try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); ui.go(page); n.close(); }; return true; } catch (e) { return false; }
  }
  navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'cp-open' && e.data.page) ui.go(e.data.page); });
  const inTxt = m => m >= 1440 ? `pēc ${Math.round(m / 1440)} d.` : m >= 60 ? `pēc ${Math.round(m / 60)} h` : m > 0 ? `pēc ${m} min` : 'tagad';
  function tick() {
    if (!S.db || !S.root) return;
    const now = Date.now(), seen = getN(); let changed = false;
    for (const e of list()) for (const m of e.remind || []) {
      const at = startAt(e).getTime() - m * 60000, key = `ev|${e.id}|${m}|${e.date}${e.start || ''}`;
      if (seen[key] || now < at || now > startAt(e).getTime() + 5 * 60000) continue;
      seen[key] = now; changed = true;
      const left = Math.round((startAt(e).getTime() - now) / 60000), when = `${U.fmtDate(e.date)} ${e.allDay ? '' : e.start}`.trim();
      if (nt().events !== false) {
        ui.toast(`🔔 ${e.title} — ${inTxt(left)} (${when}${e.place ? ', ' + e.place : ''})`, 'ok', 0, { act: 'schEdit', arg: e.id, label: 'Atvērt' });
        desk(`🔔 ${e.title}`, `${inTxt(left)} · ${when}${e.allDay ? '' : (e.end ? '–' + e.end : '')}${e.place ? '\n📍 ' + e.place : ''}`, 'ev-' + e.id, 'schedule');
      }
    }
    // brīdinājumi (dokumenti, kavējumi …) — vienu reizi dienā kopsavilkums par jaunajiem
    if (nt().alerts !== false && canDesk() && D.alerts) {
      const day = U.iso(), al = D.alerts().filter(a => a.sev >= 1), fresh = al.filter(a => !seen['al|' + a.msg]);
      if (fresh.length && seen['al-day'] !== day) {
        seen['al-day'] = day; for (const a of fresh) seen['al|' + a.msg] = now; changed = true;
        desk(`Uzdevumi un brīdinājumi: ${fresh.length} jauni`, fresh.slice(0, 3).map(a => '• ' + a.msg).join('\n') + (fresh.length > 3 ? `\n… un vēl ${fresh.length - 3}` : ''), 'alerts', 'alerts');
      }
    }
    if (changed) { for (const k of Object.keys(seen)) if (k.startsWith('ev|') && now - seen[k] > 30 * 864e5) delete seen[k]; setN(seen); }
  }
  setInterval(tick, 30000); setTimeout(tick, 4000);
  CP.schedule = { tick };

  /* ================== .ics fails ================== */
  const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsDT = (iso, t) => iso.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
  const fold = l => { const out = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
  function ics(events) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CADET PERSONALS//Grafiks//LV', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Jaunsardze — darba grafiks', 'X-WR-TIMEZONE:Europe/Riga',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Riga', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0300', 'TZNAME:EEST', 'DTSTART:19700329T030000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'DTSTART:19701025T040000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
    for (const e of events) {
      L.push('BEGIN:VEVENT', `UID:${e.id}@cadet-personals`, `DTSTAMP:${stamp}`, `SEQUENCE:${Math.floor(new Date(e.updatedAt || e.createdAt || Date.now()).getTime() / 1000) % 2147483647}`);
      if (e.allDay) L.push(`DTSTART;VALUE=DATE:${icsDT(e.date)}`, `DTEND;VALUE=DATE:${icsDT(addDays(endDay(e), 1))}`);
      else L.push(`DTSTART;TZID=Europe/Riga:${icsDT(e.date, e.start)}`, `DTEND;TZID=Europe/Riga:${icsDT(endDay(e), e.end || e.start)}`);
      L.push(`SUMMARY:${icsEsc(e.title)}`, `CATEGORIES:${icsEsc(e.type)}`);
      if (e.place) L.push(`LOCATION:${icsEsc(e.place)}`);
      if (e.notes) L.push(`DESCRIPTION:${icsEsc(e.notes)}`);
      for (const m of e.remind || []) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  A.schIcs = how => {
    const from = how === 'all' ? '' : addDays(U.iso(), -30), ev = sorted(list().filter(e => !from || endDay(e) >= from));
    if (!ev.length) return ui.toast('Nav notikumu, ko eksportēt', 'warn');
    U.download(new Blob([ics(ev)], { type: 'text/calendar;charset=utf-8' }), `Jaunsardze grafiks ${U.iso()}.ics`);
    ui.toast(`Kalendāra fails ar ${ev.length} notikumiem lejupielādēts. Google kalendārā: Iestatījumi → Importēt un eksportēt → Importēt.`, 'ok', 10000);
  };

  /* ================== Google Calendar ================== */
  const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
  const API = 'https://www.googleapis.com/calendar/v3';
  const redirectUri = () => new URL('oauth.html', location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '')).href;
  let token = null, tokenExp = 0, syncing = false;
  function getToken(interactive = true) {
    if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
    if (!interactive) return Promise.resolve(null);
    const cid = gc().clientId; if (!cid) { ui.toast('Vispirms ievadi Google OAuth Client ID (cilnē “Atgādinājumi un Google”)', 'warn', 8000); return Promise.resolve(null); }
    const state = U.uid();
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: cid, redirect_uri: redirectUri(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true', state, prompt: token ? '' : 'select_account' }).toString().replace(/&prompt=$/, '');
    const w = window.open(url, 'cp-google', 'width=520,height=680');
    if (!w) { ui.toast('Pārlūks bloķēja Google pieteikšanās logu. Atļauj uznirstošos logus šai lapai un mēģini vēlreiz.', 'warn', 10000); return Promise.resolve(null); }
    return new Promise(res => {
      const bc = new BroadcastChannel('cp-oauth'); let done = false;
      const finish = v => { if (done) return; done = true; bc.close(); clearInterval(t); res(v); };
      bc.onmessage = ev => {
        const p = new URLSearchParams(String(ev.data || '').replace(/^#/, ''));
        if (p.get('state') !== state) return;
        if (p.get('error')) { ui.toast('Google: ' + (p.get('error') === 'access_denied' ? 'piekļuve netika atļauta' : p.get('error')), 'warn', 8000); return finish(null); }
        token = p.get('access_token'); tokenExp = Date.now() + Number(p.get('expires_in') || 3600) * 1000; finish(token);
      };
      const t = setInterval(() => { if (w.closed) setTimeout(() => finish(null), 800); }, 700);
      setTimeout(() => finish(null), 5 * 60000);
    });
  }
  async function api(method, path, body) {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) { token = null; throw Object.assign(Error('Google pieteikšanās beigusies — sinhronizē vēlreiz'), { auth: true }); }
    if (!r.ok && r.status !== 404 && r.status !== 410) { let m = r.status + ''; try { m = (await r.json()).error?.message || m; } catch (e) { } throw Error('Google: ' + m); }
    return r.status === 204 ? {} : { status: r.status, ...(await r.json().catch(() => ({}))) };
  }
  const gEvent = e => ({
    summary: e.title, location: e.place || undefined, description: [e.notes, `Veids: ${e.type}`].filter(Boolean).join('\n\n'),
    start: e.allDay ? { date: e.date } : { dateTime: `${e.date}T${e.start}:00`, timeZone: 'Europe/Riga' },
    end: e.allDay ? { date: addDays(endDay(e), 1) } : { dateTime: `${endDay(e)}T${e.end || e.start}:00`, timeZone: 'Europe/Riga' },
    reminders: { useDefault: false, overrides: (e.remind || []).slice(0, 5).map(m => ({ method: 'popup', minutes: m })) },
    colorId: { 'Nodarbība': '2', 'VAM nodarbība': '9', 'Pasākums': '5', 'Nometne': '6', 'Sacensības': '3', 'Sapulce / apmācības': '7', 'Administratīvais darbs': '8', 'Novada pārvaldes darbs': '1', 'Metodiskais darbs': '10', 'Prombūtne': '8' }[e.type] || '10',
    extendedProperties: { private: { cpId: e.id } }
  });
  const sig = e => JSON.stringify(gEvent(e));
  async function sync(interactive = true) {
    if (syncing) return; if (!await getToken(interactive)) return;
    syncing = true; const g = gc(); let up = 0, del = 0;
    const bar = document.getElementById('gcalState'); if (bar) bar.textContent = 'Sinhronizē…';
    try {
      if (g.calendarId) { const c = await api('GET', `/calendars/${encodeURIComponent(g.calendarId)}`); if (c.status === 404 || c.status === 410) { g.calendarId = ''; for (const e of list()) { delete e.gcalId; delete e.gsig; } } }
      if (!g.calendarId) { const c = await api('POST', '/calendars', { summary: 'Jaunsardze — darba grafiks', description: 'Izveidots ar CADET PERSONĀLS', timeZone: 'Europe/Riga' }); g.calendarId = c.id; }
      const cal = `/calendars/${encodeURIComponent(g.calendarId)}/events`;
      for (const id of [...delQ()]) { await api('DELETE', `${cal}/${encodeURIComponent(id)}`); S.db.scheduleDel = delQ().filter(x => x !== id); del++; }
      const from = addDays(U.iso(), -60);
      for (const e of list()) {
        if (endDay(e) < from && e.gcalId) continue;
        const s = sig(e); if (e.gcalId && e.gsig === s) continue;
        let r = e.gcalId ? await api('PUT', `${cal}/${encodeURIComponent(e.gcalId)}`, gEvent(e)) : null;
        if (!r || r.status === 404 || r.status === 410) r = await api('POST', cal, gEvent(e));
        e.gcalId = r.id; e.gsig = s; up++;
      }
      g.lastSync = U.now(); CP.store.changed({ silent: S.page !== 'schedule' });
      ui.toast(up || del ? `Google kalendārs atjaunināts: ${up} notikumi${del ? `, dzēsti ${del}` : ''}` : 'Google kalendārs jau ir aktuāls', 'ok', 5000);
    } catch (err) { console.error(err); ui.toast(err.message, 'err', 10000); if (S.page === 'schedule') CP.render(); }
    finally { syncing = false; }
  }
  const autoSync = U.debounce(() => { if (token && Date.now() < tokenExp - 60000 && gc().calendarId) sync(false); }, 3000);
  A.gcalSync = () => sync(true);
  /* Google savienošanas palīgs: soļi ar tiešajām saitēm, kopēšanas pogām un atzīmēm “izdarīts” */
  const HKEY = 'cp.gcalSteps';
  const doneSteps = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '{}'); } catch (e) { return {}; } };
  A.gcalStep = k => { const o = doneSteps(); o[k] = !o[k]; try { localStorage.setItem(HKEY, JSON.stringify(o)); } catch (e) { } const b = document.querySelector('#gcalHelp .dlg-body'), y = b?.scrollTop || 0, v = U.$('gcalHelpId')?.value; A.gcalHelp(); const b2 = document.querySelector('#gcalHelp .dlg-body'); if (b2) b2.scrollTop = y; if (v != null && U.$('gcalHelpId')) U.$('gcalHelpId').value = v; };
  A.gcalCopy = (v, el) => navigator.clipboard.writeText(v).then(() => { if (el) { const t = el.textContent; el.textContent = '✓ Nokopēts'; setTimeout(() => { el.textContent = t; }, 1500); } }, () => ui.toast(v, 'ok', 10000));
  A.gcalSave = async () => {
    const v = (U.$('gcalHelpId')?.value || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) return ui.toast('Ielīmē Client ID — tam jābeidzas ar .apps.googleusercontent.com (Client secret nav vajadzīgs)', 'warn', 8000);
    gc().clientId = v; CP.store.changed({ silent: true }); U.$('gcalHelp').close(); CP.render(); sync(true);
  };
  A.gcalHelp = () => {
    let d = U.$('gcalHelp'); if (!d) { d = document.createElement('dialog'); d.id = 'gcalHelp'; d.className = 'wide'; document.body.appendChild(d); }
    const origin = location.origin, R1 = new URL('PSVS/oauth.html', origin + '/').href, R2 = new URL('PSVS/test/oauth.html', origin + '/').href, own = redirectUri();
    const redirs = [...new Set([R1, R2, own])].filter(u => /oauth\.html$/.test(u) && (u === own || /\/PSVS\//.test(own)));
    const ok = doneSteps(), GC = 'https://console.cloud.google.com';
    const copy = v => `<span class="gh-copy"><code>${esc(v)}</code><button type="button" class="sm" data-act="gcalCopy" data-arg="${esc(v)}">⧉ Kopēt</button></span>`;
    const link = (href, label) => `<a class="btn sm" href="${href}" target="_blank" rel="noopener noreferrer">↗ ${label}</a>`;
    const step = (k, n, title, body) => `<section class="gh-step ${ok[k] ? 'done' : ''}"><div class="gh-num">${ok[k] ? '✓' : n}</div><div class="grow"><h3>${title}</h3>${body}
      <label class="check gh-done"><input type="checkbox" data-act="gcalStep" data-arg="${k}" ${ok[k] ? 'checked' : ''}> Izdarīts</label></div></section>`;
    d.innerHTML = `<header class="dlg-head"><h2>Google kalendāra savienošana</h2><button type="button" class="ghost" data-close="gcalHelp" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body gcal-help">
        <div class="gh-intro"><b>Vienu reizi, apmēram 10 minūtes.</b> Bezmaksas. Vajag tikai Google kontu. Rīks redzēs tikai savu kalendāru “Jaunsardze — darba grafiks”, nevis citus tavus kalendārus.
          <div class="small muted">Katrs solis atver vajadzīgo Google lapu jaunā cilnē. Pēc katra soļa atzīmē “Izdarīts”, lai redzētu, kur esi.</div></div>
        ${step('api', 1, 'Ieslēdz Google Calendar API', `<ol class="gh-list"><li>${link(GC + '/apis/library/calendar-json.googleapis.com', 'Atvērt Google Calendar API')} un piesakies ar savu Google kontu.</li>
          <li>Ja augšā prasa izvēlēties projektu: izvēlies esošo (der arī <i>My First Project</i>) vai izveido jaunu.</li>
          <li>Spied zilo pogu <b>Enable</b>. Ja redzi pogu <b>Manage</b>, API jau ir ieslēgts, un nekas vairāk nav jādara.</li></ol>`)}
        ${step('start', 2, 'Izveido lietotnes aprakstu (ja vēl nav)', `<ol class="gh-list"><li>${link(GC + '/auth/overview', 'Atvērt Google Auth Platform')}</li>
          <li><b>Ja redzi lapu “OAuth Overview” ar grafikiem, šis solis jau ir izdarīts.</b> Atzīmē “Izdarīts” un ej tālāk.</li>
          <li>Ja redzi pogu <b>Get started</b>, spied to un aizpildi:
            <ul><li><b>App name:</b> piem., <i>CADET grafiks</i></li><li><b>User support email:</b> tavs e-pasts</li><li><b>Audience:</b> <b>External</b></li><li><b>Contact information:</b> tavs e-pasts</li><li>Atzīmē piekrišanu → <b>Create</b></li></ul></li></ol>`)}
        ${step('users', 3, 'Pievieno sevi kā testa lietotāju', `<ol class="gh-list"><li>${link(GC + '/auth/audience', 'Atvērt Audience')}</li>
          <li>Ritini uz leju līdz sadaļai <b>Test users</b> → <b>+ Add users</b>.</li>
          <li>Ieraksti savu <b>Gmail adresi</b>, ar kuru pieteiksies (citi instruktori, kas lietos šo pašu Client ID, jāpievieno arī šeit) → <b>Save</b>.</li></ol>`)}
        ${step('client', 4, 'Izveido Client ID', `<ol class="gh-list"><li>${link(GC + '/auth/clients', 'Atvērt Clients')} → spied <b>+ Create client</b>.</li>
          <li><b>Application type:</b> izvēlies <b>Web application</b>. <b>Name:</b> piem., <i>CADET grafiks</i>.</li>
          <li>Sadaļā <b>Authorized JavaScript origins</b> spied <b>+ Add URI</b> un ielīmē:${copy(origin)}</li>
          <li>Sadaļā <b>Authorized redirect URIs</b> spied <b>+ Add URI</b> ${redirs.length > 1 ? `${redirs.length} reizes un ielīmē katru adresi` : 'un ielīmē'}:${redirs.map(copy).join('')}</li>
          <li>Spied <b>Create</b>. Atvērsies logs <b>“OAuth client created”</b>.</li>
          <li>Pie <b>Client ID</b> (beidzas ar <i>.apps.googleusercontent.com</i>) spied kopēšanas ikonu ⧉.</li></ol>
          <p class="gh-warn">🔒 <b>Client secret nav vajadzīgs.</b> To neievadi rīkā un nevienam nerādi.</p>`)}
        ${step('tool', 5, 'Ielīmē Client ID rīkā un sinhronizē', `<div class="gh-paste"><input id="gcalHelpId" value="${esc(gc().clientId || '')}" placeholder="xxxxxxxx-xxxx.apps.googleusercontent.com" spellcheck="false"><button type="button" class="mainbtn" data-act="gcalSave">↻ Saglabāt un sinhronizēt</button></div>
          <ol class="gh-list"><li>Atvērsies Google logs. Izvēlies kontu, ko pievienoji 3. solī.</li>
          <li>Ja redzi <b>“Google hasn’t verified this app”</b>, spied <b>Continue</b>. Tā ir tava paša lietotne.</li>
          <li>Atļauj piekļuvi kalendāram → <b>Continue</b>. Logs aizvērsies pats, un rīks parādīs “Google kalendārs atjaunināts”.</li>
          <li>Ja logs neatveras, pārlūks bloķēja uznirstošo logu. Atļauj to adreses joslas labajā pusē un spied vēlreiz.</li></ol>`)}
        <div class="gh-foot small"><p><b>Telefonā:</b> Google Calendar lietotnē parādīsies kalendārs “Jaunsardze — darba grafiks”. Ja to neredzi, atver izvēlni ☰ un ieslēdz to kalendāru sarakstā.</p>
          <p class="muted">Uz Google tiek sūtīti tikai grafika notikumi: nosaukums, laiks, vieta, piezīmes un veids. Personu dati netiek sūtīti. Josla “Free trial” Google Cloud lapā uz šo neattiecas.</p></div></div>
      <footer class="dlg-foot"><span class="grow"></span><button type="button" data-close="gcalHelp">Aizvērt</button></footer>`;
    if (!d.open) d.showModal();
  };
  A.gcalForget = () => { if (!confirm('Atvienot Google kalendāru? Rīkā notikumi paliek. Google kalendārā tie paliek, kā ir; nākamreiz rīks izveidos jaunu kalendāru.')) return; const g = gc(); g.calendarId = ''; g.lastSync = ''; token = null; for (const e of list()) { delete e.gcalId; delete e.gsig; } S.db.scheduleDel = []; CP.store.changed(); };

  function syncTab() {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported', g = gc(), n = nt(), def = st().schDefaultRemind || [60, 1440];
    const pending = list().filter(e => !e.gcalId || e.gsig !== sig(e)).length + delQ().length;
    return `<div class="cards2"><section class="card"><h3>${ic('bell')}Atgādinājumi</h3>
        <div class="row"><div class="grow"><b>Paziņojumi uz darbvirsmas</b><div class="small muted">${perm === 'granted' ? '<span class="okc">✓ atļauti</span>' : perm === 'denied' ? '<span class="red">bloķēti pārlūkā</span> — atļauj adreses joslā: 🔒 → Paziņojumi → Atļaut' : perm === 'unsupported' ? 'pārlūks neatbalsta' : 'vēl nav atļauti'}</div></div>
          ${perm !== 'granted' && perm !== 'unsupported' ? '<button class="sm mainbtn" data-act="schPerm">Atļaut paziņojumus</button>' : perm === 'granted' ? '<button class="sm" data-act="schPerm">Izmēģināt</button>' : ''}</div>
        <label class="check"><input type="checkbox" data-notify="events" ${n.events !== false ? 'checked' : ''}> Grafika notikumu atgādinājumi</label>
        <label class="check"><input type="checkbox" data-notify="alerts" ${n.alerts !== false ? 'checked' : ''}> Jauni brīdinājumi (dokumenti, kavējumi, termiņi) — reizi dienā</label>
        <p class="small" style="margin:10px 0 4px">Noklusējuma atgādinājumi jauniem notikumiem:</p><div class="chips">${REMIND.map(([m, l]) => `<label class="wd ${def.includes(m) ? 'on' : ''}"><input type="checkbox" data-defrem value="${m}" ${def.includes(m) ? 'checked' : ''}>${m ? l : 'sākumā'}</label>`).join('')}</div>
        <p class="small muted">Paziņojumi tiek parādīti, kamēr rīks ir atvērts kādā pārlūka cilnē vai instalēts kā lietotne. Kad dators ir izslēgts, atgādinās Google kalendārs telefonā.</p></section>
      <section class="card"><h3>${ic('calendar')}Google kalendārs</h3>
        <div class="field"><label>Google OAuth Client ID <button class="sm ghost" data-act="gcalHelp" type="button">? Kā iegūt</button></label><input id="gcalClient" value="${esc(g.clientId || '')}" placeholder="xxxxxxxx.apps.googleusercontent.com" spellcheck="false"></div>
        <p class="small" id="gcalState">${g.calendarId ? `Savienots ar kalendāru “Jaunsardze — darba grafiks”. Pēdējā sinhronizācija: ${g.lastSync ? esc(U.fmtDateTime(g.lastSync)) : '—'}. ${pending ? `<span class="warn">Nesinhronizēti: ${pending}</span>` : '<span class="okc">✓ viss aktuāls</span>'}` : '<span class="muted">Vēl nav savienots.</span>'}</p>
        <div class="actions"><button class="mainbtn" data-act="gcalSync" ${g.clientId ? '' : 'disabled'}>↻ Sinhronizēt ar Google</button>${g.calendarId ? '<button class="ghost danger sm" data-act="gcalForget">Atvienot</button>' : ''}</div>
        <p class="small muted">Pēc pirmās sinhronizācijas, kamēr rīks atvērts, izmaiņas tiek nosūtītas automātiski. Uz Google iet tikai notikumi, nevis personu dati.</p>
        <h4 style="margin:14px 0 4px">Bez Google iestatīšanas</h4>
        <div class="actions"><button class="sm" data-act="schIcs">⇩ Kalendāra fails (.ics)</button><button class="sm ghost" data-act="schIcs" data-arg="all">⇩ Visi notikumi</button></div>
        <p class="small muted">.ics failu var importēt Google, Outlook vai telefona kalendārā. Izmaiņas pēc tam automātiski neatjaunojas.</p></section></div>`;
  }

  /* --- Pārskata kartīte --- */
  CP.schedule.dashCard = () => {
    const today = U.iso(), ev = sorted(list().filter(e => endDay(e) >= today && e.date <= addDays(today, 7)));
    return `<section class="card"><h3>${ic('calendar')}Grafiks — tuvākās 7 dienas <button class="ghost sm right" data-page="schedule">Viss →</button></h3>
      ${ev.slice(0, 6).map(e => `<div class="row sch-row" style="--c:${color(e.type)}"><span class="sch-bar"></span><div class="sch-when"><b>${e.date <= today ? 'Šodien' : e.date === addDays(today, 1) ? 'Rīt' : esc(WD[wd(e.date)] + ' ' + U.fmtDate(e.date).slice(0, 5))}</b><div class="small">${esc(timeTxt(e))}</div></div><div class="grow"><a href="#" data-act="schEdit" data-arg="${e.id}"><b>${esc(e.title)}</b></a>${e.place ? `<div class="small muted">📍 ${esc(e.place)}</div>` : ''}</div></div>`).join('') || `<p class="muted small">Tuvākajās dienās nav notikumu. <a href="#" data-act="schNew">＋ Pievienot</a></p>`}</section>`;
  };
  Object.assign(CP.schedule, { ics, sync, gEvent, askPermission, list, delQ, autoSync, TYPES, sorted, timeTxt, render: () => CP.render() });
})(window.CP);
