/* =====================================================================
   Jaunumi — atjauninājumu žurnāls lietotājam.
   Pēc atjauninājuma, pirmo reizi atverot rīku, tiek parādīti jaunumi kopš
   iepriekš redzētās versijas. Pilns saraksts: “Par rīku” → Atjauninājumu žurnāls.
   Jauns ieraksts → saraksta SĀKUMĀ (jaunākais pirmais).
   ===================================================================== */
(function (CP) {
  'use strict';
  const U = CP.util, S = CP.state, esc = U.esc;
  /* Bloki pa funkcijām lietotāja valodā. v — pēdējā versija, kurā bloks mainījies, from — pirmā.
     Jaunumu logā tiek rādīti bloki, kuru v ir jaunāka par iepriekš redzēto versiju.
     NOTEIKUMI: viens bloks — viena funkcija; tikai tas, ko lietotājs pamana un var izmantot.
     Sīkus labojumus un atkārtotus tās pašas lietas labojumus NEraksta atsevišķi — papildina esošo
     bloku (palielina v) vai neraksta vispār. Tehniskās detaļas — tikai CHANGELOG.md. */
  const NEWS = [
    { v: '1.44.2', from: '1.43.0', date: '2026-10-17', title: 'Pasākumi un to dokumenti', items: [
      'Apmeklējumā blakus “＋ Nodarbība” ir **“＋ Pasākums”** (pasākums, nometne, sacensības) ar nosaukumu, datumiem no–līdz un grupu. Atzīmē, kuri **piedalījās**, un turpat pie katra pievieno **Vecāku atļauju**, nometnei **Dalībnieka aptaujas lapu** vai citu dokumentu. Kopīgie — **Kopējā parakstu lapa**, **aizpildīts nometnes žurnāls**, citi.',
      'Pasākumi nav nodarbības: tie **neietekmē apmeklējuma %**, ir atsevišķā cilnē **“Pasākumi”** (ar trūkstošo dokumentu skaitu), mēneša tabulā pasākuma datums ir **kolonna ar ★** arī tad, ja rādītas tikai nodarbību dienas — tajā atzīmē, kas piedalījās. Pievienojot dalībniekam vecāku atļauju vai citu dokumentu, viņš pasākumā **atzīmējas automātiski** (atzīmi var mainīt). No pasākuma ar vienu pogu var sagatavot **instruktāžas lapu vai nometnes žurnālu** ar tiem pašiem dalībniekiem. Dokumenti redzami arī jaunsarga kartītē.'
    ] },
    { v: '1.42.0', from: '1.41.0', date: '2026-10-17', title: 'Mācību gadi: pārcelšana un dzēšana', items: [
      'Iestatījumos → Mācību gadi poga **“⇄ Pārcelt dalībniekus uz citu gadu”**: izvēlies, no kura uz kuru gadu, un **atzīmē, kurus pārcelt** (aktīvie atzīmēti jau sākumā). **Nepārceltos** var uzreiz pārvietot uz arhīvu. Katram paliek sava grupa (vai norādi jaunu visiem). Līgums, anketa, MTL aprites lapas (arī iepriekšējās) un neatdotais ekipējums pieder personai un paliek spēkā arī jaunajā gadā; **ārsta izziņa** derīga tikai savā mācību gadā — sarakstā redzams, kam vajadzēs jaunu.',
      'Iestatījumos → Mācību gadi pie gada ir poga **“✕ Dzēst”**. Tukšu gadu dzēš pēc apstiprinājuma; ja gadā ir dalības, nodarbības, pasākumi vai VFS testi, rīks vispirms jautā, **uz kuru gadu tos pārcelt**. Izvēlēto un pašreizējo gadu dzēst nevar.',
      'CADET.LV logo galvenē ir loga vidū, un izvēlētais gads gadu sarakstā iekrāsots **akcenta krāsā**.'
    ] },
    { v: '1.40.1', from: '1.19.0', date: '2026-10-17', title: 'Dokumenti un reģistrācija', items: [
      'Poga **“Atvērt”** parāda dokumentu tieši rīkā — arī **Word (.docx)**, **eDoc** (redzams parakstītais saturs), Excel (.xlsx) un CSV. Lejupielādēt vairs nav jāiet. **“Pārbaudīt”** uzreiz pārslēdz dokumenta nozīmi uz **“Pārbaudīts”** (fails ir vietā un nav mainījies).',
      'Kartītes Dokumentu cilnē pirmie ir **“Visi personas dokumenti”**. Sadaļas “Dokumentu mape” un “Mapē atrasti faili” sākumā ir aizvērtas — atver, ja vajag; izejot no kartiņas, tās atkal aizveras.',
      'Pie katra dokumenta redzams, **kur tas atrodas datorā** (datu mape › Macibu_gadi › gads › Personas › personas mape › fails). Pēc pārcelšanas uz jaunu mācību gadu dokumenti paliek iepriekšējā gada mapē un turpina atvērties; “Dokumentu mapē” var pārslēgt gadu. Failus var sakārtot apakšmapēs ar **“Jauna mape”** un **“Pārvietot”**, un lieko failu vai apakšmapi var **dzēst** tieši rīkā (“✕ Dzēst”). Poga “Pārdēvēt” noņemta — Chrome to neļauj.',
      'Katru mapē esošu, vēl nepiesaistītu failu var **piesaistīt** — tad tas redzams sadaļā “Visi personas dokumenti”. Ir jauna kategorija **“Paskaidrojums”**; kategorijai **“Cits”** jāieraksta dokumenta nosaukums, un kartītē redzams tieši tas.',
      'Ārsta izziņai rīks aprēķina **derīgumu** un laikus atgādina. Dokumentus var atvērt, labot, aizstāt un dzēst tieši kartītē.',
      'Obligātajiem dokumentiem jābūt **skenētiem failiem** (tos liek arī DVS) — dokuments “tikai papīrā” netiek uzskatīts par iesniegtu. Pie agrāk reģistrētajiem papīra dokumentiem ir poga **“＋ Fails”** skenējuma pievienošanai. Pēc faila pievienošanas uzreiz atveras dokumenta dati, kur var ierakstīt piezīmi (piem., kur glabājas ārsta izziņas papīrs).',
      '**DVS reģistrāciju** atzīmē pa dokumentiem ar datumu; ir arī atzīme “ievadīts e-klasē”. Personu sarakstā to var atzīmēt vairākiem uzreiz. Dokuments, kas vēl **nav saņemts**, sadaļā “Reģistrācija un arhīvs” ir **sarkans** ar pogu “＋ Fails”, un, mēģinot to atzīmēt DVS vai arhīvā, rīks brīdina.'
    ] },
    { v: '1.40.0', date: '2026-10-17', title: 'Signal', items: [
      'Ziņu var sūtīt arī ar **Signal** — kartītē pie kontakta poga “Signal”, ziņas logā un grupas ziņā kanāls “Signal”. Signal neļauj saitē ielikt tekstu, tāpēc rīks to **nokopē**: sarakstē to ielīmē ar Ctrl+V. Iestatījumos (Saziņa) var izvēlēties, vai atvērt Signal Desktop lietotni tieši.'
    ] },
    { v: '1.39.0', date: '2026-10-17', title: 'Pārlūka atļaujas', items: [
      'Iestatījumos jauna cilne **“Atļaujas”**: datu mape, papildu dokumentu mapes, kopijas mape, Google konts, uznirstošie logi un paziņojumi — katram redzams stāvoklis un kas bez tā nestrādās.',
      'Trūkstošu atļauju var **atļaut ar pogu**; Google kontu var **atvienot**. Kā atņemt vai atjaunot pārlūkā bloķētu atļauju — aprakstīts turpat. Ja kādas vajadzīgas atļaujas nav, cilnē redzams ⚠.'
    ] },
    { v: '1.38.7', from: '1.28.0', date: '2026-10-17', title: 'Šifrētā rezerves kopija', items: [
      'Viss datu mapes saturs tiek **šifrēts** un saglabāts **tieši Google Drive** (mapē CADET_PERSONĀLS_ATJAUNOŠANA) vai citā mapē. Kopija papildinās automātiski, kamēr rīks ir atvērts.',
      'Pazaudējot datoru, visu var atjaunot ar paroli vai **atkopšanas kodu**. Kodu izdrukā, pieraksti vai **saglabā failā** (piem., zibatmiņā) un glabā drošā vietā. Google neredz ne vārdus, ne failu nosaukumus.',
      'Kopijas parolei jābūt **drošai**: vismaz 12 zīmes un 3 no 4 — mazie, lielie burti, cipari, simboli (vai garāka frāze no 4+ vārdiem), bez secībām kā 1234 un bez sava vārda. Rakstot redzams, kas vēl jāuzlabo.'
    ] },
    { v: '1.38.0', date: '2026-10-16', title: 'Pilngadība un 21 gads: līgumi', items: [
      '**60 dienas pirms 18. dzimšanas dienas** rīks atgādina, ka jāslēdz **jauns līgums ar jaunsargu**. Brīdinājums redzams jaunsarga kartītē un Uzdevumos, līdz līgums ir; pēc dzimšanas dienas tas kļūst sarkans. Vecāku dati kartītē paliek.',
      'Kartītē poga **“Sagatavot līgumu ar jaunsargu”**. Saglabājot jauno līgumu, rīks piedāvā **arhivēt veco līgumu** ar pārstāvi; arhivēt var arī ar 🗄 pie līguma. Ja līgums noslēgts ārpus rīka — **“✓ Līgums noslēgts”**.',
      'Tāpat **60 dienas pirms 21 gada** — brīdinājums, ka līgums beigsies, ar pogu **“Arhivēt”**.',
      'Atverot rīku, uznirstošajā paziņojumā par katru jaunsargu tas parādās ne vairāk kā **3 reizes**; kartītē un Uzdevumos — līdz atrisināts.'
    ] },
    { v: '1.37.4', from: '1.37.0', date: '2026-10-16', title: 'Rīka sagatavošana darbam', items: [
      'Pārskatā ir saraksts **“Sagatavo rīku darbam”**: datu mape, instruktora dati, PIN kods, rezerves kopija Google Drive, grupas, obligātie dokumenti un pirmais jaunsargs. Pie katra soļa ir poga, kas aizved uz īsto vietu.',
      'Pie pogām **“Bloķēt rīku”** un **“Saglabāt”** vienmēr redzams stāvoklis: **✓ Rīks iestatīts** vai **✕** ar progresu. Uzspiežot uz tā, saraksts atveras.',
      '**Iestatījumi** ir sadalīti cilnēs: Pamata, Drošība un kopijas, Dokumenti, Saziņa.',
      '**Instruktora darba dati** (tie nonāk līgumos) ir Iestatījumos → Pamata. E-pastam jābūt darba adresei **…@jc.gov.lv**.',
      'Vārdi, uzvārdi un vietu nosaukumi automātiski sākas ar **lielo burtu**. **Arhīvs** ir atsevišķa lapa ar visiem arhivētajiem no visiem mācību gadiem.'
    ] },
    { v: '1.37.0', date: '2026-10-16', title: 'Datu kvalitāte, 21 gads un darbs uz diviem datoriem', items: [
      'Lapa **“Datu kvalitāte”** (atver no brīdinājuma Pārskatā) parāda, kas jāsakārto: iespējami dublikāti, nederīgs personas kods, trūkst dzimuma, pārstāvja vai tālruņa, nederīgs e-pasts, nav grupas, nav atrasts dokumenta fails.',
      '**Divi datori:** otrā datorā izvēlies “Atjaunot no kopijas…”, un tas izmantos to pašu Google Drive kopiju. Ja otrā datorā ir jaunāki dati, augšā parādās josla **“Ielādēt”** — nekas netiek pārrakstīts bez tavas izvēles.',
      'Lielais pulkstenis pēc prombūtnes atkal pareizi skaita **darba laiku**.'
    ] },
    { v: '1.36.3', from: '1.36.0', date: '2026-10-16', title: 'Datu glabāšanas termiņi', items: [
      '**Iestatījumi → Drošība un kopijas → Datu glabāšanas termiņi**: cik ilgi glabāt izstājušos jaunsargu, kandidātu, ārsta izziņu, saziņas un citu vienību dalībnieku datus. Noklusējumi ir pēc VDAR, un tos var mainīt.',
      'Kad termiņš beidzies, Pārskatā parādās atgādinājums. Lapā **“Glabāšanas termiņi”** izvēlies, ko **anonimizēt** vai dzēst — rīks pats neko nedzēš. Anonimizējot paliek tikai statistika.',
      'Sānjoslā zem datu mapes redzams, vai dati ir **sinhronizēti ar Google Drive**, un, ja nav, — poga “Iestatīt” vai “Pieslēgties”.'
    ] },
    { v: '1.36.2', from: '1.36.1', date: '2026-10-16', title: 'VFS nozīmītes ekipējumā', items: [
      'Izsniegtā VFS sporta nozīmīte parādās jaunsarga **ekipējumā** un ir jāatdod. Ja tā ir dāvinājums, spied **“🎁 Dāvināt”** — tad to atdot nevajag. Tas der arī citiem priekšmetiem.'
    ] },
    { v: '1.35.0', date: '2026-10-16', title: 'Dokumentu nodošana Centra arhīvam', items: [
      'Kartītē **“Reģistrācija un arhīvs”** var atzīmēt, ka anketas un līguma oriģināli **nodoti Centra arhīvam**, ar datumu. Ja saņemts dokuments vēl nav nodots, ir brīdinājums.',
      'Personu sarakstā atlasītajiem var atzīmēt visu uzreiz: **“✓ Arhīvam”**. Dokumentu sarakstu maina Iestatījumos → Dokumenti.'
    ] },
    { v: '1.34.1', from: '1.34.0', date: '2026-10-16', title: 'VFS testi un sporta nozīmītes', items: [
      'Sadaļa **“VFS”**: fiziskās sagatavotības testi pēc JC normatīviem. Pakāpe pēc vecuma testa dienā, **punkti tiek aprēķināti uzreiz**, sporta nozīmīte (bronza, sudrabs, zelts) — automātiski un arī kvalifikācijās.',
      '**Protokols (PDF)** un **nozīmīšu uzskaite (Excel)** oficiālajās veidnēs. Agrāko gadu Word protokolus var importēt.',
      'Jaunsarga kartītē cilne **“VFS”** ar rezultātiem un dinamiku. Personai ir jauns lauks **“Dzimums”**.'
    ] },
    { v: '1.33.0', date: '2026-10-16', title: 'Darbību žurnāls', items: [
      'Lapa **“Darbību žurnāls”** rāda visas izmaiņas datos: kas mainīts, no kā uz ko un kad. Iepriekšējo vērtību vai dzēstu ierakstu var **atjaunot**.',
      'Atver no Pārskata → “Pēdējās izmaiņas” vai no personas kartītes → Vēsture.'
    ] },
    { v: '1.32.2', from: '1.32.0', date: '2026-10-16', title: 'CADET.LV', items: [
      'CADET PERSONĀLS ir daļa no **CADET.LV** rīku saimes — logo rīka augšā ved uz cadet.lv.'
    ] },
    { v: '1.31.3', from: '1.31.0', date: '2026-10-16', title: 'Ekrāna bloķēšana ar PIN kodu', items: [
      'Ja rīku nelieto (noklusēti 5 min), ekrānu aizsedz lielais pulkstenis, un jaunsargu dati nav redzami. Ar **PIN kodu** to atbloķē tikai tu; PIN prasa arī, atverot rīku.',
      'Bloķēt uzreiz: poga **“🔒 Bloķēt rīku”** Pārskatā vai **Ctrl+Shift+L**. Aizmirstot PIN, kodu var saņemt e-pastā.'
    ] },
    { v: '1.30.1', from: '1.30.0', date: '2026-10-16', title: 'Sadaļa “Ziņot”', items: [
      'Sadaļā **“⚑ Ziņot”** var nosūtīt izstrādātājam kļūdu, ieteikumu vai jautājumu ar ekrānuzņēmumu. Personu datus attēlā var **aizklāt** pirms sūtīšanas.'
    ] },
    { v: '1.27.1', from: '1.27.0', date: '2026-10-16', title: 'Dalībnieki no citām vienībām', items: [
      'Instruktāžas lapā un nometnes žurnālā var iekļaut **jaunsargus no citām vienībām**: ievelc otra instruktora atsūtīto failu vai aizpildītu Excel veidni. Viņi glabājas tikai šajā pasākumā.'
    ] },
    { v: '1.26.3', from: '1.24.0', date: '2026-10-16', title: 'Grupas un pārskats', items: [
      'Pārskata kartītē **Grupas** var izveidot, pārdēvēt un dzēst grupas (personas netiek dzēstas). Personas formā grupu izvēlas no saraksta vai izveido jaunu.',
      'Pārskata kartītes ir sakārtotas kolonnās bez tukšām vietām.'
    ] },
    { v: '1.26.1', from: '1.22.0', date: '2026-10-16', title: 'Grafiks', items: [
      'Sadaļa **Grafiks**: darba kalendārs (mēnesis, nedēļa, saraksts) ar nodarbībām, pasākumiem, nometnēm un **atgādinājumiem**. Notikumus var atkārtot katru nedēļu.',
      'Grafiku var **importēt no darba uzskaites Excel** (.xlsm). Atkārtots imports parāda, kas jauns un kas mainīts.',
      '**Google kalendārs**: grafiks redzams arī telefonā. Bez Google — lejupielāde .ics failā. Ir arī stundu kopsavilkums par mēnesi.'
    ] },
    { v: '1.21.1', from: '1.21.0', date: '2026-10-15', title: 'Apmeklējums un kvalifikācijas', items: [
      'Sadaļa **Apmeklējums**: mēneša tabula ar atzīmēm (+, n, k, a, s), ko var likt ar peli vai tastatūru, drukājama veidlapa un apmeklējuma rādītāji ar dinamiku.',
      'Brīdinājums, ja jaunsargs nav bijis **3 nodarbības pēc kārtas**. Kvalifikācijas (piem., Pamatnometne) un uzvedības ieraksti personas kartītē.'
    ] },
    { v: '1.18.3', from: '1.14.0', date: '2026-10-15', title: 'Veidlapas un līgumi', items: [
      'Sadaļā **Veidlapas** sagatavo **instruktāžas lapu** un **nometnes žurnālu** drukāšanai un **līgumu par dalību Jaunsardzē** Word formātā — dati aizpildās no kartītes.',
      'Visas veidlapas ir vienā sarakstā ar filtriem. Var izmantot arī savas Word veidnes.',
      'Ja iznāk jauna rīka versija, kamēr strādā, rīks par to paziņo.'
    ] },
    { v: '1.16.1', from: '1.14.1', date: '2026-10-13', title: 'Personas, piezīmes un imports', items: [
      'Statusi: **Kandidāts, Jaunsargs, Pārtraukts**. Piezīmes ir žurnāls ar datumiem.',
      'Personas var **importēt no e-klases** vai sava Excel saraksta.'
    ] },
    { v: '1.13.0', from: '1.11.0', date: '2026-10-13', title: 'Izskats un pulkstenis', items: [
      'Gaišā un tumšā tēma un akcenta krāsa: Iestatījumi → Izskats.',
      'Pārskatā pulkstenis ar hronometru un taimeri; rīks atgādina paņemt pauzi.'
    ] }
  ];
  CP.NEWS = NEWS;
  const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const KEY = 'cp-news-seen';
  const getSeen = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const setSeen = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* */ } };

  const block = n => `<section class="news-item"><h4>${esc(n.title)} <small class="muted">${esc(n.from ? n.from + '–' + n.v : n.v)} · ${esc(U.fmtDate(n.date))}</small></h4><ul>${n.items.map(i => `<li>${md(i)}</li>`).join('')}</ul></section>`;
  function show(list, title = 'Jaunumi rīkā') {
    let d = U.$('newsDialog');
    if (!d) { d = document.createElement('dialog'); d.id = 'newsDialog'; d.className = 'wide'; document.body.appendChild(d); }
    d.innerHTML = `<header class="dlg-head"><h2>${CP.ic('bell', '🔔')} ${esc(title)}</h2><button type="button" class="ghost" data-close="newsDialog" aria-label="Aizvērt">✕</button></header>
      <div class="dlg-body news">${list.map(block).join('')}</div>
      <footer class="dlg-foot"><button type="button" class="ghost" data-act="newsAll">Visi atjauninājumi</button><span class="grow"></span><button type="button" class="mainbtn" data-close="newsDialog">Sapratu</button></footer>`;
    if (!d.open) d.showModal();
  }
  CP.actions.newsAll = () => show(NEWS, 'Atjauninājumu žurnāls');
  /** Pēc atjauninājuma — vienreiz, kad dati ielādēti */
  let checked = false;
  function check() {
    if (checked || !S.root || !S.db || U.qs('dialog[open]')) return;
    checked = true;
    let seen = getSeen();
    if (!seen) {
      if (!(S.db.people || []).length) { setSeen(CP.VERSION); return; }   // jauns lietotājs — nav ko rādīt
      seen = '1.13.1';
    }
    const fresh = NEWS.filter(n => cmp(n.v, seen) > 0 && cmp(n.v, CP.VERSION) <= 0);
    if (!fresh.length) { setSeen(CP.VERSION); return; }
    // gaida, kamēr citi logi (piem., paziņojumi) aizvērti; par redzētu atzīmē tikai pēc parādīšanas
    let tries = 0;
    const tick = () => {
      if (U.qs('dialog[open]')) { if (++tries < 600) setTimeout(tick, 1000); return; }
      show(fresh, fresh.length === 1 ? `Jaunumi — ${fresh[0].v}` : 'Jaunumi kopš pēdējās reizes'); setSeen(CP.VERSION);
    };
    setTimeout(tick, 600);
  }
  CP.afterRender = CP.afterRender || [];
  CP.afterRender.push(check);
  CP.news = { show, list: NEWS, html: () => NEWS.map(block).join('') };
})(window.CP);
