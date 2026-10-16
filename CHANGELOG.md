# Izmaiņu vēsture

## 1.29.0 — 2026-10-16 — Rezerves kopija tieši Google Drive
- Jauns modulis `js/google.js` (`CP.google`): kopīga OAuth “token” plūsma (uznirstošais logs → `oauth.html` → BroadcastChannel) kalendāram (`calendar.app.created`) un Drive (`drive.file`), `include_granted_scopes`; atļauja glabājas tikai cilnes `sessionStorage` (~1 h). Client ID arī `localStorage` (`cp.gClientId`), lai atjaunotu bez datu mapes. `schedule.js` izmanto `CP.google`.
- Josla `#gBanner` (testa vides joslas stilā): moduļi reģistrē `CP.google.needs` → parādās, ja savienojums beidzies un ir ko sūtīt (rezerves kopija ar nenosūtītu revīziju; kalendārs ar nesinhronizētiem notikumiem). “Pieslēgties” → jauna atļauja → `onToken` āķi nosūta uzreiz; ✕ paslēpj uz 30 min.
- `CP.google.drive`: list/children/findFolders/mkdir/put (multipart ≤ 4,5 MB, lielākiem resumable)/get/meta/del; atkārtošana pie 429/5xx; skaidrs ziņojums, ja Drive API nav ieslēgts.
- `encbackup.js`: glabātuvju abstrakcija `localStore` / `driveStore` ar vienu struktūru (`CADET_rezerve/KOPIJA.json`, `ATJAUNOT.html`, `dati/<id>.bin`). Iestatījums `{ kind: 'drive', folderId }` vai līdzšinējais `{ dir }`. Mainīts fails vienmēr iet jaunā blobā; vecie un pārtraukto kopiju blobi tiek dzēsti tikai pēc `KOPIJA.json` saglabāšanas. Drive augšupielāde/lejupielāde paralēli (4).
- Atjaunošana: izvēle Google Drive (Client ID → pieslēgšanās → atrod rīka izveidotās `CADET_rezerve` mapes; vairākām — izvēle) vai mape. Atkopšanas koda izdrukā Drive gadījumā arī Client ID.
- Google palīgā jauns 2. solis “Ieslēdz Google Drive API”; atvērts no rezerves kopijas — poga “Saglabāt” bez kalendāra sinhronizācijas.

## 1.28.0 — 2026-10-16 — Šifrētā rezerves kopija
- Jauns modulis `js/encbackup.js`. Kopijas mapē `CADET_rezerve/`: `KOPIJA.json` (galva: formāts, kopas id, laiki, mājiens, ietītās atslēgas, šifrēts indekss, statistika), `dati/<nejaušs id>.bin` (IV + AES-GCM šifrteksts katram failam), `ATJAUNOT.html` (atšifrēšana bez rīka).
- Galvenā atslēga: nejauša AES-GCM 256, ietīta ar paroli un ar atkopšanas kodu (25 zīmju Crockford base32, ~125 biti) — PBKDF2-SHA-256, 600 000 iterācijas, nejaušs salt. Šifrētais indekss: ceļš → { id, izmērs, lastModified, SHA-256 } un mapju saraksts. Atklāti ir tikai laiki, mājiens un skaits.
- Kopijā: visa datu mape (izņemot `_rezerves`, `_arhivi`, pagaidu failus) + papildu (ārējo) mapju dokumenti. Papildu kopija pārraksta tikai mainītos (izmērs / lastModified), noņem dzēstos. Automātiski ik 10 min, ja dati mainījušies un kopija vecāka par 30 min; pēc mapes ielādes — ja vecāka par 6 h. Mapes rokturis un galvenā atslēga glabājas pārlūka IndexedDB (paroles maiņa bez vecās paroles; jauns atkopšanas kods).
- Atjaunošana (arī bez datu mapes, no sākuma lapas): parole vai atkopšanas kods → tukša mape → katrs fails pārbaudīts ar SHA-256; papildu mapju dokumenti → `_atjaunoti_no_arejam_mapem/<mape>/…` un datu failā pārsaistīti uz pamatmapi; mape tiek pieslēgta kā datu mape.
- Brīdinājums `backup`, ja kopija > 7 dienas veca vai gaida atļauju. `CP.afterRootLoad` āķi pēc datu mapes ielādes.

## 1.27.1 — 2026-10-16
- “Dalībnieki no citām vienībām” pārcelts uz pasākuma loga kreiso kolonnu (zem pasākuma datiem / audzinātājiem). Bezsaistes kešs: arī `templates/*.xlsx` tiek ielādēti vispirms no tīkla.

## 1.27.0 — 2026-10-16 — Dalībnieki no citām vienībām
- Jauns modulis `js/extpeople.js`. Pasākumā: `ev.external = [{ id: 'x…', first, last, personalCode, birth, group, adreses, tālruņi, vecāki, unit, counselorId }]` un `ev.extStaff` (nometnes darbinieki; to id tiek ielikti `ev.staff`). Tie netiek pievienoti `db.people` un nav brīdinājumos / auditā.
- `forms.js`: `evPeople(ev)` = savējie + ārējie (`_ext`), `evStaff(ev)` = darbinieki + ārējie; `D.groupOf` ārējiem atgriež viņu grupu; `D.eventDocIssues` ārējiem — tukšs. PDF (instruktāža, nometne) un Word veidnes iekļauj ārējos.
- Eksports: `{ format: 'cadet-dalibnieki', v: 1, from, event, people, staff }` JSON; pēc izvēles šifrēts: AES-GCM 256, atslēga PBKDF2-SHA-256 (250 000 iterācijas, nejaušs salt un iv). Imports: CADET fails (ar paroles pieprasījumu) vai Excel/CSV (`CP.io.peopleFromFile` — tā pati kolonnu atpazīšana kā personu importā); vienība no šūnas “Vienība / instruktors:”. Priekšskatījums: izvēle pa rindām, sakritība ar savu sarakstu (personas kods vai vārds + dzimšanas datums) → izvēlas savu ierakstu; jau pasākumā esošs → atjauno.
- Excel veidne `vendor/templates/dalibnieku-veidne.xlsx` (personas koda / tālruņa kolonnas kā teksts).
- Personu importam jaunas kolonnas: `parent2Name`, `parent2Phone` (“Otrs vecāks”, “Otra vecāka tālrunis”).

## 1.26.3 — 2026-10-16
- Noklusējuma akcents: zils `#4f9cff` (`CP.DEFAULT_ACCENT`, `--acc` design.css); tēma joprojām tumšā. Lietotāja izvēle (`localStorage` `cp-accent` / datu faila izskats) netiek mainīta.

## 1.26.2 — 2026-10-16
- Grupas lauks: `select[data-grppick]` un datalist aizstāti ar `ui.grpPop` sarakstu (`.grp-pop` laukā `.grp-field`, visā lauka platumā zem tā): grupas ar skaitu, filtrs rakstot, “izveidot grupu …”, “bez grupas”, jaunas grupas ievade; ↑↓ / Enter / Esc (Esc neaizver logu), aizveras pie klikšķa ārpusē vai aizverot logu. Ievades lauks ar `name="group"` paliek (OCR, piespraušana, saglabāšana nemainās).
- Grupas dzēšanas logs: izvēles kartītes `.choice` (radio + apraksts / saraksts); saraksta fokuss atzīmē “Pārcelt”.
- Vispārīgi: `input[type=radio]` vairs nav 100% platumā.

## 1.26.1 — 2026-10-16
- Grafiks: `A.schView` — notikuma kartīte bez ievades laukiem (mēneša un nedēļas skats, saraksta virsraksts, stundu tabula, pārskats, atgādinājuma paziņojums). Labošanas logs (`A.schEdit`) atveras tikai ar ✎ (kartītē vai saraksta rindā). Kartītē: “⧉ Kopēt” → kopija nākamajai nedēļai labošanas logā.

## 1.26.0 — 2026-10-16 — Jaunas grupas un grupas izvēlne
- `settings.groupsByYear = { yearId: [nosaukums] }`: pieteiktās grupas (arī tukšas). `D.groups()` = šī gada personu grupas ∪ pieteiktās, tāpēc tās ir visās izvēlnēs (datalist `dl_groups`, filtri, apmeklējums, saziņa, imports, pārcelšana). `D.addGroup`, `D.declaredGroups`, `D.setDeclaredGroups`. Pārdēvējot / dzēšot tiek atjaunots arī pieteikto saraksts.
- Pārskatā ir poga “＋ Jauna grupa” (`A.groupNew`). Tukšas grupas dzēšana bez jautājuma par personām.
- Formas laukam “Grupa” ir `select[data-grppick]` blakus ievades laukam (grupas, “bez grupas”, “jauna grupa…”); ievades lauks paliek (OCR un ierakstīšana), datalist bultiņa ir paslēpta.

