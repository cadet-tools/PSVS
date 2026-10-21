/* =====================================================================
   Meklēšana pa visu rīku un palīgs.
   • Ctrl+K vai poga “Meklēt” augšējā joslā atver meklēšanas logu.
   • Atrod personas, dokumentus, pasākumus, sagatavotās veidlapas, sadaļas, iestatījumus un darbības.
   • Palīgs: jautājumi brīvā tekstā (“kā pievienot personu?”) — atbilde no rīka iebūvētās pamācības
     un soļi: palīgs pats atver vajadzīgo lapu, iezīmē pogu, uz kuras jāspiež, un pāriet uz nākamo soli.
     Ar personas vārdu (“Annai pievienot dokumentu”) — darbības tieši ar šo personu.
     Darbojas bez interneta, nekas netiek sūtīts.
     Tas NAV mākslīgais intelekts: atbildes ir iepriekš uzrakstītas, meklēšana — pēc atslēgvārdiem.
   ===================================================================== */
(function (CP) {
  'use strict';
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

  /* --- Palīga zināšanu bāze: jautājums → īsa atbilde + soļi.
     Solis: [teksts, navigācija (vai null), atlasītājs vietai, ko iezīmēt (vai null), { skip: () => bool }]
     Palīgs pats atver vajadzīgo lapu, iezīmē pogu/lauku un, kad uz tās uzspiež, pāriet uz nākamo soli. --- */
  const onPerson = () => S.page === 'person' && !!D.person(S.selected);
  const pickPerson = ['Atver personu — sānjoslā uzspied uz vārda (vai uzraksti vārdu meklēšanā).', null, '#sideList .person', { skip: onPerson }];
  const setTab = t => () => { S.setTab = t; ui.go('settings'); };
  const HELP = [
    { t: 'Kā pievienot jaunu personu?', kw: 'pievienot jauns persona jaunsargs kandidats cilveks izveidot ievadit kartite', a: 'Jaunu personu pievieno ar pogu “＋” sānjoslas augšā: ievadot ar roku, nolasot anketu vai pārņemot no cita instruktora.', steps: [
      ['Sānjoslas augšā spied zilo pogu “＋”.', null, '.aside-top [data-act=addPerson]'],
      ['Izvēlies, kā pievienot: “Ievadīt ar roku”, “Nolasīt anketu” vai “Pārņemt no cita instruktora”.', null, '#addPickDialog [data-act=addPersonNew]'],
      ['Aizpildi vārdu, uzvārdu, personas kodu (vecajā kodā dzimšanas datums aizpildās pats; jaunajā, kas sākas ar 32, atver kalendāru un ieraksti datumu) un grupu. Spied “Saglabāt”.', null, '#personDialog button.mainbtn[type=submit]'] ] },
    { t: 'Kā nolasīt anketu no attēla vai Word faila?', kw: 'anketa nolasit skenet foto attels ocr word pdf atpazit', a: 'Rīks nolasa anketu no Word, PDF vai fotogrāfijas. Atpazītie lauki parādās pārbaudes logā — kartītē nonāk tikai tas, ko apstiprini.', steps: [
      ['Sānjoslā spied “Ievadīt anketu”.', null, '.sidebtns [data-act=scan]'],
      ['Ievelc anketas failu vai fotogrāfiju logā (vai spied, lai izvēlētos failu).', null, '#scanDialog .scan-head'],
      ['Pārbaudi laukus: dzeltenie jāpārbauda. Spied “Saglabāt” — vai “Saglabāt un nākamā”, ja anketu ir vairāk.', null, '#scanDialog [data-act=scanSave]'] ] },
    { t: 'Kā importēt sarakstu no Excel vai e-klases?', kw: 'imports excel csv eklase saraksts ielādēt daudz personu tabula', a: 'Imports pievieno daudzas personas uzreiz no Excel/CSV vai e-klases eksporta. Esošās personas tiek atpazītas un netiek dublētas.', steps: [
      ['Sānjoslā spied “Imports”.', null, '.sidebtns [data-act=import]'],
      ['Izvēlies failu. Pārbaudi, kura kolonna kuram laukam atbilst (vārds, uzvārds, kods, grupa…).', null, '#importDialog'],
      ['Apskati priekšskatījumu — atzīmētās rindas tiks pievienotas vai papildinātas. Apstiprini importu.', null, null] ] },
    { t: 'Kā pievienot personai dokumentu?', kw: 'dokuments pievienot fails pieteikums ligums atlauja augšupielādēt piesaistit skenets izzina', a: 'Dokumentu pievieno personas kartītes cilnē “Dokumenti”. Fails tiek nokopēts personas mapē; oriģināls netiek mainīts.', steps: [
      pickPerson,
      ['Atver cilni “Dokumenti”.', null, '.tabs [data-tab=docs]'],
      ['Spied “Pievienot skenētu dokumentu” (vai ievelc failu no datora tieši kartītē) un izvēlies dokumenta veidu, piem., “Līgums”.', null, '#main [data-act=attach], #main [data-act=docAddOpen]'] ] },
    { t: 'Kur redzēt, kam trūkst dokumentu?', kw: 'trukst dokumenti trukstosi obligatie nav iesniegts kam nav', a: 'Sadaļā Dokumenti ir saraksts “Trūkst” — kam un kuru obligāto dokumentu nav. Kuri ir obligāti, nosaka Iestatījumi → Dokumenti.', steps: [
      ['Atver Dokumentus un izvēlies “Trūkst”.', page('documents'), '[data-act=docsShow][data-arg=missing]'],
      ['Pie personas spied “Atvērt”, lai pievienotu dokumentu, vai sagatavo atgādinājumu vecākiem kartītē (“Atgādināt pārstāvim par trūkstošajiem”).', null, null] ] },
    { t: 'Kā atzīmēt nodarbības apmeklējumu?', kw: 'apmeklejums atzimet nodarbiba klatbutne kavejums zurnals klat nav', a: 'Apmeklējumā katrai grupai ir mēneša tabula. Jaunu nodarbību pievieno ar “＋ Nodarbība”, tad atzīmē klātesošos.', steps: [
      ['Atver Apmeklējumu un spied “＋ Nodarbība”.', page('attendance'), '[data-act=sessNew]'],
      ['Izvēlies grupu un datumu, atzīmē, kas bija (+ klāt, n — nav, a — attaisnots, statistikā tas pats kas n). Ar “Visi klāt” atzīmē visus uzreiz.', null, '[data-act=sessFill][data-arg=all]'],
      ['Saglabā. Tabulā vēlāk var labot jebkuru šūnu, uzspiežot uz tās.', null, null] ] },
    { t: 'Kā sagatavot drošības instruktāžu pasākumam?', kw: 'instruktaza drosiba pasakums parakstu lapa sagatavot', a: 'Veidlapās izveido instruktāžu: dalībnieki, datums, vieta, vadītājs — rīks sagatavo parakstu lapu PDF formātā.', steps: [
      ['Atver Veidlapas un spied “Instruktāža”.', page('forms'), '[data-act=formNew][data-arg=instr]'],
      ['Ieraksti pasākuma nosaukumu, datumu, vietu un vadītāju; sarakstā atzīmē dalībniekus (var atlasīt pēc grupas).', null, '[data-act=evPickAll]'],
      ['Spied “PDF”, lai skatītu un drukātu — kopija saglabājas datu mapē.', null, '[data-act=formPdf], [data-act=formPrint]'] ] },
    { t: 'Kā sagatavot nometnes žurnālu?', kw: 'nometne zurnals sagatavot nometnes audzinatajs', a: 'Veidlapās izveido nometnes žurnālu: dalībnieki, audzinātāji, datumi. Rīks aizpilda žurnālu.', steps: [
      ['Atver Veidlapas un spied “Nometnes žurnāls”.', page('forms'), '[data-act=formNew][data-arg=camp]'],
      ['Ieraksti datumus no–līdz, vietu, vadītāju; atzīmē dalībniekus un audzinātājus.', null, '[data-act=evPickAll]'],
      ['Spied “PDF”, lai skatītu un drukātu.', null, '[data-act=formPdf], [data-act=formPrint]'] ] },
    { t: 'Kā izmantot savu Word veidlapu?', kw: 'sava veidlapa word docx veidne atzimes vietturi aizpildit iesniegums', a: 'Savā Word dokumentā ieraksti atzīmes, piem., {Vārds} {Uzvārds} — rīks tās aizpilda katrai personai.', steps: [
      ['Veidlapās spied “⬆ Sava veidlapa” un izvēlies Word (.docx) failu.', page('forms'), '[data-act=tplDocAdd][data-arg=custom]'],
      ['Kādas atzīmes var lietot, redzi pogā “Pieejamās atzīmes”. Atzīmes var ielikt arī rīkā — pie veidnes poga “Rediģēt”.', null, '.tpl-tags-btn'],
      ['Lai aizpildītu, spied “Sava veidlapa” lapas augšā (vai “Aizpildīt…” pie veidnes), izvēlies personas un spied “Sagatavot”.', null, '.page-head [data-act=cfNew], [data-act=cfNew], [data-act=tplDocAdd][data-arg=custom]'] ] },
    { t: 'Kā izveidot jaunsarga kopsavilkumu?', kw: 'kopsavilkums raksturojums atskaite pdf jaunsargs gads vecakiem', a: 'Kopsavilkums ir PDF ar gada rādītājiem un tavu komentāru. Vairākām personām — katrai savs PDF, kopā ZIP failā.', steps: [
      ['Atver kopsavilkuma logu (vienai personai — kartītē ⋯ → “Kopsavilkums”).', act('sumNew'), '#sumDialog [data-sum=from]'],
      ['Izvēlies periodu, ko iekļaut un personas; pie katras var ierakstīt komentāru.', null, '#sumDialog .sum-inc'],
      ['Spied “Izveidot” — PDF saglabājas personas dokumentu mapē.', null, '#sumDialog .dlg-foot .mainbtn'] ] },
    { t: 'Kā nosūtīt ziņu vecākiem vai grupai?', kw: 'zina nosutit vecakiem whatsapp sms epasts grupa sazina rakstit', a: 'Saziņā izvēlies personas vai grupu un veidni. Rīks atver WhatsApp/e-pastu ar sagatavotu tekstu — nosūti pats.', steps: [
      ['Atver Saziņu.', page('comms'), '#main .page-head'],
      ['Izvēlies grupu vai atzīmē personas, izvēlies ziņas veidni un kanālu (WhatsApp, SMS, e-pasts, Signal).', null, null],
      ['Pie katras personas spied “Atvērt” — ziņa atveras ar gatavu tekstu; pēc nosūtīšanas atzīmē “Nosūtīts”.', null, '[data-act=commsOpen]'] ] },
    { t: 'Kā izsniegt vai saņemt atpakaļ ekipējumu?', kw: 'ekipejums izsniegt atdot sanemt formasterps inventars forma', a: 'Ekipējumā reģistrē, kas kuram izsniegts; kad atdod — atzīmē “Atdots”.', steps: [
      ['Atver Ekipējumu un spied “＋ Izsniegt”.', page('equipment'), '[data-act=addEq]'],
      ['Izvēlies personu, priekšmetu, izmēru un daudzumu. Saglabā.', null, null],
      ['Kad ekipējumu atdod, ierakstā spied “Atdots”.', null, '[data-act=returnEq]'] ] },
    { t: 'Kā pārcelt jaunsargus uz nākamo mācību gadu?', kw: 'parcelt nakamais macibu gads jauns gads turpina', a: 'Ērtākais ceļš — mācību gada noslēguma vednis (4. solis “Nākamais gads”). Var arī pa tiešo: gada izvēlnē pievieno gadu un pārcel dalībniekus.', steps: [
      ['Vednī atver soli “Nākamais gads”. Ja nākamā gada vēl nav, spied “Izveidot …”.', () => { A.yearEnd(); A.yeStep(3); }, '#yeDialog [data-act=yeAddNext], #yeDialog [data-arg="@move"]:not([disabled])'],
      ['Spied “Izvēlēties, kas turpina”.', null, '#yeDialog [data-arg="@move"]:not([disabled])', { skip: () => !!U.$('moveDialog')?.open }],
      ['Pārcelšanas logā atzīmē, kas turpina; pārējos var pārvietot uz arhīvu. Spied “Pārcelt”.', null, '#moveDialog [data-act=moveDo]'] ] },
    { t: 'Kā noslēgt mācību gadu?', kw: 'nosleguma vednis noslegt gadu beigas gada beigas vasara', a: 'Vednis soli pa solim: trūkstošie dokumenti → neatdotais ekipējums → kopsavilkumi → kas turpina → rezerves kopija → jaunais gads.', steps: [
      ['Atver vedni (arī: gada izvēlne augšā labajā stūrī → “Noslēgt mācību gadu…”).', act('yearEnd'), '#yeDialog .ye-steps'],
      ['Ej pa soļiem ar “Tālāk →”. Katru soli var atzīmēt kā izdarītu; progress saglabājas.', null, '#yeDialog .dlg-foot .mainbtn'] ] },
    { t: 'Kā izveidot rezerves kopiju?', kw: 'rezerves kopija backup saglabat kopija json', a: 'JSON kopija glabājas datu mapes apakšmapē _rezerves. Šifrētu kopiju var glabāt arī Google Drive vai citā mapē.', steps: [
      ['Iestatījumi → Drošība → spied “Izveidot JSON kopiju”.', card('dataCard'), '#dataCard [data-act=backupNow]'],
      ['Kopija parādās sarakstā “Rezerves kopijas”. Pārbaudi, vai to var atjaunot — poga kartītē “Datu veselība”.', card('healthCard'), '#healthCard [data-act=restoreCheck]'] ] },
    { t: 'Kā pārbaudīt, vai rezerves kopiju var atjaunot?', kw: 'parbaudit kopiju atjaunot restore vai strada kopija deriga', a: 'Pārbaude nolasa jaunāko kopiju un sagatavo to tāpat kā atjaunojot, tad salīdzina ar pašreizējiem datiem. Tavi dati netiek mainīti.', steps: [
      ['Iestatījumi → Drošība → “Datu veselība” → spied “Pārbaudīt jaunāko kopiju”.', card('healthCard'), '#healthCard [data-act=restoreCheck]'],
      ['Logā redzams, vai kopija ir derīga un cik tajā personu un dokumentu salīdzinājumā ar tagad.', null, '#restoreDialog'] ] },
    { t: 'Kā atjaunot datus no rezerves kopijas?', kw: 'atjaunot datus no kopijas pazudusi dati restore atgriezt pazuda', a: 'Atjaunošana aizvieto pašreizējos datus ar kopiju. Pirms tam rīks pats saglabā arī pašreizējo stāvokli, tāpēc to var atsaukt.', steps: [
      ['Iestatījumi → Drošība → saraksts “Rezerves kopijas”.', card('dataCard'), '#backupList'],
      ['Pie vajadzīgās kopijas (pēc datuma) spied “Atjaunot” un apstiprini.', null, '#backupList [data-act=restoreBackup]'] ] },
    { t: 'Kā pārbaudīt, vai datu fails nav bojāts?', kw: 'datu veseliba bojats fails parbaude kludas integritate', a: 'Datu veselības pārbaude notiek pati, atverot datu mapi. Kartītē redzams, kas pārbaudīts un ko katra piezīme nozīmē.', steps: [
      ['Iestatījumi → Drošība → “Datu veselība”. Spied “Pārbaudīt vēlreiz”.', card('healthCard'), '#healthCard [data-act=healthRun]'],
      ['Pie katras piezīmes atver “Ko tas nozīmē?”. Drošās kļūdas izlabo poga “Izlabot drošās kļūdas” (pirms tam tiek izveidota kopija).', null, '#healthCard .hc-list, #healthCard .okc'] ] },
    { t: 'Kā mainīt datu mapi vai pārnest datus uz citu datoru?', kw: 'datu mape mainit cits dators parnest usb kopet jauns dators', a: 'Uz citu datoru pārnes visu datu mapi (piem., ar USB) un tur izvēlies to rīkā. Var lietot arī šifrēto kopiju Google Drive.', steps: [
      ['Iestatījumi → Drošība → “Mainīt datu mapi”.', card('dataCard'), '#dataCard [data-act=pickRoot]'],
      ['Izvēlies mapi ar datu failu un atļauj “Rediģēt failus”.', null, null] ] },
    { t: 'Kā ielikt vienības logo un nosaukumu?', kw: 'logo vienibas nosaukums ielikt galvene', a: 'Logo redzams rīka augšējā joslā un pēc izvēles neoficiālos failos (kopā ar CADET.LV logo). Oficiālajās veidlapās logo netiek likts.', steps: [
      ['Iestatījumi → Pamata → “Vienība”: ieraksti vienības nosaukumu.', card('unitCard'), '#unitName'],
      ['Spied “Pievienot logo” un izvēlies attēlu (ieteicams PNG ar caurspīdīgu fonu).', null, '#unitCard label.btn'] ] },
    { t: 'Kā aizsargāt rīku ar PIN kodu?', kw: 'pin parole bloket aizsargat ekrans aizslegt', a: 'Ar PIN rīks bloķējas pēc neaktivitātes vai ar pogu, lai citi neredzētu personu datus.', steps: [
      ['Iestatījumi → Drošība → “Ekrāna bloķēšana”.', card('lockCard'), '#lockCard button'],
      ['Iestati PIN un laiku, pēc kura bloķēt.', null, null] ] },
    { t: 'Kur ir arhivētās personas?', kw: 'arhivs arhivetie bijusie izstajusies atjaunot personu', a: 'Arhivētās personas ir sadaļā “Arhīvs”; tās var atjaunot.', steps: [
      ['Atver sadaļu “Arhīvs”.', page('archive'), '#main .page-head'],
      ['Atver personu un kartītē spied “Atjaunot”.', null, null] ] },
    { t: 'Kā arhivēt vai izdzēst personu?', kw: 'dzest izdzest personu nonemt arhivet izstajas', a: 'Parasti personu arhivē (dati paliek, var atjaunot). Pilnīga dzēšana — kartītē ⋯ → “Dzēst” vai pēc glabāšanas termiņiem.', steps: [
      pickPerson,
      ['Kartītes augšā spied “⋯”.', null, '.person-head details.menu > summary'],
      ['Izvēlies “Arhivēt” (vai “Dzēst” — neatgriezeniski).', null, '.menu-list [data-act=archive]'] ] },
    { t: 'Kā atsaukt kļūdainu izmaiņu?', kw: 'atsaukt kluda izmaina atpakal vesture kas mainits', a: 'Darbību žurnālā redzams, kas un kad mainīts, un izmaiņas var atsaukt.', steps: [
      ['Atver Darbību žurnālu.', page('changes'), '#main .page-head'],
      ['Atrodi izmaiņu (var filtrēt pēc personas) un spied “Atsaukt”.', null, '[data-act=clUndo]'] ] },
    { t: 'Kā ievadīt VFS testa rezultātus?', kw: 'vfs fiziska sagatavotiba rezultati normativi nozime tests', a: 'VFS testā punkti un līmenis tiek aprēķināti automātiski; var izdrukāt protokolu.', steps: [
      ['Atver VFS testus un spied “＋ Jauns tests”.', page('vfs'), '[data-act=vfsNew]'],
      ['Ievadi datumu un katra dalībnieka rezultātus — punkti aprēķinās paši.', null, null] ] },
    { t: 'Kā pievienot ierakstu grafikā vai Google kalendārā?', kw: 'grafiks kalendars google nodarbibu laiks plans', a: 'Grafikā ir darba kalendārs ar atgādinājumiem; to var sinhronizēt ar Google kalendāru.', steps: [
      ['Atver Grafiku un spied “＋”.', page('schedule'), '[data-act=schNew]'],
      ['Ieraksti laiku un aprakstu. Google kalendāru pieslēdz grafika lapā.', null, null] ] },
    { t: 'Kur redzēt termiņus un atgādinājumus?', kw: 'termini atgadinajumi bridinajumi uzdevumi dzimsanas dienas', a: 'Sadaļa “Uzdevumi” apkopo termiņus, trūkstošos dokumentus, ekipējumu, dzimšanas dienas un 18/21 gadu brīdinājumus.', steps: [
      ['Atver Uzdevumus.', page('alerts'), '#main .card'],
      ['Pie ieraksta spied “Atvērt” vai “✓ Izpildīts”.', null, null] ] },
    { t: 'Kā ziņot par kļūdu vai ieteikt uzlabojumu?', kw: 'zinot kluda ieteikums atsauksme izstradatajs problema', a: 'Sadaļā “Ziņot” apraksti, kas notika; ekrānuzņēmumā personu datus var aizklāt.', steps: [
      ['Atver sadaļu “Ziņot”.', page('feedback'), '#main .page'],
      ['Izvēlies veidu, apraksti un spied “Nosūtīt”.', null, '[data-act=fbSend]'] ] },
    { t: 'Vai mani dati tiek sūtīti internetā?', kw: 'privatums dati internets drosi serveris sutiti', a: 'Nē. Personu dati glabājas tikai tavā datu mapē. Internetā iet tikai anonīma lietošanas statistika (var izslēgt Iestatījumi → Atļaujas) un tas, ko pats izvēlies (piem., šifrēta kopija).', steps: [
      ['Atļaujas un statistikas slēdzis — Iestatījumi → Atļaujas.', card('permsCard'), '#permsCard'] ] },
    { t: 'Kā mainīt tēmu vai krāsu?', kw: 'tema tumsa gaisa krasa izskats akcents', a: 'Tēmu un akcenta krāsu maina Iestatījumi → Pamata → “Izskats”.', steps: [
      ['Iestatījumi → Pamata → “Izskats”: izvēlies tēmu un krāsu.', setTab('base'), '[data-act=setTheme]'] ] },
    { t: 'Kā pievienot jaunu mācību gadu?', kw: 'jauns macibu gads pievienot gadu izveidot gadu', a: 'Gadu pievieno gada izvēlnē augšā labajā stūrī; gadu maiņa personas un dokumentus nepārvieto.', steps: [
      ['Augšā labajā stūrī spied “Mācību gads ▾”.', null, '#yearBtn'],
      ['Izvēlies “＋ Pievienot mācību gadu”.', null, '#yearMenu [data-act=openAddYear]'],
      ['Ieraksti sākuma gadu un apstiprini.', null, '#addYearDialog [data-act=addYearOk]'] ] },
  ].map(h => ({ ...h, n: U.norm(h.t + ' ' + h.kw) }));

  /* --- Darbības ar konkrētu personu: “Annai pievienot dokumentu”, “Kalniņa ekipējums” --- */
  const INTENTS = [
    { kw: 'dokument fail pievienot ligum anket izzin atlauj skenet', l: 'Pievienot dokumentu', i: 'file', run: p => guideOne(p, 'docs', 'Spied “Pievienot skenētu dokumentu” (vai ievelc failu no datora šajā kartītē), tad izvēlies dokumenta veidu. Trūkstošajiem obligātajiem — poga “＋ Fails” labajā pusē.', '#main [data-act=attach], #main [data-act=docAddOpen]') },
    { kw: 'trukst atgadin', l: 'Atgādināt vecākiem par trūkstošajiem dokumentiem', i: 'message', run: p => act('remindDocs', p.id)() },
    { kw: 'ekipej izsniegt forma atdot inventar', l: 'Ekipējums', i: 'backpack', run: p => guideOne(p, 'equipment', 'Personas ekipējums: izsniegt vai atzīmēt “Atdots”.', '#main [data-act=addEq], #main .card') },
    { kw: 'kopsavilk raksturoj atskait', l: 'Kopsavilkums (PDF)', i: 'chart', run: p => act('sumNew', p.id)() },
    { kw: 'zina whatsapp sms rakstit sazin vecak', l: 'Rakstīt ziņu', i: 'message', run: p => act('msg', p.id)() },
    { kw: 'labot rediget mainit dati kods adrese telefon', l: 'Labot datus', i: 'edit', run: p => act('edit', p.id)() },
    { kw: 'piezim vestur zvan ieraksts', l: 'Piezīmes un vēsture', i: 'list', run: p => guideOne(p, 'history', 'Šeit raksti jaunu ierakstu — Enter saglabā, Shift+Enter — jauna rinda.', '#noteText') },
    { kw: 'vfs normativ nozim', l: 'VFS rezultāti', i: 'award', run: p => person(p.id, 'vfs')() },
    { kw: 'aplieci', l: 'Jaunsarga apliecība', i: 'idcard', run: p => person(p.id, 'idcard')() },
    { kw: 'arhiv izstaj', l: 'Arhivēt', i: 'archive', run: p => act('archive', p.id)() },
    { kw: 'veidlap aizpild iesniegum', l: 'Aizpildīt savu veidlapu', i: 'clipboard', run: p => act('cfNew', '|' + p.id)() },
    { kw: 'nodot parnest cits instruktor', l: 'Nodot citam instruktoram', i: 'external', run: p => act('transferOut', p.id)() },
  ].map(x => ({ ...x, n: U.norm(x.kw + ' ' + x.l) }));
  const QUICK = ['Pievienot dokumentu', 'Ekipējums', 'Rakstīt ziņu', 'Piezīmes un vēsture', 'Kopsavilkums (PDF)'];
  /** Atver personas cilni un iezīmē vietu ar paskaidrojumu (viena soļa palīgs) */
  function guideOne(p, tab, text, sel) { guide({ t: U.full(p), steps: [[text, person(p.id, tab), sel]] }); }
  /* --- Vadītais palīgs: panelis ar soļiem; iezīmē vietu, uz kuras jāspiež --- */
  let G = null, hlEl = null, pollT = 0, hostT = 0;
  const clearHl = () => { hlEl?.classList.remove('cp-guide-hl'); hlEl = null; };
  const visible = el => !!el && el.isConnected && !el.closest('[inert],details:not([open]) > :not(summary)') && (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !!(el.offsetParent || el.getClientRects().length));
  const findSel = sel => { if (!sel) return null; const top = U.qsa('dialog[open]').at(-1); for (const s of sel.split(/\s*,\s*/)) { const xs = [...document.querySelectorAll(s)].filter(visible); const el = xs.find(x => !top || top.contains(x)) || xs[0]; if (el) return el; } return null; };
  function host() { const top = U.qsa('dialog[open]').filter(d => d.id !== 'cmdkDialog').at(-1) || document.body, p = U.$('cpGuide'); if (p && p.parentNode !== top) top.appendChild(p); }
  function guide(h) {
    if (!h?.steps?.length) return;
    G = { h, i: 0 }; while (G.i < h.steps.length - 1 && h.steps[G.i][3]?.skip?.()) G.i++;
    clearInterval(hostT); hostT = setInterval(host, 300);
    show();
  }
  function show() {
    clearHl(); clearTimeout(pollT);
    const [text, nav, sel] = G.h.steps[G.i], n = G.h.steps.length;
    let p = U.$('cpGuide'); if (!p) { p = document.createElement('div'); p.id = 'cpGuide'; p.className = 'cp-guide'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Palīgs'); document.body.appendChild(p); p.addEventListener('click', onPanel); }
    p.innerHTML = `<div class="cpg-head">${ic('chat', '💬')}<b class="grow">${esc(G.h.t)}</b><button type="button" class="ghost sm" data-g="x" aria-label="Aizvērt palīgu">✕</button></div>
      <ol class="cpg-steps">${G.h.steps.map((s, i) => `<li class="${i < G.i ? 'done' : i === G.i ? 'on' : ''}"><span class="cpg-n">${i < G.i ? '✓' : i + 1}</span><span>${esc(s[0])}</span></li>`).join('')}</ol>
      <div class="cpg-miss small muted" hidden></div>
      <div class="cpg-foot"><span class="small muted">${n > 1 ? `Solis ${G.i + 1} no ${n}` : ''}</span><span class="grow"></span>
        ${G.i ? '<button type="button" class="sm ghost" data-g="prev">← Atpakaļ</button>' : ''}${sel ? '<button type="button" class="sm ghost" data-g="show">Parādīt vēlreiz</button>' : ''}
        <button type="button" class="sm mainbtn" data-g="next">${G.i < n - 1 ? 'Tālāk →' : 'Gatavs'}</button></div>`;
    host();
    if (nav) { try { nav(); } catch (e) { console.warn(e); } }
    if (sel) seek(sel, Date.now());
  }
  function seek(sel, t0) {
    const el = findSel(sel);
    if (el) { hlEl = el; el.classList.add('cp-guide-hl'); try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } const m = U.qs('#cpGuide .cpg-miss'); if (m) m.hidden = true; return; }
    if (Date.now() - t0 > 6000) { const m = U.qs('#cpGuide .cpg-miss'); if (m) { m.hidden = false; m.textContent = !S.root ? 'Šī vieta parādās, kad ir atvērta datu mape.' : 'Vieta vēl nav redzama — izpildi iepriekšējo soli vai spied “Parādīt vēlreiz”.'; } return; }
    pollT = setTimeout(() => seek(sel, t0), 200);
  }
  function step(d) {
    if (!G) return; const n = G.h.steps.length;
    if (d > 0 && G.i >= n - 1) return end(true);
    G.i = Math.max(0, Math.min(n - 1, G.i + d));
    if (d > 0) while (G.i < n - 1 && G.h.steps[G.i][3]?.skip?.()) G.i++;
    show();
  }
  function end(done) {
    clearHl(); clearTimeout(pollT); clearInterval(hostT); U.$('cpGuide')?.remove();
    if (done && G) ui.toast('✓ ' + G.h.t.replace(/\?$/, '') + ' — gatavs. Palīgu var atvērt ar Ctrl+K.', 'ok', 4000);
    G = null;
  }
  function onPanel(e) {
    const b = e.target.closest('[data-g]'); if (!b) return; e.preventDefault(); e.stopPropagation();
    const g = b.dataset.g; if (g === 'x') end(false); else if (g === 'next') step(1); else if (g === 'prev') step(-1); else if (g === 'show') show();
  }
  // uzspiežot uz iezīmētās vietas — nākamais solis
  document.addEventListener('click', e => {
    if (!G || !hlEl || !hlEl.contains(e.target) || e.target.closest('#cpGuide')) return;
    if (!hlEl.matches('button,a,summary,label,[data-act],[data-tab],[data-page],[data-person],.person')) return;
    const i = G.i; setTimeout(() => { if (G && G.i === i) step(1); }, 450);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && G && !U.qs('dialog[open]')) end(false); });

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
    help.forEach((x, i) => out.push({ g: 'Palīgs', i: 'chat', l: x.h.t, help: x.h, open: i === 0, s: 10 + x.s, run: () => guide(x.h) }));
    if (S.db) {
      // persona vaicājumā (arī locījumā: “Annai”, “Kalniņam”) + ko ar to darīt
      const nameHit = (p, t) => { if (t.length < 3) return false; const st = stem(t); return U.norm(U.full(p)).split(' ').some(w => w === t || (w.length > 2 && (w.startsWith(st) || t.startsWith(w)))); };
      const cand = S.db.people.map(p => { const used = qt.filter(t => nameHit(p, t)); return { p, used, s: used.length }; }).filter(x => x.s).sort((a, b) => b.s - a.s || (D.inYear(b.p) - D.inYear(a.p)));
      const top = cand[0];
      if (top && (cand.length === 1 || cand[1].s < top.s || qt.length === top.s)) {
        const rest = qt.filter(t => !top.used.includes(t)), p = top.p;
        const hits = rest.length ? INTENTS.map(x => ({ x, s: score(rest, x.n) })).filter(y => y.s >= 0.7).sort((a, b) => b.s - a.s).slice(0, 3) : [];
        const list = hits.length ? hits.map(h => h.x) : (cand.length === 1 || !rest.length ? QUICK.map(l => INTENTS.find(x => x.l === l)) : []);
        list.forEach((x, k) => out.push({ g: 'Persona: ' + U.full(p), i: x.i, l: x.l, sub: k === 0 && hits.length ? U.full(p) : '', s: (hits.length ? 12 : 6) - k * 0.01, run: () => x.run(p) }));
      }
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
        ${it.help && it.open ? `<span class="cmdk-ans">${esc(it.help.a)}</span><ol class="cmdk-steps">${it.help.steps.map(st => `<li>${esc(st[0])}</li>`).join('')}</ol>` : ''}</span>${it.help ? `<span class="cmdk-go">Parādīt, kur →</span>` : '<span class="cmdk-go">↵</span>'}</button>`;
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
  A.helpGuide = i => guide(HELP[Number(i)]);
  CP.assist = { search, HELP, INTENTS, guide, end: () => end(false), open: A.cmdk, current: () => G && { t: G.h.t, i: G.i, n: G.h.steps.length, hl: !!hlEl } };
})(window.CP);
