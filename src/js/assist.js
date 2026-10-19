/* =====================================================================
   Meklēšana pa visu rīku un palīgs (TESTA KANĀLS).
   • Ctrl+K vai poga “Meklēt” augšējā joslā atver meklēšanas logu.
   • Atrod personas, dokumentus, pasākumus, sagatavotās veidlapas, sadaļas, iestatījumus un darbības.
   • Palīgs: jautājumi brīvā tekstā (“kā pievienot personu?”) — atbilde no rīka iebūvētās pamācības
     un poga “Aiziet”, kas aizved uz īsto vietu. Darbojas bez interneta, nekas netiek sūtīts.
     Tas NAV mākslīgais intelekts: atbildes ir iepriekš uzrakstītas, meklēšana — pēc atslēgvārdiem.
   ===================================================================== */
(function (CP) {
  'use strict';
  if (CP.CHANNEL !== 'test') return;
  const U = CP.util, S = CP.state, D = CP.data, ui = CP.ui, A = CP.actions, esc = U.esc, ic = (n, f = '') => CP.ic(n, f);

  /* --- Darbības palaišana tāpat kā pogām (data-act) --- */
  const act = (name, arg) => () => {
    const fn = A[name]; if (!fn) return;
    if (!S.root && !CP.noRootOk(name)) { CP.needRoot(); return; }
    CP.analytics?.act(name);
    Promise.resolve().then(() => fn(arg)).catch(err => { console.error(err); ui.toast('Kļūda: ' + err.message, 'err'); });
  };
  const page = p => () => { if (p === 'people' && S.list?.status === 'archived') S.list.status = 'current'; ui.go(p); };
  const card = id => () => ui.goSettingsCard(id);
  const person = (id, tab) => () => ui.go('person', { person: id, tab: tab || 'overview' });

  /* --- Sadaļas un iestatījumi --- */
  const PAGES = [
    ['dashboard', 'Pārskats', 'grid', 'sakums galvenais kopskats statistika'],
    ['people', 'Personas', 'users', 'jaunsargi saraksts kandidati'],
    ['comms', 'Saziņa', 'message', 'whatsapp sms epasts zinas vecakiem nosutit'],
    ['schedule', 'Grafiks', 'calendar', 'kalendars nodarbibu laiki google kalendars'],
    ['attendance', 'Apmeklējums', 'userCheck', 'nodarbibas zurnals apmekletiba kvalifikacijas'],
    ['vfs', 'VFS testi', 'award', 'fiziska sagatavotiba normativi nozimites sports'],
    ['forms', 'Veidlapas', 'clipboard', 'instruktaza nometne zurnals veidne pasakums'],
    ['documents', 'Dokumenti', 'file', 'faili mapes anketas ligumi'],
    ['equipment', 'Ekipējums', 'backpack', 'formastērps izsniegt atdot inventars'],
    ['alerts', 'Uzdevumi un brīdinājumi', 'bell', 'termini atgadinajumi dzimsanas dienas'],
    ['archive', 'Arhīvs', 'archive', 'arhivetie bijusie'],
    ['quality', 'Datu kvalitāte', 'check', 'trukstosi dati labot papildinat'],
    ['changes', 'Darbību žurnāls', 'list', 'izmainas vesture kas mainits atsaukt'],
    ['retention', 'Glabāšanas termiņi', 'archive', 'dzest vecus datus glabasana'],
    ['feedback', 'Ziņot izstrādātājam', 'flag', 'kluda ieteikums atsauksme'],
    ['about', 'Par rīku', 'info', 'pamaciba ka sakt versija privatums'],
    ['settings', 'Iestatījumi', 'sliders', 'iestatijumi konfiguracija'],
  ].map(([p, l, i, kw]) => ({ g: 'Sadaļas', l, i, kw, run: page(p) }));
  const CARDS = [
    ['unitCard', 'Vienības nosaukums un logo', 'flag', 'logo vienibas nosaukums'],
    ['yearsCard', 'Mācību gadi', 'calendar', 'gads jauns macibu gads parcelt'],
    ['dataCard', 'Datu glabāšana un rezerves kopijas', 'save', 'rezerves kopija backup json datu mape arhivs'],
    ['encCard', 'Šifrētā rezerves kopija', 'lock', 'sifreta kopija google drive parole'],
    ['lockCard', 'Ekrāna bloķēšana ar PIN', 'lock', 'pin bloket parole aizslegt'],
    ['healthCard', 'Datu veselības pārbaude', 'shield', 'veseliba parbaude bojati dati integritate'],
    ['docsCard', 'Dokumentu kategorijas un obligātie dokumenti', 'file', 'obligatie dokumenti kategorijas derigums'],
    ['commsCard', 'Saziņas iestatījumi', 'message', 'whatsapp valsts kods sablons'],
    ['permsCard', 'Atļaujas un statistika', 'shield', 'atlaujas sikdatnes statistika analitika'],
  ].map(([id, l, i, kw]) => ({ g: 'Iestatījumi', l, i, kw, run: card(id) }));
  const ACTIONS = [
    ['Pievienot personu', 'userPlus', 'jauns jaunsargs pievienot cilveku kandidats', 'addPerson'],
    ['Ievadīt anketu (nolasīt no attēla vai faila)', 'scan', 'anketa skenet nolasit ocr', 'scan'],
    ['Imports no Excel / CSV', 'upload', 'imports excel csv e klase saraksts', 'import'],
    ['Jaunsarga kopsavilkums (PDF)', 'chart', 'kopsavilkums atskaite pdf raksturojums', 'sumNew'],
    ['Sava veidlapa (aizpildīt no Word veidnes)', 'clipboard', 'veidlapa word docx aizpildit veidne', 'cfNew'],
    ['Jauna drošības instruktāža', 'clipboard', 'instruktaza drosiba pasakums', 'formNew', 'instr'],
    ['Jauns nometnes žurnāls', 'clipboard', 'nometne zurnals', 'formNew', 'camp'],
    ['Jauna nodarbība (apmeklējums)', 'userCheck', 'nodarbiba apmekletiba atzimet', 'sessNew'],
    ['Izsniegt ekipējumu', 'backpack', 'izsniegt ekipejums forma', 'addEq'],
    ['Jauns VFS tests', 'award', 'vfs tests normativi', 'vfsNew'],
    ['Izveidot JSON rezerves kopiju tagad', 'save', 'rezerves kopija backup saglabat', 'backupNow'],
    ['Pārbaudīt, vai rezerves kopiju var atjaunot', 'refresh', 'atjaunot kopiju parbaudit restore', 'restoreCheck'],
    ['Pārbaudīt datu veselību', 'shield', 'veseliba parbaude datu fails bojats', 'healthOpen'],
    ['Mācību gada noslēgums (vednis)', 'calendar', 'gada nosleguma vednis beigas noslegt gadu jauns gads', 'yearEnd'],
    ['Pievienot mācību gadu', 'calendar', 'jauns macibu gads', 'openAddYear'],
    ['Pārcelt dalībniekus uz citu gadu', 'calendar', 'parcelt nakamais gads', 'openMove'],
    ['Bloķēt ekrānu', 'lock', 'bloket aizslegt pin', 'lockNow'],
    ['Saglabāt', 'save', 'saglabat', 'save'],
  ].map(([l, i, kw, a, arg]) => ({ g: 'Darbības', l, i, kw, run: act(a, arg), need: a }));

  /* --- Palīga zināšanu bāze: jautājums → īsa atbilde + kur aiziet --- */
  const HELP = [
    { t: 'Kā pievienot jaunu personu?', kw: 'pievienot jauns persona jaunsargs kandidats cilveks izveidot ievadit', a: 'Sānjoslā spied “＋ Persona” (vai Personas → “＋ Pievienot”). Var ievadīt ar roku, nolasīt anketu no attēla/faila vai pārņemt no citas vienības faila.', go: ['Pievienot personu', act('addPerson')] },
    { t: 'Kā nolasīt anketu no attēla vai Word faila?', kw: 'anketa nolasit skenet foto attels ocr word pdf atpazit', a: 'Sānjoslā “Ievadīt anketu”: ievelc anketas failu vai fotogrāfiju. Atpazītie lauki parādās pārbaudes logā — kartītē nonāk tikai tas, ko apstiprini.', go: ['Atvērt anketu ievadi', act('scan')] },
    { t: 'Kā importēt sarakstu no Excel vai e-klases?', kw: 'imports excel csv eklase saraksts ielādēt daudz personu tabula', a: 'Sānjoslā “Imports”: izvēlies Excel/CSV failu, piesaisti kolonnas laukiem un pārbaudi priekšskatījumu. Esošās personas tiek atpazītas un netiek dublētas.', go: ['Atvērt importu', act('import')] },
    { t: 'Kā pievienot personai dokumentu?', kw: 'dokuments pievienot fails pieteikums ligums atlauja augšupielādēt piesaistit', a: 'Atver personas kartiņu → cilne “Dokumenti” → ievelc failu vai spied “＋ Pievienot”. Fails tiek nokopēts personas mapē datu mapē, oriģināls netiek mainīts.', go: ['Atvērt Dokumentus', page('documents')] },
    { t: 'Kur redzēt, kam trūkst dokumentu?', kw: 'trukst dokumenti trukstosi obligatie nav iesniegts', a: 'Pārskatā ir kartīte “Trūkst dokumentu”, bet Dokumentu sadaļā — pilns saraksts. Kuri dokumenti ir obligāti, nosaka Iestatījumi → Dokumenti.', go: ['Atvērt Dokumentus', page('documents')] },
    { t: 'Kā atzīmēt nodarbības apmeklējumu?', kw: 'apmeklejums atzimet nodarbiba klatbutne kavejums zurnals', a: 'Apmeklējums → izvēlies grupu un mēnesi, spied uz šūnas (+ ir klāt, n — nav, a — attaisnots). Jaunu nodarbību pievieno ar “＋ Nodarbība”.', go: ['Atvērt Apmeklējumu', page('attendance')] },
    { t: 'Kā sagatavot drošības instruktāžu pasākumam?', kw: 'instruktaza drosiba pasakums parakstu lapa sagatavot', a: 'Veidlapas → “Instruktāža”: izvēlies dalībniekus, datumu un vadītāju — rīks sagatavo parakstu lapu PDF formātā. Var izmantot arī savu Word veidni.', go: ['Jauna instruktāža', act('formNew', 'instr')] },
    { t: 'Kā sagatavot nometnes žurnālu?', kw: 'nometne zurnals sagatavot nometnes', a: 'Veidlapas → “Nometnes žurnāls”: dalībnieki, audzinātāji, datumi. Rīks aizpilda žurnālu un saglabā to datu mapē.', go: ['Jauns nometnes žurnāls', act('formNew', 'camp')] },
    { t: 'Kā izmantot savu Word veidlapu?', kw: 'sava veidlapa word docx veidne atzimes vietturi aizpildit', a: 'Veidlapas → “Ielādēt veidni” → “Sava veidlapa”. Veidnē ieraksti atzīmes, piemēram, {Vārds} {Uzvārds} — sarakstu redzi pogā “Pieejamās atzīmes”. Atzīmes var ielikt arī rīka redaktorā (poga “Rediģēt”).', go: ['Sava veidlapa', act('cfNew')] },
    { t: 'Kā izveidot jaunsarga kopsavilkumu?', kw: 'kopsavilkums raksturojums atskaite pdf jaunsargs gads', a: 'Personas kartiņā ⋯ → “Kopsavilkums” vienai personai, vai Veidlapās vairākām uzreiz — katrai personai savs PDF (vairākām — ZIP failā).', go: ['Izveidot kopsavilkumu', act('sumNew')] },
    { t: 'Kā nosūtīt ziņu vecākiem vai grupai?', kw: 'zina nosutit vecakiem whatsapp sms epasts grupa sazina', a: 'Saziņa → izvēlies personas vai grupu un veidni. Rīks atver WhatsApp/e-pastu ar sagatavotu tekstu — nosūti pats.', go: ['Atvērt Saziņu', page('comms')] },
    { t: 'Kā izsniegt vai saņemt atpakaļ ekipējumu?', kw: 'ekipejums izsniegt atdot sanemt formasterps inventars', a: 'Ekipējums → “＋ Izsniegt” (persona, priekšmets, daudzums). Kad atdod, ierakstā spied “Atdots”.', go: ['Atvērt Ekipējumu', page('equipment')] },
    { t: 'Kā pārcelt jaunsargus uz nākamo mācību gadu?', kw: 'parcelt nakamais macibu gads jauns gads turpina', a: 'Labākais ceļš — mācību gada noslēguma vednis: tas palīdz pārbaudīt dokumentus un ekipējumu, izveidot kopsavilkumus, pārcelt dalībniekus un izveidot rezerves kopiju.', go: ['Atvērt vedni', act('yearEnd')] },
    { t: 'Kā noslēgt mācību gadu?', kw: 'nosleguma vednis noslegt gadu beigas gada beigas vasara', a: 'Mācību gada noslēguma vednis soli pa solim: trūkstošie dokumenti → neatdotais ekipējums → kopsavilkumi → kas turpina nākamajā gadā → rezerves kopija → pārslēgšanās uz jauno gadu.', go: ['Atvērt vedni', act('yearEnd')] },
    { t: 'Kā izveidot rezerves kopiju?', kw: 'rezerves kopija backup saglabat kopija json', a: 'Iestatījumi → Drošība → “Izveidot JSON kopiju”. Kopijas glabājas datu mapes apakšmapē _rezerves. Šifrētu kopiju var glabāt arī Google Drive.', go: ['Atvērt datu glabāšanu', card('dataCard')] },
    { t: 'Kā pārbaudīt, vai rezerves kopiju var atjaunot?', kw: 'parbaudit kopiju atjaunot restore vai strada kopija derīga', a: 'Rīks reizi mēnesī atgādina to pārbaudīt. Pārbaude atver jaunāko kopiju, pārbauda to un salīdzina ar pašreizējiem datiem — tavi dati netiek mainīti.', go: ['Pārbaudīt tagad', act('restoreCheck')] },
    { t: 'Kā atjaunot datus no rezerves kopijas?', kw: 'atjaunot datus no kopijas pazudusi dati restore atgriezt', a: 'Iestatījumi → Drošība → “Rezerves kopijas” → pie vajadzīgās kopijas “Atjaunot”. Pirms atjaunošanas rīks pats saglabā arī pašreizējo stāvokli.', go: ['Atvērt rezerves kopijas', card('dataCard')] },
    { t: 'Kā pārbaudīt, vai datu fails nav bojāts?', kw: 'datu veseliba bojats fails parbaude kludas integritate', a: 'Datu veselības pārbaude meklē dublētus identifikatorus un ierakstus, kas norāda uz neesošām personām vai gadiem. Tā notiek automātiski, atverot datu mapi; drošos labojumus var izdarīt ar vienu pogu (pirms tam tiek izveidota kopija).', go: ['Atvērt pārbaudi', act('healthOpen')] },
    { t: 'Kā mainīt datu mapi vai pārnest datus uz citu datoru?', kw: 'datu mape mainit cits dators parnest usb kopēt', a: 'Iestatījumi → Drošība → “Mainīt datu mapi”. Uz citu datoru pārnes visu datu mapi (piem., ar USB) un tur to izvēlies rīkā.', go: ['Atvērt datu glabāšanu', card('dataCard')] },
    { t: 'Kā ielikt vienības logo un nosaukumu?', kw: 'logo vienibas nosaukums ielikt galvene', a: 'Iestatījumi → Pamata → “Vienība”. Logo redzams rīka augšējā joslā un — pēc izvēles — neoficiālos rīka failos (kopā ar CADET.LV logo). Oficiālajās veidlapās logo netiek likts.', go: ['Atvērt vienības iestatījumus', card('unitCard')] },
    { t: 'Kā aizsargāt rīku ar PIN kodu?', kw: 'pin parole bloket aizsargat ekrans aizslegt', a: 'Iestatījumi → Drošība → “Ekrāna bloķēšana”: iestati PIN. Rīks bloķējas pēc neaktivitātes vai ar pogu.', go: ['Atvērt bloķēšanu', card('lockCard')] },
    { t: 'Kur ir arhivētās personas?', kw: 'arhivs arhivetie bijusie izstajusies atjaunot personu', a: 'Sadaļa “Arhīvs”. Arhivētu personu var atjaunot ar pogu “Atjaunot” kartiņā.', go: ['Atvērt Arhīvu', page('archive')] },
    { t: 'Kā izdzēst personu?', kw: 'dzest izdzest personu nonemt', a: 'Parasti personu pārvieto uz arhīvu (kartiņā ⋯ → “Arhivēt”). Pilnīga dzēšana ir kartiņā ⋯ → “Dzēst” un pēc glabāšanas termiņiem sadaļā “Glabāšanas termiņi”.', go: ['Glabāšanas termiņi', page('retention')] },
    { t: 'Kā atsaukt kļūdainu izmaiņu?', kw: 'atsaukt kluda izmaina atpakal vesture kas mainits', a: 'Darbību žurnālā redzams, kas un kad mainīts, un daudzas izmaiņas tur var atsaukt.', go: ['Atvērt Darbību žurnālu', page('changes')] },
    { t: 'Kā ievadīt VFS testa rezultātus?', kw: 'vfs fiziska sagatavotiba rezultati normativi nozime', a: 'VFS testi → “＋ Jauns tests”, ievadi rezultātus — punkti un līmenis tiek aprēķināti automātiski; var izdrukāt protokolu.', go: ['Jauns VFS tests', act('vfsNew')] },
    { t: 'Kā pievienot nodarbības grafikā vai Google kalendārā?', kw: 'grafiks kalendars google nodarbibu laiks plāns', a: 'Grafiks → “＋ Ieraksts”. Grafiku var sinhronizēt ar Google kalendāru (pieslēgšanās grafika lapā).', go: ['Atvērt Grafiku', page('schedule')] },
    { t: 'Kur redzēt termiņus un atgādinājumus?', kw: 'termini atgadinajumi bridinajumi uzdevumi dzimsanas dienas', a: 'Sadaļa “Uzdevumi” apkopo termiņus, trūkstošos dokumentus, ekipējumu, dzimšanas dienas un 18/21 gadu brīdinājumus.', go: ['Atvērt Uzdevumus', page('alerts')] },
    { t: 'Kā ziņot par kļūdu vai ieteikt uzlabojumu?', kw: 'zinot kluda ieteikums atsauksme izstradatajs problema', a: 'Sadaļa “Ziņot”: apraksti, kas notika. Personu dati netiek pievienoti.', go: ['Atvērt Ziņot', page('feedback')] },
    { t: 'Vai mani dati tiek sūtīti internetā?', kw: 'privatums dati internets droši serveris sūtīti', a: 'Nē. Personu dati glabājas tikai tavā datu mapē datorā. Internetā tiek sūtīta tikai anonīma lietošanas statistika (to var izslēgt Iestatījumos → Atļaujas) un tas, ko pats izvēlies (piem., šifrēta kopija Google Drive).', go: ['Par rīku', page('about')] },
    { t: 'Kā mainīt tēmu vai krāsu?', kw: 'tema tumsa gaisa krasa izskats akcents', a: 'Iestatījumi → Pamata → “Izskats”.', go: ['Atvērt Iestatījumus', page('settings')] },
  ].map(h => ({ ...h, n: U.norm(h.t + ' ' + h.kw) }));

  /* --- Teksta salīdzināšana --- */
  const STOP = new Set('ka kur ko kas kad es man mans mana manu var varu lai ir uz un vai to tas ta ar no pie par ja jā ne nav kapec kadu kada kadi kuru kura sis si so sim tagad vajag gribu ludzu jalieto'.split(' '));
  const stem = w => w.length > 6 ? w.slice(0, w.length - 2) : w.length > 4 ? w.slice(0, w.length - 1) : w;
  const toks = q => U.norm(q).split(' ').filter(w => w.length > 1 && !STOP.has(w));
  /** Cik vaicājuma vārdu atrodas tekstā (pēc vārda sākuma) */
  function score(qt, text) {
    if (!qt.length) return 0;
    const words = text.split(' ');
    let s = 0;
    for (const t of qt) {
      const st = stem(t);
      if (words.some(w => w === t)) s += 2;
      else if (words.some(w => w.startsWith(st) || (w.length > 3 && st.startsWith(stem(w))))) s += 1.4;
      else if (t.length > 2 && text.includes(t)) s += 0.6;
    }
    return s / qt.length;
  }
  const isQuestion = q => /\?$/.test(q.trim()) || /^(ka|kur|ko|kas|kapec|vai|kad|kuru|kura|palidz)\b/.test(U.norm(q));

  /* --- Meklēšana datos --- */
  function search(q) {
    const qt = toks(q), out = [];
    if (!qt.length) return out;
    const all = qt.join(' ');
    const help = HELP.map(h => ({ h, s: score(qt, h.n) })).filter(x => x.s >= (isQuestion(q) ? 0.5 : 0.9)).sort((a, b) => b.s - a.s).slice(0, isQuestion(q) ? 3 : 2);
    help.forEach((x, i) => out.push({ g: 'Palīgs', i: 'chat', l: x.h.t, help: x.h, open: i === 0, s: 10 + x.s, run: x.h.go[1] }));
    if (S.db) {
      const pp = S.db.people.map(p => {
        const text = U.norm([U.full(p), U.sortName(p), D.groupOf(p), p.parentName, p.parent2Name].filter(Boolean).join(' '));
        return { p, s: score(qt, text) + (U.norm(U.full(p)).startsWith(all) ? 1 : 0) };
      }).filter(x => x.s >= 1).sort((a, b) => b.s - a.s || U.cmp(U.sortName(a.p), U.sortName(b.p))).slice(0, 8);
      for (const { p, s } of pp) out.push({ g: 'Personas', i: 'user', l: U.full(p) || 'Persona', sub: [D.groupOf(p), p.status === 'archived' ? 'arhīvā' : '', !D.inYear(p) ? 'nav šajā gadā' : ''].filter(Boolean).join(' · '), s: 5 + s, run: person(p.id) });
      const dd = (S.db.documents || []).map(d => { const p = D.person(d.personId); return { d, p, s: score(qt, U.norm([d.kind, d.title, d.path?.split('/').pop(), p && U.full(p)].filter(Boolean).join(' '))) }; })
        .filter(x => x.s >= 1).sort((a, b) => b.s - a.s || String(b.d.addedAt).localeCompare(String(a.d.addedAt))).slice(0, 6);
      for (const { d, p, s } of dd) out.push({ g: 'Dokumenti', i: 'file', l: (d.title || d.kind || 'Dokuments'), sub: [p && U.full(p), U.fmtDate(D.docDate(d))].filter(Boolean).join(' · '), s: 3 + s, run: p ? person(p.id, 'docs') : page('documents') });
      const ee = (S.db.events || []).map(e => ({ e, s: score(qt, U.norm([e.title, e.place, e.type === 'camp' ? 'nometne' : 'instruktaza pasakums'].filter(Boolean).join(' '))) }))
        .filter(x => x.s >= 1).sort((a, b) => b.s - a.s || String(b.e.dateFrom || b.e.instrDate).localeCompare(String(a.e.dateFrom || a.e.instrDate))).slice(0, 5);
      for (const { e, s } of ee) out.push({ g: 'Pasākumi', i: 'clipboard', l: e.title || (e.type === 'camp' ? 'Nometne' : 'Instruktāža'), sub: [e.type === 'camp' ? 'nometnes žurnāls' : 'instruktāža', U.fmtDate(e.dateFrom || e.instrDate)].filter(Boolean).join(' · '), s: 3 + s, run: act('formOpen', e.id) });
      const ff = (S.db.formDocs || []).map(f => ({ f, s: score(qt, U.norm(f.name || '')) })).filter(x => x.s >= 1).sort((a, b) => b.s - a.s).slice(0, 4);
      for (const { f, s } of ff) out.push({ g: 'Sagatavotās veidlapas', i: 'clipboard', l: f.name, sub: U.fmtDate(f.date), s: 2.5 + s, run: act('cfOpen', f.id) });
    }
    for (const it of [...ACTIONS, ...PAGES, ...CARDS]) { const s = score(qt, U.norm(it.l + ' ' + it.kw)); if (s >= 0.9) out.push({ ...it, s: (it.g === 'Darbības' ? 4 : 3.5) + s }); }
    const ORDER = ['Palīgs', 'Personas', 'Darbības', 'Sadaļas', 'Iestatījumi', 'Dokumenti', 'Pasākumi', 'Sagatavotās veidlapas'];
    // grupu secība: palīgs, ja jautājums; citādi pēc labākā rezultāta grupā
    const best = {}; for (const r of out) best[r.g] = Math.max(best[r.g] || 0, r.s);
    return out.sort((a, b) => (a.g === b.g ? b.s - a.s : (best[b.g] - best[a.g]) || ORDER.indexOf(a.g) - ORDER.indexOf(b.g)));
  }

  /* --- Logs --- */
  let items = [], sel = 0;
  const SUGGEST = () => [
    { g: 'Ieteikumi', i: 'chat', l: 'Uzdod jautājumu, piem., “kā pārcelt jaunsargus uz nākamo gadu?”', note: true },
    ...['Pievienot personu', 'Ievadīt anketu (nolasīt no attēla vai faila)', 'Jaunsarga kopsavilkums (PDF)', 'Mācību gada noslēgums (vednis)', 'Pārbaudīt datu veselību'].map(l => ({ ...ACTIONS.find(a => a.l === l), g: 'Ieteikumi' })),
  ];
  function dlg() {
    let d = U.$('cmdkDialog'); if (d) return d;
    d = document.createElement('dialog'); d.id = 'cmdkDialog'; d.className = 'cmdk';
    d.innerHTML = `<div class="cmdk-box"><div class="cmdk-top">${ic('search', '🔍')}<input id="cmdkQ" type="search" placeholder="Meklē personu, dokumentu, sadaļu… vai uzdod jautājumu" autocomplete="off" spellcheck="false" aria-label="Meklēt"><kbd>Esc</kbd></div>
      <div id="cmdkList" class="cmdk-list" role="listbox"></div>
      <div class="cmdk-foot small muted"><span>↑ ↓ izvēlēties · Enter atvērt</span><span class="grow"></span><span title="Atbildes ir iepriekš uzrakstītas rīka pamācībā; meklēšana notiek šajā datorā, nekas netiek sūtīts">Palīgs darbojas bez interneta · nav mākslīgais intelekts</span></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) { d.close(); return; } const b = e.target.closest('[data-cmdk]'); if (!b) return; e.stopPropagation(); e.preventDefault(); choose(Number(b.dataset.cmdk)); });
    d.querySelector('#cmdkQ').addEventListener('input', () => { sel = 0; paint(); });
    d.querySelector('#cmdkQ').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = items.length; if (!n) return; let i = sel; do { i = (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; } while (items[i].note && i !== sel); sel = i; mark(); }
      else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); choose(sel); }
    });
    return d;
  }
  function paint() {
    const q = U.$('cmdkQ').value; items = q.trim() ? search(q) : SUGGEST();
    if (items[sel]?.note) sel = items.findIndex(x => !x.note);
    let g = '', h = '';
    items.forEach((it, i) => {
      if (it.g !== g) { g = it.g; h += `<div class="cmdk-g">${esc(g)}</div>`; }
      if (it.note) { h += `<div class="cmdk-note small muted">${ic(it.i)}${esc(it.l)}</div>`; return; }
      h += `<button type="button" class="cmdk-it ${it.help ? 'help' : ''}" data-cmdk="${i}" role="option">${ic(it.i, '•')}<span class="grow"><b>${esc(it.l)}</b>${it.sub ? `<small class="muted"> · ${esc(it.sub)}</small>` : ''}
        ${it.help && it.open ? `<span class="cmdk-ans">${esc(it.help.a)}</span>` : ''}</span>${it.help ? `<span class="cmdk-go">${esc(it.help.go[0])} →</span>` : '<span class="cmdk-go">↵</span>'}</button>`;
    });
    if (q.trim() && !items.length) h = `<div class="cmdk-empty"><p><b>Nekas netika atrasts.</b></p><p class="small muted">Pamēģini citu vārdu (piem., personas uzvārdu, “instruktāža”, “rezerves kopija”) vai uzdod jautājumu, sākot ar “kā” vai “kur”.</p></div>`;
    U.$('cmdkList').innerHTML = h; mark();
  }
  function mark() {
    U.qsa('#cmdkList .cmdk-it').forEach(b => { const on = Number(b.dataset.cmdk) === sel; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) b.scrollIntoView({ block: 'nearest' }); });
  }
  function choose(i) {
    const it = items[i]; if (!it || it.note || !it.run) return;
    U.$('cmdkDialog').close();
    U.qsa('dialog[open]').forEach(d => { if (d.id !== 'cmdkDialog') try { d.close(); } catch (e) { /* */ } });
    it.run();
  }
  A.cmdk = q => {
    const d = dlg(); if (!d.open) d.showModal();
    const inp = U.$('cmdkQ'); inp.value = typeof q === 'string' ? q : ''; sel = 0; paint(); inp.focus();
  };
  CP.noRootOk && (() => { const o = CP.noRootOk; CP.noRootOk = a => a === 'cmdk' || o(a); })();
  // Ctrl+K atver meklēšanu (agrāk — sānjoslas meklēšanas lauku; “/” to joprojām dara)
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopImmediatePropagation(); const d = U.$('cmdkDialog'); if (d?.open) d.close(); else A.cmdk(); }
  }, true);
  /* Poga augšējā joslā */
  function paintBtn() {
    const sb = U.$('search'); if (sb && sb.placeholder.includes('Ctrl+K')) sb.placeholder = sb.placeholder.replace('Ctrl+K', '/');   // Ctrl+K tagad — meklēšana pa visu rīku
    const bar = document.querySelector('.yearbar'); if (!bar || U.$('cmdkBtn')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'cmdkBtn'; b.className = 'cmdk-btn'; b.dataset.act = 'cmdk';
    b.title = 'Meklēt pa visu rīku un uzdot jautājumu palīgam (Ctrl+K)';
    b.innerHTML = `${ic('search', '🔍')}<span>Meklēt vai jautāt</span><kbd>Ctrl K</kbd>`;
    bar.insertBefore(b, U.$('yearPick'));
  }
  CP.afterRender = CP.afterRender || []; CP.afterRender.push(paintBtn);
  CP.assist = { search, HELP, open: A.cmdk };
})(window.CP);