## 1.25.1 — 2026-10-16
- Labots mūra izkārtojums, ja `.wide` kartīte ir virs citām (Veidlapas): izstiepšana tiek rēķināta pa joslām starp platajām kartītēm, nevis līdz pirmajai platajai kartītei (iepriekš rindu robežas apgriezās, un kartītes uzklājās). Izstiepj tikai joslās, kurām zemāk seko platā kartīte. Jauns tests: nepārklāšanās visās `.cards2` lapās trijos platumos.

## 1.25.0 — 2026-10-16 — Grupu pārvaldība
- Grupas ✎ / ✕ pārskatā (`A.groupEdit`, `A.groupDel`). Aktīvā gada `enrollments[].group` tiek mainīts uz jauno grupu vai '' (bez grupas); personas un iepriekšējie gadi netiek aiztikti; katrai personai — audita ieraksts. Līdzi pāriet `stickyGroup`, saraksta filtrs, `groupDays`; pārdēvējot / apvienojot arī šī gada apmeklējuma nodarbības (ja jaunajā grupā tajā datumā nav savas).
- Mūra izkārtojums: `data-mcol` nosaka kolonnu (pārskatā: Grafiks + Grupas = 0, Uzdevumi = 1, Trūkstošie = 2; ja kolonnu mazāk — pēdējā). Katras kolonnas pēdējā kartīte tiek izstiepta līdz kopējai apakšai (`.mas-stretch`), tāpēc atstarpe līdz platajai kartītei ir vienāda. Pārrēķina aizsardzība pret `ResizeObserver` cilpu.

## 1.24.1 — 2026-10-16
- Pārskats: “Pēdējās izmaiņas” atkal ir `.wide` (visā platumā, apakšā), ieraksti divās kolonnās (`.recent-grid`, 10 ieraksti). Kartītes ar `data-fill` (Trūkstošie dokumenti, Uzdevumi un brīdinājumi) sāk ar minimumu (5 rindas) un pa vienai rindai aug īsākajā kolonnā, kamēr nepārsniedz garāko; pārējās — “… un vēl N →”. `ResizeObserver` netiek izsaukts no paša izkārtojuma maiņas (`_laying`).

## 1.24.0 — 2026-10-16 — Pārskata izkārtojums un importa logs
- `CP.masonry` (dashboard.js, `afterRender`): `.cards2` ar vairākām kolonnām → režģa rindas pa 2 px; katra kartīte tiek novietota īsākajā kolonnā (`grid-column` / `grid-row: N / span …`); `.wide` aizņem visu platumu zem garākās kolonnas. `ResizeObserver` pārrēķina pēc satura maiņas; vienā kolonnā (šaurs ekrāns) ir parastā plūsma. Pārskatā “Pēdējās izmaiņas” vairs nav `.wide`, tāpēc tā aizpilda brīvo kolonnu.
- Grafika “Imports” atver logu `#schImpPick`: teksts par darba plānošanas matricu, ievilkšanas laukums (arī Enter / atstarpe) un faila izvēle; pēc faila izvēles atveras salīdzinājuma priekšskatījums. Ievilkšana grafika lapā darbojas kā līdz šim.

## 1.23.3 — 2026-10-16
- Google savienošanas palīgs: 5 soļi ar tiešajām saitēm (Calendar API, Auth Platform, Audience, Clients), kopēšanas pogām, atzīmēm “Izdarīts” (`localStorage` `cp.gcalSteps`), Client ID lauku ar “Saglabāt un sinhronizēt” un pārbaudi, ka ID beidzas ar `.apps.googleusercontent.com`.

## 1.23.2 — 2026-10-16
- Google kalendāra instrukcija atbilst Google Auth Platform izvēlnei (Get started / OAuth Overview, Audience → Test users, Clients → Create client). Tiek parādītas abas novirzīšanas adreses (stabilā un testa).

## 1.23.1 — 2026-10-15
- “Nodarbību saraksts”: piezīmes tiek dalītas pa rindām un “;”. Segmentu datumi (`DD.MM`, `DD.MM.`, `DD.,DD.OKT`, `8. un 27. oktobrī`; gads pēc mācību gada) tiek pievienoti kā nodarbības ar rindas laiku un vietu. Segmenti ar “nenotiek / atcelts / nebūs / pārcelts” datumu noņem. Datuma segments ir šīs dienas piezīme; segmenti bez datumiem ir piezīme visām rindas dienām. Rinda tiek izlaista tikai tad, ja datumu nav ne kolonnās, ne piezīmēs.
- Jaunsargu grupu nodarbības nosaukums ir “Jaunsardzes nodarbība <līmenis>”. Atslēga paliek pēc 1.23.0 nosaukuma (`keyTitle`), tāpēc atkārtotā importā tas ir “mainīts: nosaukums”.
- Stundu kopsavilkumā: “Kontaktstundas (nodarbības + VAM)”.

## 1.23.0 — 2026-10-15 — Grafika imports no darba uzskaites Excel
- Jauns modulis `js/schedimport.js`. Lasa .xlsm / .xlsx (makro netiek izpildīti, tiek lasītas formulu saglabātās vērtības). Tiek atvērtas tikai redzamās lapas, kurās atrasti vajadzīgie virsraksti; lielās slēptās palīglapas netiek atspiestas.
- “Darba plāns_secīgi”: kolonnas pēc virsrakstiem (Datums no / Laiks no / Datums līdz / Laiks līdz, Mācību grupa, Pasākuma veids, Obligātais pasākums, Pasākuma nosaukums, Norises vieta, Vadītājs, Atbalsta personāls, Dalībnieki). Excel datumi (sērijas skaitļi) un laiki (dienas daļas) tiek pārvērsti; vairāku dienu notikumi saglabā sākuma un beigu laiku; prombūtne ir visu dienu, bez atgādinājumiem. “Darba plāns_Matrica” netiek lasīta (dublē secīgo).
- “Nodarbību saraksts”: mācību gads no virsraksta “YYYY./YYYY.”; septembris–decembris = 1. gads, janvāris–augusts = 2. gads; dienas no šūnām “16.\n23.\n30.”; nosaukums no grupas līmeņa un nosaukuma, vieta = vietas nosaukums + adrese. Rindas bez datumiem mēnešu kolonnās tiek parādītas kā izlaistas.
- Jauni grafika veidi: Novada pārvaldes darbs, Metodiskais darbs, Prombūtne (arī Google krāsas).
- Atkārtots imports: `ikey` = avots | datums | normalizēts nosaukums (+#n). Salīdzinājums pa laukiem → jauni / mainīti (ar lauku izmaiņām, ⚠ ja labots rīkā pēc importa) / failā vairs nav (tikai no tā paša avota, pagātne netiek aiztikta) / bez izmaiņām. Katru izmaiņu var izvēlēties. Notikumi bez `ikey` (izveidoti rīkā) netiek mainīti. Noņemtie Google notikumi nonāk `scheduleDel`; pēc importa — automātiska sinhronizācija.
- Ievilkšana grafika lapā vai poga “Imports” (faila izvēle). `settings.schImport` = pēdējā importa faila nosaukums, laiks un skaits (parādīts virs kalendāra).

## 1.22.0 — 2026-10-15 — Grafiks
- Jauns modulis `js/schedule.js` un lapa “Grafiks” (cilnes: kalendārs, stundu kopsavilkums, atgādinājumi un Google). Grafiks nav saistīts ar personu datiem.
- Dati: `db.schedule = [{ id, title, type, date, endDate, allDay, start, end, place, notes, remind[min], seriesId, gcalId, gsig }]`, `db.scheduleDel` (Google kalendārā vēl jādzēš). Iestatījumi: `gcal { clientId, calendarId, lastSync }`, `notify { events, alerts }`, `schDefaultRemind`.
- Skati: mēnesis (6×7), nedēļa (7:00–22:00, pārklāšanās joslās, visu dienu josla, “tagad” līnija), saraksts (60 dienas). Veidi ar krāsām: Nodarbība, VAM nodarbība, Pasākums, Nometne, Sacensības, Sapulce / apmācības, Administratīvais darbs, Cits.
- Iknedēļas atkārtojums izveido atsevišķus notikumus ar `seriesId` (līdz 200). Labojot var piemērot nākamajiem; var dzēst šo un nākamos, kā arī kopēt uz nākamo nedēļu.
- Atgādinājumi: pārbaude ik 30 s, kamēr rīks ir atvērts. Paziņojums rīkā + `Notification` caur SW `showNotification`; klikšķis atver rīku vajadzīgajā sadaļā (`notificationclick` → `cp-open`). Parādītie atgādinājumi tiek atzīmēti `localStorage` (`cp.schNotified`). Brīdinājumu kopsavilkums uz darbvirsmas reizi dienā par jaunajiem.
- Google Calendar: OAuth 2.0 token plūsma uznirstošā logā (`oauth.html` + `oauth.js` → `BroadcastChannel('cp-oauth')`), tvērums `calendar.app.created` (tikai rīka izveidotais kalendārs). Tiek izveidots kalendārs “Jaunsardze — darba grafiks”. Notikumi tiek pievienoti / atjaunoti (PUT, ja mainījies paraksts `gsig`) / dzēsti; Rīgas laika zona, atgādinājumi `popup`, krāsas pēc veida. Pēc pirmās sinhronizācijas izmaiņas tiek nosūtītas automātiski, kamēr piekļuve ir derīga. CSP `connect-src` papildināts ar `https://www.googleapis.com`.
- `.ics` eksports (VTIMEZONE Europe/Riga, VALARM, visu dienu / vairāku dienu notikumi).
- Pārskatā ir kartīte “Grafiks — tuvākās 7 dienas”. Poga “Imports” rāda paziņojumu, ka funkcija tiek gatavota.
- `CP.render` vairs neizsauc sevi atkārtoti zīmēšanas laikā (piem., blur → change); otrā zīmēšana notiek uzreiz pēc pirmās.
- Apmeklējuma un grafika stili izmanto tēmas mainīgos (strādā gan tumšajā, gan gaišajā tēmā). Apmeklējuma navigācijas ikona ir nomainīta.

## 1.21.1 — 2026-10-15
- Apmeklējuma tabulā var ievadīt ar tastatūru. Klikšķis fokusē rūtiņu un tāpat kā līdz šim maina atzīmi. Taustiņi `+`/`=`/`B`/`1`/`P` → bija, `N` `K` `A` `S`; `Del`/`Backspace`/`0`/`-` notīra; atstarpe = klikšķis; bultiņas, `Enter`, `Tab`, `Home`/`End` pārvietojas; `Esc` noņem fokusu.
- Pēc atzīmes fokuss pāriet uz leju (nākamā persona) vai pa labi (nākamais datums). Izvēle tiek saglabāta `localStorage` (`cp.attDir`).
- Fokusētās rūtiņas rinda un kolonnas virsraksts tiek izgaismoti. Pēc kopsavilkumu pārzīmēšanas (1,5 s pēc pēdējās atzīmes) fokuss un ritinājuma vieta saglabājas.

## 1.21.0 — 2026-10-15 — Apmeklējums
- Jauns modulis `js/attendance.js` un lapa “Apmeklējums” (cilnes: mēneša tabula, žurnāls, rādītāji, kvalifikācijas un dalība).
- Dati: `db.sessions = [{ id, date, group ('*' = visa vienība), yearId, type, topic, notes, att: { personId: kods } }]`. Kodi: `+` bija, `n` nebija, `k` kavēja (skaitās klātesošs), `a` attaisnots, `s` slimības dēļ. Attaisnotie neietekmē %.
- Iestatījumi: `groupDays` (grupas nedēļas dienas 1–7), `absenceStreak` (noklusējums 3), `quals` (instruktora definētas kvalifikācijas). Personai ir jauni lauki `quals [{ qid, date, src }]` un `incidents [{ id, date, type, severity, text, action }]`. Esošie dati netiek mainīti, shēma paliek 7 (jaunie masīvi tiek pievienoti automātiski).
- Mēneša tabula: jaunsardzes dienas vai visas dienas; klikšķis maina atzīmi; nodarbības logs (tēma, veids, piezīmes, “visi bija”, “neatzīmētie — nebija”, notīrīt, dzēst). Veidlapa PDF (`CP.pdf.attendance`) — tukša vai ar atzīmēm, horizontāla, ja datumu ir vairāk par 9; drukāšana ar kopējo `CP.printPdf`.
- Rādītāji: gada / mēneša %, dinamikas līnijgrafiks (SVG, laukums ar gradientu, slīdošā vidējā 4 nodarbībām, krustiņš un vērtība pie peles), grupu salīdzinājums, personu % ar tendenci (pēdējās 4 pret iepriekšējām 4) un mini grafiku.
- Brīdinājums `attendance` pārskatā / uzdevumos: N kavējumi (`n`) pēc kārtas; attaisnotie un neatzīmētie neskaitās. Pārtrauktie netiek rādīti tabulā un brīdinājumos.
- Kvalifikācijas: izveidot / dzēst, piešķirt atzīmētajiem ar datumu vai nometnes žurnāla dalībniekiem, noņemt. Kartītē piešķiršana no saraksta.
- Personas kartīte: apmeklējuma karte sānjoslā; “Dalība un kvalifikācijas” (nometnes, instruktāžas, nodarbības ar veidu pasākums / nometne / sacensības); “Uzvedība un pārkāpumi” ar labošanu un dzēšanu, kas tiek reģistrēti izmaiņu vēsturē.

## 1.20.1 — 2026-10-15
- Dokumentu cilnē noņemta augšējā sadaļa “Obligātie dokumenti”, jo tā dublēja sānjoslu. Visas tās darbības (+ Fails, + Papīrs, atgādināt pārstāvim) ir sānjoslā, kur ir arī labot / aizstāt / dzēst. Dokumentu mape un “Visi dokumenti” paliek bez izmaiņām.

## 1.20.0 — 2026-10-15 — Dokumentu derīgums un labošana kartītē
- `settings.docValidity` (noklusējums: “Ārsta izziņa” = 12 mēn., tikai savā mācību gadā). Dokumentam ir jauns lauks `issued` (izsniegšanas datums). Ja “Derīgs līdz” nav ievadīts, termiņš ir izsniegšanas datums + 12 mēn. − 1 diena.
- Dokuments der mācību gadam, ja tas izsniegts no 1. augusta pirms gada sākuma līdz gada beigām (31.08.). Ja izsniegšanas datuma nav, tiek ņemts saņemšanas vai pievienošanas datums. Ja nav neviena datuma, dokuments der. `D.missingDocs` to ņem vērā, tāpēc pēc pārcelšanas uz jauno gadu iepriekšējā gada izziņa tiek uzskatīta par trūkstošu.
- Brīdinājumi: beidzies derīgums (sarkans); derīga vēl ≤30 d.; no 1. maija “derīga līdz mācību gada beigām” (informatīvs); “jaunajā mācību gadā jāiesniedz jauna … (iepriekšējā: datums)”; “nav norādīts izsniegšanas datums”.
- Dokumenta logā: lauks “izsniegšanas datums” (izziņai obligāts), automātisks “Derīgs līdz” un paskaidrojums. Pievienojot vienu izziņas failu, logs atveras uzreiz.
- Kartītes “Obligātie dokumenti”: katram dokumentam ir rinda ar datumiem un pogām atvērt / labot / aizstāt failu / dzēst, kā arī “+ Fails” / “+ Papīrs” trūkstošajiem. Dokumentu sarakstā pogas ir ar nosaukumiem.
- “Aizstāt failu”: jaunais fails tiek saglabāts personas mapē, iepriekšējais paliek mapē un ieraksta `versions` vēsturē. “Dzēst” noņem tikai ierakstu. Pēc faila pievienošanas paziņojumā ir poga “✎ Labot datus”.

## 1.19.1 — 2026-10-15 — Bez datu mapes darbs netiek sākts
- Bez pieslēgtas datu mapes (`!S.root`): pārskatā redzama tikai sadaļa “Sāc darbu” ar soļiem (izveido mapi → izvēlies → atļauj rediģēt). Statistika, pulkstenis un ātrās darbības netiek rādītas.
- Visas darbības, kas maina datus, tiek apturētas, un tiek parādīts logs “Vispirms pievieno datu mapi” ar pogu mapes izvēlei vai piekļuves atļaušanai. Atļautas ir tikai mapes, izskata, pulksteņa, jaunumu un instalēšanas darbības (`CP.noRootOk`).
- Citās sadaļās, izņemot Pārskatu un Par rīku, tiek parādīta lapa “Nav pievienota datu mape” ar tiem pašiem soļiem. Sānjoslas pogas ir pelēkotas.
- Mapes pārbaudes laikā (atcerētā mape vēl atveras) tiek rādīts kā līdz šim progress.

## 1.19.0 — 2026-10-15 — DVS reģistrācija pa dokumentiem
- `p.reg.dvs.docs[<dokuments>] = { done, date }`. Dokumentu saraksts ir tas pats, kas obligātie dokumenti (Iestatījumi → Dokumenti). Vecā `p.reg.dvs.done` tiek nolasīta kā “visi reģistrēti” ar to pašu datumu.
- Kartītē katram dokumentam ir izvēles rūtiņa, reģistrēšanas datums (var mainīt) un statuss rīkā (✓ pievienots / ✗ nav pievienots). Augšā ir skaitītājs “N/3 reģistrēti”. e-klase paliek viena atzīme.
- Brīdinājumi (pārskatā un Uzdevumos): “DVS nav reģistrēts — …”, ar piebildi, kuri no tiem jau pievienoti rīkā, un atsevišķi “nav atzīmēts, ka ievadīts e-klasē”. Pārtrauktajiem un arhivētajiem brīdinājumu nav.
- Masveida poga “✓ DVS (visi dok.)” atzīmē visus obligātos dokumentus.

## 1.18.3 — 2026-10-15
- Nometnes žurnāls: dalībnieka izvēlei ir nosaukums “Audzinātājs:”. Noklusējuma opcija rāda grupas audzinātāja vārdu, piem., “Ilze … (grupas audzinātājs)”, vai “Kā grupai — vēl nav izvēlēts”. Agrāk tur bija neskaidrs “↳ kā grupai”, kas pārlūkā attēlojās kā “ļ, kā grupai”. Pārējās opcijās ir citi darbinieki. Ja darbinieku nav, ir paskaidrojums, kur tos pievienot.
- Mainot grupas audzinātāju, dalībnieku saraksts atjaunojas uzreiz. Šaurā ekrānā izvēle pārceļas zem vārda.

## 1.18.2 — 2026-10-15
- Labojums: atverot rīku, vairs neparādās “Pieejama jauna versija… pārlādē”. Paziņojumu izraisīja bezsaistes keša atjaunošana fonā, lai gan lapa jau bija ielādējusi jaunāko kodu.
- Jaunas versijas pārbaude darba laikā: rīks salīdzina publicēto `version.json` ar ielādēto versiju (5 min pēc atvēršanas, tad ik pēc 15 min un atgriežoties logā). Paziņojums ar pogu “↻ Pārlādēt” paliek redzams, līdz to aizver, un tiek parādīts vienreiz katrai versijai. `version.json` vienmēr tiek ielādēts no tīkla.
- Jaunumu logs un atjauninājumu žurnāls ir sakārtoti lielākos blokos pa funkcijām (piem., “Jauna veidlapa: Līgums” 1.17.0–1.18.1).

## 1.18.1 — 2026-10-15 — Līgumu labošana un versijas
- Kopā ar līgumu tiek saglabāti visi līguma loga dati (veids, forma, veidne, pārstāvis, Nr., datumi, vieta, labotie lauki). **✎ Labot** (sarakstā Veidlapas un personas kartītē) atver logu ar šiem datiem.
- Saglabājot labojumus, tiek izveidots jauns Word fails, un ieraksts norāda uz jaunāko versiju. Iepriekšējais fails netiek pārrakstīts (`versions` vēsture).
- **⬆ Ielādēt labotu**: Word programmā labotu .docx failu var ielādēt kā jaunu versiju (`… (labots DD.MM.GGGG).docx` personas mapē).
- Sarakstā redzams “labots DD.MM.GGGG (N. versija)”. Labojot personu mainīt nevar.

## 1.18.0 — 2026-10-15 — Sagatavoto veidlapu saraksts ar filtriem
- Veidlapas → **Sagatavotās veidlapas**: vienā sarakstā ir pasākumi (instruktāžas, nometnes) un visu personu sagatavotie līgumi. Jaunākie ir augšā, un sarakstā redzami 40 ieraksti ar pogu “Rādīt vēl”.
- Filtri: veida pogas ar skaitu, datums no/līdz, mācību gads, meklēšana pēc personas vārda (arī pasākumu dalībniekiem), pasākuma nosaukuma, grupas vai līguma numura, un “Notīrīt filtrus”.
- Līgumu rindās ir saite uz personu, poga “Skatīt / drukāt” (priekšskatījums no saglabātā Word faila), poga “Word” (lejupielāde) un poga ✕ (noņem ierakstu, bet fails paliek).

## 1.17.2 — 2026-10-15
- Labojums: līguma rekvizītos Centra tālrunis “Tālrunis: 67335388” vairs netiek aizstāts ar instruktora tālruni. Tālruņi un e-pasti tiek ierakstīti tikai rindās ar tukšu līniju. Pārbaudīts visās četrās standarta veidnēs.
- Standarta Word veidnes vairs netiek ņemtas no bezsaistes keša: adresē ir versija (`?v=`), un pakalpojuma darbinieks tās ielādē no tīkla. Iepriekš pēc atjauninājuma varēja tikt izmantota vecā veidne.
- Instruktora dati tiek saglabāti jau rakstīšanas laikā.
- Ja līgums sagatavots ar 1.17.0 vai 1.17.1, Centra tālrunis tajā jāizlabo ar roku vai līgums jāsagatavo no jauna.

## 1.17.1 — 2026-10-15 — Līguma labojumi
- Datu lauki standarta veidnēs (vārdi, personas koda cipari, adreses, amats, instruktora vārds, vieta) ir centrēti un rakstīti Times New Roman 12,5 pt taisnā šriftā, kā dokumenta teksts.
- Instruktora paraksta datums (papīra līgumos), piem., “2026. gada 15. oktobrī”: tāds pats kā līguma datums, cits datums vai tukšs. Izvēle tiek atcerēta.
- Pārstāvja statusam nav noklusējuma, tas jāizvēlas (Māte / Tēvs / Likumiskais pārstāvis / Cits + paša teksts, ko rīks atceras ieteikumiem). Bez statusa līgumu sagatavot nevar.
- Ja nav līguma numura, rīks pirms priekšskatījuma vai Word faila skaidri jautā, vai turpināt.
- Līguma logā ievadītie dati papildina tukšos kartītes laukus (pārstāvja vārds, statuss, personas kods, adreses, tālrunis, e-pasts; jaunieša kontakti). Esošie dati netiek pārrakstīti. Vieta un forma tiek atcerētas.
- Teikumā “uz ____ (____) lapām” ir garākas līnijas visās četrās veidnēs.

## 1.17.0 — 2026-10-15 — Veidlapa “Līgums”
- Četras standarta veidnes no Jaunsardzes centra paraugiem (24.10.2024): jaunietis 18+ un likumiskais pārstāvis, katrs papīra formā un EDOC.
- Automātiski tiek aizpildīts: līguma Nr. (ievada lietotājs), vieta un datums (“2026.gada 15.oktobrī”), novada pārvaldes un nodaļas nr., instruktora vārds ģenitīvā (ar ieteikumu, ko var labot), jaunieša un pārstāvja statuss, vārds, personas koda cipari pa šūnām, adreses, tālruņi un e-pasti, kā arī Centra pārstāvja amats un kontakti.
- Pirms sagatavošanas visus datus var pārbaudīt un labot. Labotais attiecas tikai uz šo līgumu, un kartītes dati netiek mainīti.
- Līguma veids tiek izvēlēts pēc vecuma, formu atceras rīks, un pārstāvi var izvēlēties no diviem vecākiem.
- Rīks brīdina, ja trūkst personas koda, pārstāvja, līguma numura vai instruktora datu.
- Word fails tiek lejupielādēts, un kopija saglabāta `Macibu_gadi/<gads>/Personas/<persona>/`. Kartītē ir sagatavoto līgumu saraksts, un līguma Nr. tiek saglabāts kartītē.
- Līgumu var priekšskatīt un izdrukāt rīkā. Priekšskatījums tiek veidots no Word faila ar bibliotēku docx-preview 0.3.7, un izkārtojums var nedaudz atšķirties no Word.
- Savu līguma veidni var izmantot ar atzīmēm `{liguma_nr}`, `{j_vards}`, `{j_pk1}`…`{j_pk11}`, `{p_statuss_vards}` u.c. Ir pieejams lejupielādējams paraugs.
- Word aizpildīšana tagad atbalsta atzīmes ar cipariem, piem., `{j_pk1}`.

## 1.16.3 — 2026-10-15
- Drukāšana notiek tieši no rīka loga, bez slēpta rāmja. Chrome drukas logs uzreiz rāda veidlapas lapas: A4 portrets instruktāžas lapai, ainava nometnes žurnālam. Ja ir printeris, tās var izdrukāt, vai arī saglabāt kā PDF. Pārbaudīts ar pārlūka drukas dzinēju: izdrukā ir tikai veidlapa, 1 lapa.
- Tukšās rindas vienmēr nosaka lietotājs: bez dalībniekiem veidlapā ir tieši norādītais rindu skaits (agrāk vismaz 10). Ja dalībnieku nav un rindu skaits ir 0, rīks lūdz norādīt rindu skaitu.
- Nometnes žurnālā ir atsevišķa izvēle tukšajām rindām darbinieku tabulā (agrāk 3 rindas, ja darbinieki nebija izvēlēti).
- Ievadot skaitli tukšo rindu laukā, paskaidrojums zem tā atjaunojas uzreiz.

## 1.16.2 — 2026-10-15 — Veidlapu labojumi
- Instruktāžas lapā un nometnes žurnālā vairs nav obligāti 26 vai 11 rindu. Rindu skaits ir dalībnieku skaits plus norādītās tukšās rindas (noklusējumā 0). Tukšai veidlapai bez dalībniekiem ir 10 rindas. Darbinieku tabulā ir tik rindu, cik izvēlēto darbinieku, bet, ja neviens nav izvēlēts, 3 tukšas rindas.
- Tukšajās rindās datuma šūna ir tukša. Ja izvēlēts neierakstīt datumu katrā rindā, arī dalībnieku rindās datuma šūna ir tukša.
- Tukšo rindu izvēle darbojas: skaitlis ar pogām − / + un paskaidrojums par rindu skaitu. Tas pats attiecas uz savām Word veidnēm.
- Drukāšana: rīkā tiek atvērts priekšskatījums ar visām lapām (A4 portrets vai ainava) un pogām Drukāt un Lejupielādēt PDF. Iepriekšējais veids pārlūkā varēja ielādēties bezgalīgi.

## 1.16.1 — 2026-10-13
- Statusa “Aktīvs” nosaukums tagad ir **Jaunsargs** visur rīkā: kartītē, sarakstā, filtros, pārskatā, importā un anketu ievadē. Iespējamie statusi: Kandidāts, Jaunsargs, Pārtraukts.
- Personas logā statusa izvēle ir sadaļā Pamatdati, uzreiz aiz vārda un uzvārda.

## 1.16.0 — 2026-10-13 — Piezīmju žurnāls un jaunumu logs
- Personas piezīmes un piezīmes par mācību gadu tagad ir ierakstu žurnāls. Katrs ieraksts ir atsevišķs, ar datumu, un to var labot (✎) vai dzēst (✕). Ja ieraksts labots, redzams arī labošanas datums. Piezīmes redzamas arī cilnē Vēsture.
- Teksta lauki izplešas vertikāli, kamēr raksti. Enter saglabā, Shift+Enter sāk jaunu rindu, un Esc atceļ labošanu.
- Teksts, kas nonāk piezīmēs no Excel importa, anketas vai rediģēšanas loga, tiek pievienots žurnālam kā jauns ieraksts.
- Datu faila versija 7. Esošās piezīmes tiek automātiski pārnestas uz žurnālu, un pirms tam tiek saglabāta rezerves kopija `_rezerves/DATI_pirms_atjauninasanas_v6-v7_….json`.
- **Jaunumi**: pirmo reizi pēc atjauninājuma tiek parādīts īss apraksts par jaunumiem. Pilns atjauninājumu žurnāls ir sadaļā Par rīku.

## 1.15.1 — 2026-10-13 — Piezīmes ar pogu “Saglabāt”
- Personas kartītē vienmēr ir lauks **Piezīmes**. Piezīmi par mācību gadu un piezīmi par personu tagad var rakstīt vairākās rindās.
- Pie katra lauka ir poga **Saglabāt**. **Enter** saglabā, un **Shift+Enter** sāk jaunu rindu. Tiek parādīts statuss “Nav saglabāts” vai “Saglabāts ✓”. Ja iziet no lauka, piezīme arī tiek saglabāta.
- Vēstures ierakstā **Enter** pievieno ierakstu, un **Shift+Enter** sāk jaunu rindu. Pēc pievienošanas parādās apstiprinājums.

## 1.15.0 — 2026-10-13 — Atzīmes “ievadīts DVS” un “ievadīts e-klasē”
- Personas kartītē ir jauna sadaļa **Reģistrācija** ar atzīmēm DVS un e-klase. Kopā ar atzīmi tiek saglabāts datums.
- Kamēr persona nav atzīmēta, pārskatā un uzdevumos redzams brīdinājums. Tas attiecas uz aktīvajiem un kandidātiem, bet ne uz pārtrauktajiem un arhivētajiem.
- Personu sarakstā atlasītajām personām var atzīmēt **✓ DVS** vai **✓ e-klase** uzreiz visām.
- Personas, kas importētas ar e-klases eksporta palīgu, automātiski tiek atzīmētas kā ievadītas e-klasē.
- Iestatījumi → Dokumenti: var izvēlēties, par kurām sistēmām atgādināt.

## 1.14.4 — 2026-10-13 — Imports no instruktoru Excel tabulām
- Vecāka vārds un tālrunis vienā šūnā (“Vecāku vārds, uzvārds, tel.Nr.”) tiek sadalīts. Ja šūnā ir divi vecāki, otrs kļūst par 2. pārstāvi.
- Jaunas atpazītās kolonnas: vecāka personas kods, “e-adrese” (e-pasts), statuss (Jaunsargs/Kandidāts) un jaunsarga apliecības numurs.
- Pārējās kolonnas, piem., Līgums, Līguma NR., Ārsta zīme, MTL un Solījums, tiek ierakstītas personas piezīmēs. To var izslēgt. Aprēķinu kolonnas (vecums, “Šodienas…”) tiek izlaistas.
- Ja kolonnā “Vārds, Uzvārds” ir divi vārdi un uzvārds, uzvārds ir pēdējais vārds. Teksts iekavās pie vārda nonāk piezīmēs.
- Tālruņi Excel zinātniskajā pierakstā (2.9E7) un ar “.0” tiek nolasīti pareizi. “NAV DATI” tiek uzskatīts par tukšu lauku. No aizklāta personas koda (piem., 010312-*****) tiek paņemts tikai dzimšanas datums.
- Izvēle **Statuss importētajiem**: darblapai ar nosaukumu “neaktīvi” automātiski tiek iestatīts statuss “Pārtraukts”.
- Ir redzams, cik rindu izlaists, jo tajās trūkst vārda vai uzvārda, un kuras tās ir.

## 1.14.3 — 2026-10-13 — Elastīgāks Excel imports
- Kolonnu nosaukumi vairs nav jāliek pirmajā rindā. Rīks pats atrod darblapu un rindu ar nosaukumiem pirmajās 30 rindās, tostarp divu rindu virsrakstu, piem., “Vecāks” virs “Vārds, uzvārds” un “Tālrunis”.
- Atpazīst arī līdzīgus nosaukumus, piem., “Jaunsarga vārds”, “Pers. kods”, “Dzim. dat.”, “Tālr.” un “Dzīvesvieta”.
- Importa logā redzams, kura darblapa, rinda un kolonnas ir atpazītas. Katru no tām var nomainīt ar roku.
- Excel datumi (šūnas ar datuma formātu) tiek nolasīti pareizi. Ja Excel personas kodam nogriezis sākuma nulli, tā tiek atjaunota. Atkārtota virsrakstu rinda tabulas vidū tiek izlaista.
- Vecajam .xls formātam ir skaidrs paziņojums, kā failu saglabāt kā .xlsx.

## 1.14.2 — 2026-10-13
- Pēc atjauninājuma lapa un programma vienmēr ielādējas kopā. Iepriekš pārlūks dažas minūtes varēja lietot iepriekšējo programmu, un jaunās pogas (piem., cilne “No e-klases”) nereaģēja.

## 1.14.1 — 2026-10-13 — Imports no e-klases
- Importa logā ir jauna cilne **No e-klases** ar soli pa solim instrukciju un pogu **Kopēt eksporta palīgu**. Palīgu ielīmē e-klases cilnē, un tas savāc atvērto skolēnu personas lietas CSV failā tavā datorā.
- Ja e-klase pārlādē lapu, jau savāktās personas nepazūd. Palīgu ielīmē vēlreiz, un saraksts atjaunojas.
- Imports saprot e-klases kolonnas: deklarētā un faktiskā adrese; māte, tēvs vai cita atbildīgā persona (kļūst par 1. un 2. pārstāvi kopā ar saistību un tālruņiem).
- Personām, kas jau ir uzskaitē, var papildināt tukšos laukus. Esošie dati netiek mainīti.
- Pārskatā ir poga **No e-klases**.

## 1.14.0 — 2026-10-13 — Veidlapas: instruktāžas lapa un nometnes žurnāls
- Jauna sadaļa **Veidlapas**. Tajā ir pasākumu saraksts, darbinieku un audzinātāju saraksts un savas Word veidnes.
- **Drošības instruktāžas lapa**: nosaukums, norises datumi (teksts “2026. gada 17.–18. oktobris” veidojas pats), instruktāžas datums, grupa, amats un vārds. Dalībniekus var izvēlēties pa vienam, visus, ar meklēšanu vai pēc grupas. Datums tiek ierakstīts katrā rindā.
- **Nometnes žurnāls**: darbinieku lapa un dalībnieku lapa. Dzimšanas datums, adrese, tālrunis un vecāku kontakti tiek ņemti no kartītēm. Audzinātāju var norādīt grupai, un atsevišķam dalībniekam to var nomainīt. Var norādīt arī nometnes vadītāju.
- Darbinieki un audzinātāji tiek saglabāti nākamajām reizēm, un neaktuālos var dzēst. Jaunā nometnē automātiski ir atzīmēti iepriekšējās nometnes darbinieki.
- **Brīdinājums tikai rīkā**: ja dalībniekam trūkst anketas, līguma vai ārsta izziņas. Dalībnieku tik un tā var pievienot, un uz veidlapas brīdinājums netiek drukāts.
- Gatavs **PDF**, ko var apskatīt, izdrukāt vai lejupielādēt. Kopija tiek saglabāta mapē `Macibu_gadi/<gads>/Pasakumi/`. Personas kartītē ir redzams, kuros pasākumos persona piedalījusies.
- **Sava Word veidne**: Word dokumentā ieraksti atzīmes, piem., `{nosaukums}` un `{vards}`, un rīks to aizpildīs. Ir pieejami lejupielādējami paraugi.

## 1.13.1 — 2026-10-13
- Iestatījumos izvēlētā ciparnīca iezīmējas uzreiz.
- Pārskata kartītes ir sakārtotas: ikona augšā, cipars un nosaukums kopā apakšā.

## 1.13.0 — 2026-10-13 — Pulkstenis: ciparnīcas, hronometrs, taimeris
- Četras ciparnīcas: taktiskā, analogā, lielie cipari un nakts (sarkana uz melna).
- Režīmi: **Laiks**, **Hronometrs** ar apļiem un starplaikiem, **Taimeris** nodarbībām (1–15 min vai savs laiks) ar skaņas signālu un mirgojošu ciparnīcu.
- Pulksteņa taustiņi darbojas: START·STOP (sākt / apturēt), BACK·LAP (aplis / atiestatīt), UP·MENU (ciparnīca), DOWN (režīms), LIGHT (liels pulkstenis).
- **Liels pulkstenis virs rīka**, ja N min nav darbības (noklusējumā 5). Tas paslēpj arī personu datus. Jebkura kustība vai taustiņš to aizver.
- Iestatījumi → **Pulkstenis un pauzes**: ciparnīca, darba laiks līdz pauzei, pauzes garums, atkārtojums, lielais pulkstenis, skaņa.
- Anketas zonu iezīmēšanā krusta kursors tagad ir sarkans.

## 1.12.0 — 2026-10-12 — Pulkstenis un pauzes
- Pārskatā ir taktiskā pulksteņa stila ciparnīca. Tā rāda laiku, sekundes, datumu, darba laiku un divus progresa lokus, un tās krāsa pielāgojas tēmai un akcentam.
- Darba laika taimeris: laiks tiek skaitīts, kamēr rīks ir atvērts. Pēc 40 min parādās paziņojums “Labs darbs! … Laiks paņemt īsu pauzi”. Poga “Sākt pauzi” skaita 5 min, un pēc tam sākas jauns posms. Ja rīks bijis aizvērts ilgāk par 5 min, tas tiek uzskatīts par pauzi.
- Lietotāja skatā noņemti tehniski un “aizkulišu” paskaidrojumi (datu shēmas versijas, testa kanāls, izstrādes process).

## 1.11.0 — 2026-10-12 — Jaunais izskats visiem; “Par rīku”
- Dizains v2 tagad ir arī stabilajā un lokālajā versijā: ikonas, krāsu flīzes, tumšā un gaišā tēma, akcenta krāsa (Iestatījumi → Izskats).
- Jauna sadaļa **Par rīku** (navigācijā ⓘ): kam rīks paredzēts, kur glabājas dati, 8 soļi, kā sākt lietot, ko rīks prot, izstrādātājs Jānis Eglis.

## 1.10.1 — 2026-10-12
- **Atpakaļ:** katrā lapā ir poga “← <iepriekšējā lapa>”. Darbojas arī pārlūka un peles “atpakaļ” poga, kā arī Alt + ←.
- Navigācijas joslā vairs nav liekas horizontālās ritjoslas.
- Apliecības sadaļā noņemti paskaidrojumi par neobligātumu.
- **Dizains v2** (`/test/`): Iestatījumi → Izskats. Tēma: tumšā / gaišā / kā datorā. **Akcenta krāsa:** 11 gatavas krāsas un sava krāsa. No akcenta tiek atvasinātas pogas, izcēlumi, saites un viegls fona tonis. Teksta krāsa uz pogām tiek izvēlēta automātiski pēc kontrasta. Izskats glabājas pārlūkā un datu failā, tāpēc citā datorā tas ir tāds pats.
- Kartītes cilnes ietilpst vienā rindā.

## 1.10.0 — 2026-10-12 — Jaunsarga apliecība; jauns izskats (testa versijā)
- **Jaunsarga apliecība** personas kartītē (cilne “Apliecība”), neobligāta kā ekipējums. Tajā ir statuss (nav pieprasīta / pieprasīta / saņemta, jāpasniedz / izdota / nodota atpakaļ / nozaudēta), numurs, datumi (pieprasīta, izdota, derīga līdz), piezīmes un apliecības kopija (skenējums vai papīrs).
- Brīdinājumi: izdota bez numura; derīgums beidzies vai beigsies 30 dienās; pieprasīta pirms vairāk nekā 60 dienām; saņemta, bet nav pasniegta; dalība beigusies, bet apliecība nav nodota; vienāds numurs divām personām. Izmaiņas redzamas vēsturē.
- Dokumentu veidos pievienots “Jaunsarga apliecība”.
- **Dizains v2** (pagaidām tikai `/test/`): vienots līniju ikonu komplekts, statistika krāsu flīzēs, Manrope burti (iekļauti rīkā), gaišā un tumšā tēma (Iestatījumi → Izskats). Tīmekļa versijai bez ārējiem serveriem.

## 1.9.7 — 2026-10-12 — Droši atjauninājumi
- Pirms datu faila pārveidošanas uz jaunāku datu shēmu `_rezerves` mapē automātiski tiek saglabāta oriģināla kopija (`DATI_pirms_atjauninasanas_vX-vY_….json`).
- Ja datu failu saglabājusi jaunāka rīka versija, bet atvērta vecāka (piem. no keša vai zibatmiņas), dati tiek atvērti tikai apskatei un saglabāšana ir atslēgta, lai tos nesabojātu.
- Lauki, ko šī versija nepazīst, datu failā tiek saglabāti neskarti.

## 1.9.6 — 2026-10-12
- Google Vision kļūdas tiek skaidrotas latviski ar konkrētu rīcību: atslēga nederīga, atslēgai nav atļauts Vision API, adreses ierobežojums, API nav ieslēgts, nav norēķinu konta, limits, nav savienojuma. Atslēgai tiek noņemtas nejaušas atstarpes.

## 1.9.5 — 2026-10-12 — Anketu nolasīšana atkal darbojas
- **Bez veidnes** lauki atkal tiek atrasti automātiski pēc anketas etiķetēm. Iepriekšējā darba versijā tas bija izslēgts, un ar Google Vision dokuments netika pat nosūtīts. Word, eDoc un PDF ar tekstu nolasa precīzi, skenējumus atpazīst izvēlētais dzinējs.
- **Google Vision** tagad tiešām tiek izmantots gan bez veidnes, gan ar veidni (zonu teksts no Google atpazītajiem vārdiem). Google kļūdas, piem. nederīga atslēga, API nav ieslēgts vai nav norēķinu konta, tiek parādītas ievades logā.
- Personas kods rūtiņās vienmēr tiek nolasīts pa cipariem lokāli, arī ar Google. Tas ir izturīgs pret plašāk vai šaurāk iezīmētu zonu. Labots gadījums, kad kļūdains nolasījums nejauši izturēja kontrolcipara pārbaudi.
- Otrā kārta neskaidrajiem laukiem (Tesseract): kods, tālrunis, e-pasts un datums tiek atpazīti vēlreiz savā apgabalā.
- “Vārds Uzvārds” vienā rindā vai zonā tiek sadalīts vārdā un uzvārdā. Anketas paskaidrojumi, piem. “(vārds, uzvārds)”, vērtībās neiekļūst.
- Kā iepriekš, viss nolasītais vispirms nonāk pārbaudes formā, un kartītē tikai pēc saglabāšanas.

## 1.9.4 — 2026-10-12 — Mierīgs starts
- Rīka atvēršana vairs nerada “nesaglabātas izmaiņas” un nepārraksta datu failu. Pēdējās atvēršanas datums (vecuma izmaiņu paziņojumiem) tagad glabājas pārlūkā.
- Startā vairs nerāda “Pieslēdz datu mapi”, ja mape jau ir atcerēta. Tā vietā redzams **“Atver datu mapi”** ar progresa joslu un soļiem: meklē mapi, pārbauda piekļuvi, pārbauda pieejamību, nolasa datu failu, mācību gadu mapes. Ja mape atbild lēni, parādās “uzgaidi”.
- Ja mapi neizdodas atvērt, tiek parādīts konkrēts iemesls un ieteikumi: mape nav atrasta, mapē nav datu faila vai mape neatbild. Pieejamās pogas ir **↻ Mēģināt vēlreiz**, **Izvēlēties citu mapi** un ievilkšana. Ja trūkst datu faila, tukša uzskaite automātiski vairs netiek izveidota.
- Pēc ielādes dokumentu indeksēšana notiek fonā ar skaitītāju, un ar personām var strādāt uzreiz.
- Jaunai mapei datu fails tiek izveidots uzreiz pēc pieslēgšanas.

## 1.9.3 — 2026-10-12 — Tīmekļa versija (GitHub Pages)
- Programmu var atvērt no `https://cadet-tools.github.io/PSVS/`. Dati paliek datora mapē, ko izvēlas katrs lietotājs. Tīkla ceļa (`\\jicfs01`) problēma šai versijai neattiecas.
- Teksta atpazīšana (Tesseract 7, latviešu + angļu) ir iekļauta pašā rīkā. Tīmekļa versija nesazinās ar ārējiem serveriem; to nodrošina drošības politika (CSP). Izņēmums ir Google Vision, ja to ieslēdz ar savu atslēgu.
- Bezsaistes kešs: pēc pirmās atvēršanas programma un atpazīšana strādā bez interneta. Jauna versija tiek ielādēta automātiski, un parādās paziņojums “↻ Pārlādēt”.
- Iespēja instalēt kā lietotni (Chrome “Instalēt”), bez administratora tiesībām.
- Testa kanāls `/test/` ar atsevišķu atmiņu (atcerēto mapi), lai jaunas versijas pārbaudītu ar testa datiem.
- Lokālā `file://` versija strādā kā līdz šim.

## 1.9.2 — 2026-10-12 — Programmas atrašanās vieta
- Programma atpazīst, ka `index.html` atvērts no tīkla ceļa (`file://jicfs01/…`), un uzreiz parāda brīdinājumu. No šādas vietas Chrome nepiešķir rakstīšanas atļauju: dialogs atgriež `AbortError`, poga “Atļaut piekļuvi” atgriež `SecurityError … in this context`. Risinājums: atvērt programmu no lokālas mapes vai caur diska burtu.
- Kļūdai “Not allowed to request permissions in this context” tagad ir precīzs skaidrojums. Diagnostikā redzama programmas atrašanās vieta.

## 1.9.1 — 2026-10-12 — Datu mapes pieslēgšana darba datorā
- **Mapes ievilkšana no File Explorer** kā pilnvērtīgs pieslēgšanas veids: lauks “⇩ Ievelc datu mapi šeit” pārskatā un Iestatījumos, kā arī sānjoslas rinda “Datu mape”. Kamēr mape nav pieslēgta, to var ievilkt jebkur logā. Pēc ievilkšanas spied “🔓 Atļaut piekļuvi”, un Chrome atļauj rakstīšanu.
- Pirms ielādes tiek pārbaudīts, vai mapē var rakstīt. Pārbaudei tiek izveidots un izdzēsts īslaicīgs fails; esošie faili netiek skarti. Ievilktā mape tiek atcerēta tāpat kā izvēlētā, arī pēc pārlūka restartēšanas.
- Mapes dialogs tiek atvērts klikšķī kā pirmā darbība, bez iepriekšēja apstiprinājuma un bez `id`. Jautājums par nesaglabātām izmaiņām tiek uzdots pēc mapes izvēles. Dubultklikšķis neatver divus dialogus.
- Precīzi kļūdu ziņojumi. Agrāk `AbortError` tika paslēpts; tagad ziņojums paskaidro sistēmas mapes bloķēšanu (tīkla profils) un piedāvā ievilkšanu. Iestatījumos ir “Mapes piekļuves diagnostika”: protokols, API, pēdējais solis, kļūda un laiks ms.
- Ievilkts fails, nevis mape, vai fails, kas ievilkts ārpus laukiem, vairs neatver failu pārlūkā un neaizved prom no programmas.
- Ātrā ielāde saglabāta: `app.bundle.js` (17 faili vienā), CSS iekļauts `index.html`, logo 6 KB.

## 1.9 — 2026-10-12 — Dokumentu mapes kartītē
- Katram mācību gadam un personai ir mape `Macibu_gadi/<gads>/Personas/<ID>_<uzvārds>_<vārds>/`. Jauna persona to izveido automātiski. Pārcelšana izveido nākamā gada mapi un nekopē vecos failus.
- Kartītes sadaļā Dokumenti var izveidot apakšmapes, pievienot faila kopiju izvēlētajā mapē, pārlūkot, meklēt pēc nosaukuma, atvērt, pārdēvēt un pārvietot. Oriģināls datorā netiek dzēsts. Esošs fails netiek pārrakstīts bez apstiprinājuma.
- Pārdēvēšana un pārvietošana izmanto pārlūka `move()` un pēc tam pārbauda galamērķi. Ja to nevar izdarīt droši, dokuments paliek savā vietā. Sasaite kartītē tiek atjaunota.
- Dokumenta veids un statuss (papīrs, eDoc, elektronisks, saņemts, pārbaudīts, jāprecizē, trūkst, derīgums) glabājas datu failā.

## 1.8 — 2026-10-12 — Mācību gadi
- Mācību gadu reģistrs no 2017–2018 līdz 2026–2027. Pašreizējais gads ir no 1. septembra līdz 31. augustam. Nākamos gadus pievieno bez pēdējā gada ierobežojuma, un vienāds gads netiek veidots otrreiz.
- Augšējā labajā stūrī ir izvēlne **Mācību gads**. Izvēle paliek iestatījumos. Gada maiņa nedzēš un nepārvieto datus.
- Viena persona ir viens profils. Grupu un dalības statusu katram gadam glabā dalības ieraksts. Pārcelšana pievieno jaunu gada dalību un atstāj iepriekšējo gadu.
- Personu sarakstā ir **Pārcelt no cita gada**: avota gads, meklēšana, atzīmes, grupa galamērķī un brīdinājums, ja persona jau ir gadā vai ir arhivēta.
- Datu mapē tiek sagatavotas `Dokumenti`, `Macibu_gadi/<gads>/{Dokumenti,Pasakumi,Atskaites}` un `Rezerves_kopijas`. Esošās mapes un personu dokumenti netiek pārvietoti.
- Migrācija uz shēmu v6 ir atkārtoti droša. Personas bez droši nosakāma gada netiek uzminētas. Pirms migrācijas tiek veidota JSON kopija, ja datu mape ir atvērta.
- OCR veidnes, dokumentu saites, ekipējuma vēsture un arhīvs paliek. Neatdotais ekipējums seko personai arī nākamajā gadā.

## 1.7 — 2026-10-11 — Stabilitāte
- Datu saglabāšana ir secīga, ar struktūras pārbaudi pirms un pēc rakstīšanas. Ārēji mainīts fails netiek klusi pārrakstīts. Neveiksmes gadījumā paliek nesaglabāto izmaiņu indikators, un rezerves kopijas kļūda vairs netiek paslēpta.
- JSON kopijas ar datumu un laiku mapē `_rezerves`: saraksts, pārbaude, manuāla kopija un atjaunošana. Pirms atjaunošanas tiek saglabāta pašreizējā versija. Kopija bez dokumentu failiem netiek saukta par pilnu.
- Datu arhīvs mapē `_arhivi`: JSON, manifests ar ceļiem, izmēriem un SHA-256, pamatmapes reģistrētie faili. Ārējās mapes tikai ar piekrišanu. Ja fails nav iekļauts, arhīvs ir daļējs.
- Papildu mapēm ir stabils ID. Rokturi tiek atcerēti. Pēc palaišanas var pieslēgt atkārtoti. Vienāds nosaukums neapvieno divas mapes. Dokumentu saites paliek, ja mape nav pieejama.
- Dokumentu statusi: Pieejams, Nav piekļuves, Nav atrasts, Jāpārbauda. Var atjaunot sasaisti, nepārvietojot failu un neizdzēšot vēsturi.
- Jaunām personām mapes nosaukumā ir nemainīgs ID (`P000001_Uzvards_Vards`). Esošās mapes netiek pārdēvētas. Uzvārda maiņa neveido otru profilu.
- Arhivējot tiek saglabāts dokumentu un ekipējuma stāvoklis. Dzēšana izņem tikai reģistra ierakstu un pirms tam parāda, kas paliek. Glabāšanas termiņš tikai brīdina.
- WhatsApp, SMS un e-pasts: statusi Sagatavots, Atvērts ārējā lietotnē, Lietotājs apstiprinājis nosūtīšanu, Atcelts. Loga atvēršana vairs netiek uzskatīta par nosūtīšanu.
- PDF.js, QR un Tesseract ir mapē `vendor/`. Google Vision paliek izslēgts, kamēr to neieslēdz. OCR darbinieks no `file://` var nedarboties — manuālā ievade paliek.
- Datu shēma v5. Vecie lauki un v2–v4 dati tiek pārņemti.

## 1.6 — 2026-10-11
- Rīkos pievienots **DVS portāls** (dvs.mod.gov.lv) — personas kartiņā un pārskata ātrajās darbībās. Rīkus bez personas datiem saitē (E-klase, DVS) var atvērt tieši no pārskata.

## 1.5 — 2026-10-11
- **Ekipējums:** jauni lauki — izmērs, daudzums; tabulā redzams viss (inv. nr., izmērs, daudzums, datumi, statuss, piezīmes, piezīme atdodot); ierakstus var labot un dzēst; atdodot var ierakstīt stāvokli.
- **MTL aprites lapa:** redzama personas cilnē “Ekipējums” (pēdējā un iepriekšējās) un dokumentos. Nav obligāta, kamēr nav izsniegts ekipējums. Brīdina, ja ekipējums izsniegts bez MTL lapas vai ja pēc izsniegšanas/atdošanas/labošanas nav pievienota jauna lapa. MTL faili tiek nosaukti ar datumu.
- **Paziņojumi, atverot rīku:** vecuma izmaiņas kopš pēdējās reizes (t.sk. kļuvis pilngadīgs), viss, kas jāpārbauda (MTL, dokumenti, tālruņi, ekipējums, uzdevumi), un tuvākie notikumi.

## 1.4 — 2026-10-11
- Telefona kontaktos ir saistītie cilvēki: bērna kontaktā — vecāku un ārkārtas kontakta vārdi un numuri (zvanāmi tieši no kontakta), vecāka kontaktā — bērna vārds, grupa, numurs. Tas pats arī piezīmē (redzams jebkurā telefonā).
- Google etiķetes: “Jaunsardze – jaunsargi” un “Jaunsardze – vecāki” (maināmas Iestatījumos).

## 1.3 — 2026-10-11
- **Tālruņu salīdzināšana:** katrs numurs (jaunieša, vecāku, ārkārtas) tiek salīdzināts ar visiem uzskaitē. Ja viens numurs pieder dažādiem cilvēkiem — brīdinājums pie lauka, pirms saglabāšanas, kartiņā un “Uzdevumos”. Viens vecāks vairākiem bērniem tiek uzskatīts par normālu (ℹ).
- **Kontakti uz telefonu / Google:** kartiņā “📇 Uz telefonu” — QR kods katram kontaktam (noskenē ar kameru) un .vcf fails importam Google Contacts. Pēc jaunas personas saglabāšanas tiek piedāvāts “📇 Saglabāt kontaktos”. Sarakstā atlasītajiem — “📇 vCard”.

## 1.2 — 2026-10-11
- **Lauku iezīmēšana (veidnes):** ievades logā “✎ Iezīmēt laukus” → klikšķis uz lauka formā → dokumentā novelk taisnstūri ap atbildi. Vērtība tiek nolasīta uzreiz; veidni saglabā (“Veidne 1”…) un nākamreiz izvēlas sarakstā “Veidne”.
- Veidne automātiski izlīdzina nelielu skenējuma nobīdi pēc etiķetēm; neiezīmētie lauki joprojām tiek lasīti pēc etiķetēm.
- Ja “Vārds” vietā rakstīts vārds un uzvārds kopā — tie tiek sadalīti.
- **Grupas atcerēšanās:** 📌 pie lauka “Grupa” — piesprausta grupa tiek ielikta katrai jaunai personai (arī anketu ievadē un importā), “✕ Nomest” to atceļ.

## 1.1 — 2026-10-11
- **Dokumentu lasītājs** aizstāj anketu veidnes ar zonām. Lauki tiek atrasti pēc etiķetēm un izkārtojuma, tāpēc veidlapu versijas drīkst atšķirties.
- Precīza nolasīšana bez atpazīšanas no **Word (.docx)**, **PDF ar teksta slāni** un **eDoc**.
- Jaunsardzes "Iesniegums – anketa" profils: jaunietis, likumiskais pārstāvis, ārkārtas kontaktpersona un foto piekrišana.
- Skenējumiem atpazīšana notiek divās kārtās. Personas koda rūtiņas tiek nolasītas pa vienai, un izvēles rūtiņas tiek noteiktas pēc tintes daudzuma.
- **Skatītājs darbojas kā PDF skatītājs:** ritināšana, Ctrl + ritenītis, pogas, lapu numuri. Vilkšana kā attēlam vairs netiek izmantota.
- Klikšķis uz lauka iezīmē tā vietu dokumentā arī DOCX failos.
- Kartiņas dokumentos ir poga "📥 Nolasīt", kas atkārtoti nolasa piesaistītu anketu.

## 1.0 — 2026-10-11
**Pārbūve uz moduļiem** (HTML, CSS un JS atsevišķos failos). Datu shēma v4. Dati no 0.2 un 0.3 tiek pārņemti automātiski.

### Anketu ievade (pārstrādāta no jauna)
- Pilnekrāna logs ar dokumentu un formu blakus. Dokumentu var tuvināt ar ritenīti un pārvietot, velkot, arī bez teksta atpazīšanas.
- Anketu veidnes: zonas katram laukam. Klikšķis uz lauka pietuvina tā vietu dokumentā.
- Atpazīšana pa zonām ar ierobežotām simbolu kopām. Attēla priekšapstrāde: kontrasts, ēnu izlīdzināšana, līniju un rāmju noņemšana.
- Vērtību validācija: personas koda kontrolcipars, tālrunis, e-pasts, datums, vārds. Aizdomīgas vērtības laukā netiek ieliktas, bet tiek piedāvātas kā ieteikums.
- Klikšķis uz atpazītas rindas dokumentā ieliek tekstu aktīvajā laukā.
- Iespēja izmantot Google Cloud Vision rokrakstam. Pēc noklusējuma izslēgta.
- Režīms "Saglabāt un nākamā". Salāgošana nobīdītiem skenējumiem.
- Visi ziņojumi tiek rādīti loga statusa joslā.

### Personas
- Saraksts tabulā ar filtriem, kārtošanu un masveida darbībām.
- Kartiņas izkārtojums platiem ekrāniem: etiķete un vērtība atrodas blakus, kontakti ir sānjoslā.
- Statusi: kandidāts, aktīvs, pārtraukts, arhīvā.
- Vēstures laika josla: saziņa, piezīmes, uzdevumi ar termiņu, izmaiņu audits.
- Dublikātu pārbaude. Personas koda maskēšana. Datu eksports pēc pieprasījuma. Neatgriezeniska dzēšana ar apstiprinājumu.

### Citas izmaiņas
- Noņemta poga "Karte" (Google Maps).
- Ziņojumi parādās aktīvajā logā, nevis aiz tā.
- Konflikta aizsardzība: datu fails mainīts citur vai programma atvērta vairākās cilnēs.
- Dokumenti: rediģēšana (derīguma termiņš, piezīmes), failu ievilkšana kartiņā, trūkstošo dokumentu skats.
- Imports: dublikātu atpazīšana, grupas piešķiršana, vairāk kolonnu nosaukumu (arī e-klases eksports).

## 0.3
WhatsApp un e-pasts no kartiņas, pirmā teksta atpazīšanas versija, dokumentu ieteikumi.

## 0.2
Lokālā uzskaite JSON failā, dokumentu indekss, ekipējums, arhīvs.
