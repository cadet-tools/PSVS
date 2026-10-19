# Izmaiņu vēsture

## 1.58.0 — 2026-10-19
- **MI palīgs ieslēgts arī stabilajā versijā** (`MI_STABLE = true`, saknes `index.html` / `app.bundle.js` 1.58.0, CSP `connect-src` ietver `api.groq.com`). Jaunumu logs lietotājiem no 1.57.0. Testa kanāls paliek ar to pašu MI.
- Būvēšana bez visa repo tīrīšanas: `src/_buvesana/build_stable.py` (sakne), `build_test.py` (`test/`).
- Sākotnēji testa kanālā (`js/ai.js`, `MI_STABLE` bija `false`):
  - MI palīgs meklēšanas logā: poga `#miBtn` “Jautāt MI”, josla `#miBar` (Ctrl+Enter), sarunas panelis `#miPane` (MI režīmā Enter sūta, “← Meklēšana” atgriež iebūvēto palīgu). `assist.js` netiek mainīts — `A.cmdk` tiek papildināts, vadītais palīgs — `CP.assist.guide`.
  - Atbilde JSON `{ answer, guide: [HELP indeksi], page, offtopic }` → pogas “Parādīt, kur → …” (iebūvētā palīga soļi) un “Atvērt: sadaļa”. Noteikumi (`RULES`): tikai par rīku, tikai no padotajām zināšanām, latviski, īsi; ārpus tēmas — atteikums.
  - Zināšanas katram jautājumam: sadaļu saraksts, 16 fakti (6 atbilstošākie), visu pamācību virsraksti un 4 atbilstošākās pamācības ar soļiem (~2000 tokenu).
  - Pirms sūtīšanas `CP.ai.redact`: personas kodi → [kods], tālruņi → [tālrunis], e-pasti → [e-pasts], datu failā esošie personu, vecāku, darbinieku un instruktora vārdi (arī locījumos) → [persona]. Nosūtītais teksts redzams zem jautājuma.
  - Kopīgais MI caur Apps Script starpnieku `docs/mi/Kods.gs` (`MI_URL`; testam `localStorage cp.miUrl`): Groq atslēga tikai skripta rekvizītos, jautājumi netiek saglabāti, limiti — lietotājam 20 / 6 h (`cp.miId`), kopā 2500 dienā un 15 minūtē; modeļi pēc kārtas `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` (ja 429 — nākamais).
  - Sava Groq atslēga: kartīte Iestatījumi → Atļaujas → “MI palīgs” (`#miCard`, pievienota ar `CP.afterRender`, `settings.js` netiek mainīts) — `localStorage cp.miKey`, pārbaude ar `GET /models`; tad pieprasījumi tieši uz `api.groq.com` (testa CSP `connect-src` papildināta). Slēdzis “Rādīt MI palīgu” (`cp.miOff`), šodienas skaits (`cp.miUse`).
  - Statistikā tikai darbību nosaukumi `miAsk`, `miErr:<kods>`.
  - Noteikumu precizējumi: šaubu gadījumā jautājums par jaunsargiem, dokumentiem, nodarbībām u. tml. ir par rīku (nevis ārpus tēmas); sadaļas atbildē sauc latviski — `parse()` aizstāj sadaļu atslēgas (`forms` → “Veidlapas”). Fakts par līgumu 18 gados: brīdinājums personas kartītes galvenē ar pogām “📄 Sagatavot līgumu ar jaunsargu” un “✓ Līgums noslēgts”.
  - Kļūdu ziņas latviski ar darbībām: “Pievienot savu Groq atslēgu”, “↻ Mēģināt vēlreiz”, “Iebūvētais palīgs”; 429 ar `retry-after` ≤ 120 s — “aizņemts”, citādi — dienas limits.
  - Labojums: atkārtoti atverot meklēšanas logu, iepriekšējā MI saruna un tukšā josla vairs nepaliek redzamas (`.mi-pane[hidden]`, `.mi-bar[hidden]` — `display:flex` pārrakstīja `hidden`).
  - Kopīgais MI pieslēgts: `MI_URL` — Apps Script tīmekļa lietotne “CADET PERSONALS GROCK MI” (adrese nav slepena; Groq atslēga tikai skripta rekvizītos).
  - “Kas tu esi”, “ko vari”, “sveiks” — iepazīšanās atbilde uzreiz rīkā, bez sūtīšanas un netērējot limitu (`ABOUT_Q`).
  - Sarunas logā slēdzis **Kopīgais / Sava atslēga** un atlikuma josla (kopīgais: palikuši / 20; sava: Groq tokeni vai minūtes limits). Ja sava atslēga 429 — paziņojums un pārslēgšanās uz kopīgo. Jokam īsāks kb; svešu jautājumu nesasaista ar tuvāko pamācību.
  - Izstrādei `docs/mi/mimock.js` — vietējais serveris, kas izpilda īsto `Kods.gs` (`/__mi/dev` ieslēdz testa versiju ar vietējo starpnieku).
- Būvēšana: `src/_buvesana/build_test.py` pārbūvē tikai `test/`; `build_web.py` — `CSP_TEST` un `tools/mi` → `docs/mi`. Pārbaude: `node docs/mi/mi_test.mjs`. Apraksts: `docs/MI.md`.

## 1.57.0 — 2026-10-19
- Meklēšana un palīgs, gada noslēguma vednis, datu veselība un atjaunošanas pārbaude (1.56.0 testa kanālā) — **ieslēgti arī stabilajā versijā** (`CHANNEL` pārbaudes noņemtas `assist.js`, `health.js`, `yearend.js`).
- Palīgs vada pa soļiem: atbildē redzami numurēti soļi; izvēloties atbildi, atveras panelis `#cpGuide` (pārvietojas atvērtajā dialogā, lai būtu lietojams), palīgs pats atver lapu/iestatījumu kartīti/dialogu un iezīmē vietu (`.cp-guide-hl`); uzspiežot uz iezīmētās pogas — nākamais solis; “Atpakaļ”, “Parādīt vēlreiz”, “Gatavs”. Soļi, kas jau izpildīti (persona jau atvērta), tiek izlaisti. 31 jautājums; tests t128 pārbauda, ka katra soļa vieta tiek atrasta.
- Darbības ar personu no meklēšanas: vārds jebkurā locījumā + nodoms (“Annai pievienot dokumentu”, “Kalniņa ekipējums”, “Laurai kopsavilkums”) → tieši personas cilne ar iezīmētu pogu vai attiecīgais logs; tikai vārds — ātrās darbības.
- Datu veselība: katrai piezīmei “Ko tas nozīmē?” — kāpēc rodas, ko darīs labojums vai ko darīt pašam, konkrētie atrastie ieraksti (dokuments + datums + fails, gads + grupa, nodarbības datums…); atzīme “izlabojams automātiski” / “jāpārskata pašam”; saraksts “Kas tiek pārbaudīts” ar ✓ vai skaitu.
- Tests t54 pārrakstīts: vecās piezīmes (`p.notes`, `enrollment.note`) migrācijā pāriet uz žurnālu ar sākotnējo datumu; žurnāla pievienošana, labošana, Esc, dzēšana, gada piezīmes, saglabāšana pēc pārlādes — abos kanālos.

## 1.56.0 — 2026-10-19
- **Tikai testa kanālā** (`CP.CHANNEL === 'test'`):
  - `js/assist.js` — meklēšana pa visu rīku un palīgs: Ctrl+K (agrāk fokusēja sānjoslas meklēšanu; “/” to dara joprojām) vai poga `#cmdkBtn` augšējā joslā. Meklē personas (vārds, grupa, vecāku vārdi), dokumentu ierakstus, pasākumus, sagatavotās veidlapas (`formDocs`), sadaļas, iestatījumu kartītes un darbības; bez garumzīmēm (`U.norm`), pēc vārda sākuma. Palīgs: ~30 iepriekš uzrakstītas atbildes ar atslēgvārdiem un pogu “Aiziet” — nav mākslīgais intelekts, nekas netiek sūtīts.
  - `js/yearend.js` — mācību gada noslēguma vednis (gada izvēlne, Iestatījumi → Mācību gadi, palīgs): 6 soļi ar esošajām funkcijām (`D.missingDocs`, `A.remindDocs`, ekipējums, `A.sumNew('*')` — visi gada jaunsargi, nākamā gada izveide, `A.openMove(no, uz)`, `store.backupNow` + atjaunošanas pārbaude, `A.setYear`). Progress `settings.yearEnd[gads].done`.
  - `js/health.js` — datu veselības pārbaude pēc datu mapes atvēršanas un kartītē Iestatījumi → Drošība (`#healthCard`): dublēti/trūkstoši ID, dalības, saistības, apmeklējuma atzīmes un pasākumu dalībnieki ar neesošām personām, dokumenti/ekipējums/uzdevumi/VFS bez personas (tikai parāda), neesoši mācību gadi. “Izlabot drošās kļūdas” — vispirms JSON kopija; dokumenti, ekipējums un personas netiek dzēsti.
  - Atjaunošanas pārbaude `store.testRestore(name)`: nolasa jaunāko kopiju no `_rezerves`, `validateDb` + `CP.migrate` atmiņā, salīdzina skaitus ar pašreizējiem datiem; dati netiek mainīti. `settings.restoreCheckAt`; pēc 30 dienām atgādinājums Uzdevumos (brīdinājumiem jauns lauks `act`/`actLabel` — poga ar darbību) un vienreiz sesijā paziņojums.
- Personas dzēšana (`eraseRecord`) dzēš arī tās dalības ierakstus mācību gados (agrāk palika nesaistīti).
- Jaunumi: bloki “Signal” un “Ziņot” apvienoti; “Dalībnieki no citām vienībām” iekļauts blokā “Pasākumi”.

## 1.55.0 — 2026-10-18
- Pareizrakstības pārbaude ar **rīka iebūvētu latviešu vārdnīcu** (Hunspell WebAssembly `vendor/spell/hunspell.min.js` — hunspell-asm 4.0.2, MIT; vārdnīca `lv.aff`/`lv.dic` — dictionary-lv 2.0.0, LGPL 2.1, J. Eisaks) atsevišķā pavedienā `vendor/spell/worker.js`. Vairs nav atkarīga no Chrome iestatījumiem; darbojas bezsaistē (faili bezsaistes sarakstā), teksts netiek sūtīts. Pārbauda visu dokumentu ar īstu progresu (vārdi pārbaudīti / kopā), kļūdas iezīmē ar CSS Custom Highlight (`::highlight(cp-spell)` — DOM netiek mainīts), pēc labojuma pārbauda rindkopu vēlreiz. Labā peles poga — ieteikumi (Hunspell suggest), “Ignorēt”, “Pievienot manai vārdnīcai” (`localStorage cp.spellDict`). Izlaiž {atzīmes}, e-pastus, saites, saīsinājumus (Nr.) un īsus lielo burtu vārdus. Pārlūka paša pareizrakstība redaktorā izslēgta.

## 1.54.3 — 2026-10-18
- Atzīmju redaktorā virs dokumenta pareizrakstības pārbaudes josla ar procentiem un atlikušo laiku. Chrome neziņo, kad pārbaude beigusies, tāpēc laiks ir aptuvens pēc vārdu skaita (3 s + 1 s uz 25 vārdiem, ne vairāk kā 60 s); beigās “✓ Pareizrakstība pārbaudīta”, josla pazūd.

## 1.54.2 — 2026-10-18
- Atzīmju redaktors: viss dokuments ir viens rediģējams laukums (`#teDoc contenteditable`), tāpēc Chrome pareizrakstības pārbaude aptver visu tekstu uzreiz pēc atvēršanas, nevis tikai rindkopu, kurā ir kursors. Rindkopu robežas sargā `beforeinput`: Enter, dzēšana pāri robežai un iezīmējums vairākās rindkopās netiek atļauti; ielīmētais teksts — vienā rindā.

## 1.54.1 — 2026-10-18
- Pareizrakstības palīdzībā precīzs Chrome slēdža nosaukums un latviešu vārdnīcas ieslēgšana.

## 1.54.0 — 2026-10-18
- Atzīmju redaktorā latviešu pareizrakstības pārbaude: rindkopām `spellcheck` + `lang="lv"` (pārlūka vārdnīca datorā, teksts netiek sūtīts), slēdzis “Pārbaudīt pareizrakstību” (`localStorage cp.teSpell`), atverot visas rindkopas īsi fokusē, lai kļūdas parādītos uzreiz. Palīdzības logs, kā Chrome / Edge ieslēgt latviešu vārdnīcu ar “Pamata” pārbaudi.

## 1.53.1 — 2026-10-18
- Atzīmju redaktors rāda rindkopas tā, kā tās izskatās Word: līdzinājums (centrā / pa labi / abās malās), treknraksts, slīpraksts, burtu izmērs, atkāpe un numurēti saraksti. Tikai attēlošana — dokumenta formatējums kā līdz šim netiek mainīts.

## 1.53.0 — 2026-10-18
- Veidlapu lapas jaunais izkārtojums (1.52.5 testa kanālā) ieslēgts arī stabilajā versijā (`NEWUI() → true`).

## 1.52.5 — 2026-10-18
- **Tikai testa kanālā** (`NEWUI()` forms.js): Veidlapu lapas jaunais izkārtojums — galvenes pogas vienādas (instruktāža vairs nav izcelta); “Savas Word veidnes”: veidņu saraksts ar vienādām darbību pogām, grupas “Ielādēt veidni” (4 pogas režģī) un “Paraugi lejupielādei” (3), “Pieejamās atzīmes” — skaidra poga ar ▾, kas izver sarakstu; kastītes “Darbinieki un audzinātāji” un “Savas Word veidnes” vienāda augstuma (`.forms-eq`, bez mūra izkārtojuma). Stabilajā versijā nekas nemainās.

## 1.52.4 — 2026-10-18
- Savas veidlapas ar vienības logo: galvenes tabula 3 kolonnās ar fiksētu platumu (logo · nosaukums · CADET.LV + “CADET PERSONĀLS”). Garš nosaukums līdz 120 zīmēm un ļoti gari vārdi tiek dalīti, tāpēc vairs nepārbīda CADET.LV logo ārpus lapas. Ja CADET.LV logo neizdodas ielādēt, dokuments netiek sagatavots ar vienības logo (paziņojums), — vienības logo nekad nav bez CADET.LV.

## 1.52.3 — 2026-10-18
- Rīka galvenē: ja ir vienības logo / nosaukums, centrētajam CADET.LV logo apakšā uzraksts “CADET PERSONĀLS” (`.hdr-logo.with-unit`); tumšajā tēmā CADET.LV logo gaišāks. Šaurā logā (≤ 820 px), kur CADET.LV logo paslēpts, paslēpts arī vienības logo — vienības logo nekad nav redzams bez CADET.LV. Kopsavilkuma PDF un savās veidlapās tas jau bija.

## 1.52.2 — 2026-10-18
- Savas veidlapas vairs netiek automātiski lejupielādētas: faili vienmēr tiek saglabāti datu mapē (piesaistītie — personas mapē, pārējie un saraksti — `Macibu_gadi/<gads>/Veidlapas/<nosaukums datums>/`), ieraksts `S.db.formDocs` = { id, tid, name, mode, date, at, yearId, files: [{ pid, pids, name, path }] }. Sarakstā “Sagatavotās veidlapas” (filtrs “Savas veidlapas”): Skatīt (vairākiem — saraksts ar katru dokumentu), Lejupielādēt (viens — Word, vairāki — ZIP), noņemt no saraksta (faili paliek). Pēc sagatavošanas pirmais dokuments atveras apskatei. Darbību žurnālā — “Sava veidlapa”. Veidlapu galvenē poga “Sava veidlapa”.

## 1.52.1 — 2026-10-18
- Savas veidlapas: izvēle “Ar vienības logo un nosaukumu” (atceras katrai veidnei — `t.brand`, noklusējumā izslēgta). Dokumenta sākumā tiek ielikta tabula bez rāmjiem: vienības logo un nosaukums pa kreisi, CADET.LV logo un “CADET PERSONĀLS” pa labi (attēli `word/media/cp_*.png`, saites `rIdCpUnit`/`rIdCpCadet`). Instruktāžas, nometnes un līgumu veidnēm logo netiek likts.

## 1.52.0 — 2026-10-18
- `js/customforms.js`: savas veidlapas (`docTemplates` ar `type: 'custom'`). Režīms pēc veidnes: personas atzīmes tabulas rindā → saraksts; citur → katrai personai savs dokuments (ZIP, pēc izvēles saglabā personas mapē un piesaista kartītei kā “Cits” ar veidnes nosaukumu). Logs `A.cfNew('tid|pid')`: veidne, datums, vieta, personas; “Apskatīt” — Word skatītājā rīkā. Personas atzīmes (`PERSON_HELP`) un vispārīgās (`GLOBAL_HELP`) — Veidlapas → Pieejamās atzīmes.
- `docxfill.js`: atzīmju nosaukumi normalizēti (`{Vārds}` = `{vards}`, atstarpes → `_`); `scan()` atrod visas atzīmes un tās tabulu rindās; `fill()` pieņem `rowKeys`, darbinieku rindas — pēc izvēles.
- `js/tpledit.js`: atzīmju redaktors rīkā (“✎ Atzīmes” pie katras savas veidnes): rindkopas un tabulas šūnas labojamas, atzīmes ieliek kursora vietā vai aizstāj iezīmēto tekstu; izmaiņa tiek ierakstīta tikai tajā run, kur tā notiek (formatējums saglabājas); “＋ Rindkopa”, “＋ Tabulas rinda”. Saglabā kā jaunu failu “… (labots DD.MM.GGGG).docx” mapē Veidnes, vecais paliek (`t.prev`).
- Instruktāžas / nometnes Word veidne (`A.formDocx`) tagad atveras apskatei rīkā (lejupielāde — skatītāja pogā), kopija kā līdz šim pasākuma mapē.

## 1.51.1 — 2026-10-18
- Kopsavilkuma PDF: CADET.LV logo augstākā izšķirtspējā ar caurspīdīgu malu (`vendor/brand/CADET_pdf.png`, 1200 px) — kreisā mala vairs neizskatās nogriezta. Garš vienības nosaukums tiek lauzts rindās (arī ļoti gari vārdi — pa burtiem), ne vairāk kā 3 rindas ar “…”, un nekad nepārklāj CADET.LV logo.

## 1.51.0 — 2026-10-18
- `js/unit.js`: vienības nosaukums un logo (`settings.unit = { name, logo }`; attēls → PNG ≤ 512 px datu failā). Kartīte Iestatījumi → Pamata → “Vienība”; galvenes joslā kreisajā pusē (`#unitBadge`, platums ierobežots līdz centrētajam CADET.LV logo).
- Kopsavilkuma PDF galvene: labajā pusē vienmēr CADET.LV logo ar uzrakstu “CADET PERSONĀLS”; kreisajā — vienības logo un nosaukums, ja logā atzīmēts “Ar vienības logo un nosaukumu” (`settings.summary.unit`, noklusējumā ieslēgts). Oficiālās veidlapas (instruktāžas lapa, nometnes žurnāls, līgumi, VFS protokols, apmeklējuma žurnāls) netiek mainītas — bez logo un uzrakstiem (pārbauda t120).

## 1.50.0 — 2026-10-18
- `js/summary.js`: jaunsarga kopsavilkums (PDF, pdf-lib + Manrope `vendor/pdf/Manrope_*.ttf`, logo `vendor/brand/CADET_pdf.png`). Dati periodā no–līdz: nodarbības (personas grupa attiecīgajā mācību gadā vai `*`), % pa mēnešiem; pasākumi (`S.db.events` + sesijas ar veidu ≠ Nodarbība, dublikāti apvienoti); kvalifikācijas (periodā iegūtās iekrāsotas); VFS testi (`CP.vfs.score`, dinamika ar nozīmīšu robežām, pēdējā testa vingrinājumi pret pirmo). Galvenē tikai vārds un uzvārds.
- Logs `A.sumNew(pid?)`: periods (ātrās izvēles — šis / iepriekšējais mācību gads), sadaļu izvēle un kopīgais teksts saglabājas `settings.summary`, personas komentārs — `p.summaryComment`. Vairākām personām: grupa, meklēšana, “Atzīmēt redzamos”; katram savs PDF → ZIP. Saglabā `CP.store.yearPersonDir(p)` un piesaista kā dokumentu “Kopsavilkums”.
- Pogas: personas kartītes Pārskatā (kartīte) un ⋯ izvēlnē; Veidlapas galvenē. `CP.vfs.exName` eksportēts.

## 1.49.0 — 2026-10-18
- Analītika ieslēgta arī stabilajā kanālā (`CP.ANALYTICS_STABLE = true`) pēc pārbaudes testa kanālā ar īsto Apps Script saņēmēju. Jaunumu bloks “Lietošanas statistika” redzams abos kanālos.

## 1.48.2 — 2026-10-18
- Analītika: personu skaita grupa tiek sūtīta tikai ar pieslēgtu datu mapi (bez mapes — tukša, nevis “0”).

## 1.48.1 — 2026-10-18
- `CP.ANALYTICS_URL` — izstrādātāja Apps Script saņēmējs “CADET PERSONALS analitika” (tīmekļa lietotne, versija 1). Analītika joprojām aktīva tikai testa kanālā.

## 1.48.0 — 2026-10-18
- Lietošanas analītika (`js/analytics.js`, apraksts `docs/ANALYTICS.md`) — **pastāvīga rīka daļa**. Darbojas tikai tīmekļa versijā un testa kanālā (`CP.ANALYTICS_STABLE = false`); sūta tikai, ja norādīta `CP.ANALYTICS_URL` (vai testam `localStorage cp.anUrl`). Sesija (pārtraukums > 30 min → jauna): aktīvais laiks (30 s solis, ja bija ievade pēdējās 5 min), sadaļas (`ui.go`), darbību nosaukumi (`app.js` → `CP.analytics.act`), kļūdas `veids@fails:rinda` / `act:<darbība>` bez teksta; vide (versija, kanāls, lietotne/pārlūks, OS, pārlūks, ekrāna grupa, valoda, laika josla), instruktora pārvaldes / nodaļas numurs, personu skaita grupa. Pastāvīgs nejaušs ID `cp.anId`.
- Rinda `cp.anQ` (≤ 300 sesijas, ≤ 60 dienas), sūtīšana paketē ≤ 50 (sākumā pēc 10 s, ik 15 min, `online`, aizverot/paslēpjot cilni); sesijas ID + `rev` — atkārtota sūtīšana atjauno to pašu rindu. Izslēgšana Iestatījumi → Atļaujas (`A.anToggle`, dzēš rindu un ID; `cp.anOff`). Vienreizējs paziņojums par sīkdatnēm (`cp.anSeen`). “Par rīku” teksts precizēts.
- Saņēmējs un panelis — `tools/analitika/Kods.gs` + `Panelis.html` (Google Apps Script; validē visus laukus, IP neredz, dzēš > 400 dienas vecas sesijas, panelis tikai ar slepenu atslēgu `?k=`). CSP nemainās (`script.google.com` jau atļauts). Jaunumu blokiem lauks `ch` (tikai kanālam).

## 1.47.1 — 2026-10-17
- Noņemta dokumentu kategorija “Vecāku piekrišana” (migrācija `kind-noconsent`: no `docKinds` un `requiredDocs`, esošie dokumenti → “Vecāku atļauja”). `D.guessKind` izmanto `D.allDocKinds()` — faila nosaukums ar “atļauja/piekrišana” → “Vecāku atļauja”.

## 1.47.0 — 2026-10-17
- `js/offline.js`: statuss galvenē (`#netPill`), logs `netDialog`; bezsaistes sagatavošana — `vendor/offline.json` (būvē `build_web.py`: visi vendor faili ar izmēru un sha1) → kešs `cadet-vendor` (nemainīgs nosaukums, neatkarīgs no versijas; mainītie faili atjaunojas pēc kontrolsummas, `localStorage cp.offlineMap`). Sākas fonā 6 s pēc atvēršanas, ja tiešsaistē un nav gatavs. Rinda arī Iestatījumi → Atļaujas.
- Pēc `online` (pārbaudīts ar `version.json`): `encBackup.run({quiet})` un `CP.gcal.sync(false)`, ja ir neiesūtītas izmaiņas un derīgs Google savienojums; citādi paziņojums ar “Pieslēgties” (`netConnect`). `CP.gcal` un `CP.encBackup.pending` eksportēti.
- Service worker: vendor faili glabājas `cadet-vendor`; veidne (docx/xlsx), kuras nav kešā, bezsaistē vairs neatgriež `index.html` (agrāk — klusi bojāts līgums), bet kļūdu. `vendor/offline.json` vienmēr no tīkla.

## 1.46.0 — 2026-10-17
- Kopēšanas pogas kartītē: `ui.dl` 4. elements — `"pid|lauks"`, `A.copyField` (personas kods — `U.fmtCode`, datumi — `U.fmtDate`, tālrunis — `U.prettyPhone`, `_full` — vārds, uzvārds).
- Nodošana: `A.transferUndo` (“↶ Atcelt nodošanu”) — atjauno no arhīva (ja iemesls “Pārgāja pie cita instruktora”), atgriež ar šo nodošanu slēgto ekipējumu, noņem `transferredTo`, piezīme. Piezīmēs: nododot — “Pārgāja no … uz …”, pārņemot — “Pārgājis no … uz …” (bija “Pārņemts/Pārnācis no …”). Dalībā pasākumos viens pasākums (Apmeklējums + Veidlapas) vairs neatkārtojas.

## 1.45.4 — 2026-10-17
- Nodošanas logā ekipējuma izvēle vienmēr ar trim iespējām; noklusējums, ja ir neatdots ekipējums — “aiziet kopā ar jaunsargu” (`hand`).
- Noņemti lauki “Foto/video publicēšana” un “Piekrišanas datums” (piekrišana dota līgumā): no `CP.FIELDS`, kartītes pārskata un anketas nolasīšanas. Agrāk ievadītās vērtības ierakstos netiek dzēstas.

## 1.45.3 — 2026-10-17
- `D.allDocKinds()` — iestatītās kategorijas + dalībnieku pasākuma dokumentu veidi + faktiski lietotās, “Cits” beigās; lieto Dokumentu lapas filtrs un visi kategoriju saraksti (`ui.kindOptions`). Agrāk filtrā nebija “Vecāku atļauja” u. c. pasākumu dokumentu. Meklēšana skatās arī dokumenta nosaukumu.

## 1.45.2 — 2026-10-17
- “＋ Jauna persona” (sānjosla, Pārskats, Personas) atver izvēli: jauna persona / pārņemt no cita instruktora / ievadīt no anketas (`A.addPerson` → `addPickDialog`; tieša forma — `A.addPersonNew`). Sānjoslā poga ⇩ (`transferIn`). Kartītes pārskata apakšā karte “⇪ Nodošana citam instruktoram”.

## 1.45.1 — 2026-10-17
- Nodošana: ekipējums — “tikai saraksts” / “nodot jaunajam instruktoram (MTL)” / “neiekļaut”. Nododot: `equipmentHandover: true`, savā uzskaitē neatdotie (ne dāvinājumi) tiek slēgti ar `returnNote` “Nodots instruktoram … — MTL pārņemts” un `handedTo`. Pārņemot: “Ievietot ekipējumu manā uzskaitē” (ieslēgts, ja nodots) — ieraksti ar `src: transfer`, `changedAt` = izsniegšanas datums (MTL nav uzreiz “novecojusi”).

## 1.45.0 — 2026-10-17
- `js/transfer.js`: `A.transferOut` — ZIP (JSZip) ar `CADET_persona.json` (`format: cadet-person-transfer`, v1: no/kam, personas lauki no `CP.FIELDS`, gadi, dokumenti ar faila ceļu, kvalifikācijas, dalība, apmeklējums, neatdotais ekipējums, pēc izvēles piezīmes un pārkāpumi), `Personas_lieta.html` (patstāvīgs pārskats ar saitēm uz `dokumenti/…`) un dokumentu failiem; `p.transferredTo`, pēc izvēles arhivēšana. `A.transferIn` — ZIP vai JSON, dublikātu meklēšana (personas kods vai vārds+uzvārds+dz. datums) ar “papildināt esošo”, dokumenti → `<personas mape>/Parnemtie/`, kvalifikācijas pēc nosaukuma, vēsture — piezīmju žurnālā; ekipējums netiek veidots.
- Jauns neobligāts personas lauks `fromInstructor` (“Pārnācis no cita instruktora”, sadaļa Mācības); kartītes galvenē “↪ no: …” un “⇪ nodots: …”.

## 1.44.2 — 2026-10-17
- Mēneša tabula: pasākuma sākuma datums vienmēr ir kolonna (`gridDates`), tās rūtiņas raksta pasākuma `att` (`cellSess` = nodarbība, ja ir, citādi pasākums, kas sākas šajā datumā); kolonna iekrāsota, datuma klikšķis atver pasākumu. Apzīmējumos — skaidrojums par ★.
- Pievienojot dalībnieka pasākuma dokumentu, dalībnieks tiek atzīmēts kā piedalījies (`markPresent` abos avotos). Pasākuma logā dokumentu pogas redzamas visiem sarakstā esošajiem.

## 1.44.1 — 2026-10-17
- “Atvērt veidlapu” no pasākuma: pasākuma logs tiek aizvērts arī tad, ja veidlapa jau sagatavota (agrāk tas aizsedza Veidlapu lapu).
- Mēneša tabulā josla “Pasākumi šajā mēnesī” — pasākumi redzami arī skatā “Jaunsardzes dienas”, ja to datums nav nodarbību diena.

## 1.44.0 — 2026-10-17
- `js/evdocs.js` — kopīgs pasākumu dokumentu modulis (avoti `form` — Veidlapas, `att` — Apmeklējuma pasākumi); `forms.js` pārrakstīts uz to (darbības `evDocAdd`/`evDocDel` ar avotu un pasākuma ID argumentā).
- Apmeklējums: “＋ Pasākums” un cilne “Pasākumi” (sesijas ar veidu ≠ Nodarbība: `topic` = nosaukums, `dateTo`, `att` tikai “+”, `docs`, `dir`). Pasākuma logā — dalībnieku atzīmēšana, dokumentu pogas, kopīgie dokumenti, “Sagatavot instruktāžas lapu / nometnes žurnālu” (`A.formFromEvent`, saite `fromSession`). Nodarbības logā vairs nav “Veids”.
- `sessFor`, personas nodarbības, rādītāji, mēneša tabula — tikai nodarbības (`isLesson`); agrāk kā nodarbība saglabātie pasākumi pāriet uz cilni “Pasākumi” un vairs neietekmē apmeklējuma %. Mēneša tabulas galvenē ★ pie datumiem ar pasākumu. Kartītē “Dalība un kvalifikācijas” — dokumentu ✓/✗ un “Atvērt”.

## 1.43.0 — 2026-10-17
- Pasākuma dokumenti (`forms.js`): dalībnieka dokumenti → `S.db.documents` ar `eventId` un `title` “<veids> — <pasākums> (datums)”, faili `Macibu_gadi/<gads>/Pasakumi/<pasākums>/Dalibnieki/<Uzvārds Vārds> - <veids>.<ext>`; kopīgie → `ev.docs`, faili pasākuma mapē. Veidi no iestatījumiem `evDocsAll`, `evDocsCamp`, `evDocsEvent`, `evDocsEventCamp`; “Cits” — ar nosaukumu (`prompt`). Pievienojot, pasākums tiek saglabāts (`commit`). Noņemšana — tikai ieraksts, fails paliek.
- Personas kartītē “Pasākumi” — ✓/✗ pa pasākuma dokumentiem. `ui.kindOptions` saglabā kategoriju, kuras nav sarakstā (piem., “Vecāku atļauja”); dokumenta logā nosaukums vairs netiek dzēsts kategorijām, kas nav “Cits”.

## 1.42.0 — 2026-10-17
- Pārcelšanas dialogs pārveidots: “No” un “Uz” gads (agrāk mērķis — tikai izvēlētais gads), atzīmes glabājas `moveSel` (meklēšana tās nezaudē), aktīvie atzīmēti pēc noklusējuma; “Nepārceltos pārvietot uz arhīvu” (`CP.people.archivePerson`, aiziešanas datums — avota gada beigas vai šodiena, iemesls “Nav pārcelts uz …”); tukša grupa = katram sava grupa no avota gada; sarakstā neatdotā ekipējuma skaits un gada dokumenti (`docValidity` ∩ obligātie), kam vajadzēs jaunu. Poga Iestatījumos: “⇄ Pārcelt dalībniekus uz citu gadu”.

## 1.41.0 — 2026-10-17
- Mācību gadu dzēšana (`A.yearDelete`): tukšs gads — `confirm`; ar dalībām/nodarbībām/pasākumiem/VFS testiem/grupām — dialogs “Pārcelt uz” (ja persona mērķa gadā jau ir, saglabājas tās esošā dalība). Dokumenti, ekipējums, uzdevumi, saziņa saglabā savu `yearId` (ārsta izziņas derīgums). Izvēlēto un pašreizējo gadu dzēst nevar. `settings.yearsDeleted` — migrācija dzēstos 2017–2026 gadus vairs nepievieno (ja nav dalību šajā gadā). Mapes datorā netiek dzēstas.
- CADET.LV logo galvenē centrēts pret logu (`centerLogo`, šaurā logā — joslas vidū). Gadu izvēlnē izvēlētais gads `--accent-soft` / `--acc` (bija fiksēti zaļš).

## 1.40.1 — 2026-10-17
- “Reģistrācija un arhīvs”: dokuments bez skenēta faila (`received()` — obligātajiem pēc `D.missingDocs`) rindā `.nogot` — sarkans, ar “＋ Fails”; atzīmējot DVS vai Centra arhīvu nesaņemtam dokumentam — apstiprinājums (atceļot atzīme netiek likta). Ja atzīme jau ir bez faila — sarkans paskaidrojums. Arhīva “saņemts” vairs neņem vērā DVS atzīmi. “Obligātie dokumenti” trūkstošie — sarkani.

## 1.40.0 — 2026-10-17
- Signal kanāls: `signal.me/#p/+<nr>` (vai `sgnl://`, iestatījums `sigMode`), ziņas teksts tiek nokopēts starpliktuvē; poga kartītes kontaktos, ziņas logā, grupas ziņā; žurnāla tips `signal` (ietilpst `D.commSent` un glabāšanas termiņu kategorijā “Saziņa”).
- Dokumentu mape un “Mapē atrasti faili”: “✕ Dzēst” failam un apakšmapei (`store.deletePath` — tikai `Macibu_gadi/*/Personas/<persona>/…`, ne pašu personas mapi; papildu mapes netiek dzēstas). Dzēšot piesaistītu failu, tiek noņemts arī ieraksts (auditā atzīme). Apstiprinājumā — faila ceļš un failu skaits mapē (nolasa no diska).
- Visiem nepiesaistītajiem failiem mapē — “＋ Piesaistīt” (piesaistes logs ar kategoriju; `A.associate` strādā arī ar failiem, kas vēl nav indeksā). Ieteiktajiem failiem ar minējumu “Cits” — “＋ Piesaistīt…” ar logu.
- Jauna kategorija “Paskaidrojums” (migrācija `kind-explain`, minēšana pēc “paskaidr”). Kategorijai “Cits” obligāts lauks `title` (piesaistes un dokumenta logā); kartītē rāda `docs.label(d)`.
- Iestatījumi → Drošība un kopijas: papildu dokumentu mapēm poga “＋ Pievienot papildu mapi” un skaidrojums (agrāk atsauce uz neesošu pogu).

## 1.39.1 — 2026-10-17
- “Pārvietot” un “Jauna mape” paliek (tikai aktīvā gada mapē). `store.relocate`: ja Chrome noraida `move()` failam, fails tiek nokopēts uz jauno vietu, pārbaudīts (izmērs + SHA-256) un tikai tad vecā vieta noņemta; ja noņemt neizdodas — kopija paliek, sasaiste uz jauno vietu, lietotājam brīdinājums.
- `docs.where` / `whereHtml`: pie katra dokumenta un ieteiktā faila — pilns ceļš datorā ar datu mapes nosaukumu. Dokumenta rinda: teksts pilnā platumā, pogas zem tā.
- “Dokumentu mape”: gadu pogas (`docYears` — gadi ar personas dokumentiem + aktīvais, `A.docYear`), iepriekšējā gada mape netiek veidota no jauna; “Piesaistīt” izmanto skatīto gadu. Tests t105: dokuments pēc pārcelšanas uz jaunu gadu paliek sarakstā ar veco vietu un atveras.

## 1.39.0 — 2026-10-17
- Dokumentu skatītājs (`renderInto`): .docx ar docx-preview, eDoc/ASiC-E/BDOC — iekšējie faili (PDF/DOCX/attēls) ar pārslēgšanu, .xlsx/.csv kā tabula (`CP.sheetReader`), attēli un PDF kā līdz šim; .doc/.xls/.heic/.tiff — skaidrojums. “Jaunā cilnē” tikai pārlūkā atveramiem tipiem.
- Personas Dokumentu cilne: secība “Visi personas dokumenti” → “Dokumentu mape” → “Mapē atrasti faili”; abas pēdējās — `<details>`, sākumā aizvērtas, stāvoklis `S.docSec` tiek atiestatīts `ui.go`, izejot no kartiņas vai mainot personu.
- “Pārbaudīt”: statusa nozīme tiek atjaunota visos elementos ar `data-docstatus` (agrāk tikai pirmajā — mapes kokā), fona pārbaude tiek pārtraukta, kartiņa pārzīmējas; `FILE_STATUS.available` = “Pārbaudīts”.
- Iestatījumi → jauna cilne “Atļaujas” (`js/perms.js`): `queryPermission` datu mapei (readwrite), papildu mapēm (read), lokālajai šifrētās kopijas mapei; Google savienojums pēc `CP.google.needed()`, atvienošana ar `oauth2.googleapis.com/revoke`; uznirstošo logu pārbaude; `Notification.permission`. Pārzīmējas pie `focus`/`visibilitychange`; cilnē ⚠ ar vajadzīgo, bet nedoto atļauju skaitu. Atņemšana — instrukcija + `chrome://settings/content/siteDetails` adrese kopēšanai.
- Noņemta poga “Pārdēvēt” dokumentu mapē (Chrome neļauj `FileSystemHandle.move` šādai darbībai).

## 1.38.8 — 2026-10-17
- Noņemta pievienošana “Papīrs” (obligātie dokumenti, Dokumentu cilne, MTL lapa, apliecības skenējums). `D.missingDocs` — obligātajam dokumentam vajag `path` (skenētu failu). Esošajiem papīra ierakstiem kartītē “⚠ tikai papīrā” un “＋ Fails” (`replaceDoc` — fails tiek pievienots tam pašam ierakstam). Pēc viena faila pievienošanas vienmēr atveras rediģēšanas logs (piezīmes laukam skaidrojums pēc dokumenta veida).

## 1.38.7 — 2026-10-17
- Kopijas mape: `CADET_PERSONĀLS_ATJAUNOŠANA` (bija `CADET_rezerve`). Google Drive esošā mape tiek pārdēvēta nākamajā kopēšanā (`drive.rename`). Mapē datorā esošā kopija paliek ar veco nosaukumu (`CFG.dirName`), jaunās — ar jauno. Atjaunošana un ATJAUNOT.html atrod abus nosaukumus.

## 1.38.6 — 2026-10-17
- `pwCheck` šifrētās kopijas parolei (iestatīšana un maiņa): ≥12 zīmes, ≥3 no 4 zīmju klasēm (vai frāze ≥20 zīmes, ≥4 vārdi), ≥6 dažādas zīmes, bez 4 vienādām pēc kārtas, bez secībām (cipari, alfabēts, tastatūra, abos virzienos), bez bieži lietotiem vārdiem, bez instruktora vārda/uzvārda/e-pasta un datu mapes nosaukuma; mājiens nedrīkst saturēt paroli. Dzīvais rādītājs zem lauka. Pārbaude notiek pirms Client ID pārbaudes. Esošās paroles netiek prasītas mainīt.

## 1.38.5 — 2026-10-17
- Parādoties atkopšanas kodam, iestatīšanas logs tiek aizvērts (agrāk, piem., drukāšanas brīdī, zem tā varēja vēlreiz spiest “Tālāk”).

## 1.38.4 — 2026-10-17
- PIN un šifrētās kopijas paroļu lauki: `type="text"` + `.pw-mask` (`-webkit-text-security: disc`), `autocomplete="off"` — Chrome vairs nepiedāvā saglabāt PIN / kopijas paroli Google paroļu pārvaldniekā. ATJAUNOT.html netiek mainīts.

## 1.38.3 — 2026-10-17
- Šifrētās kopijas iestatīšana: atkārtots “Tālāk” (kamēr gaida Google / mapi) vairs nesāk otru iestatīšanu — agrāk radās vairāki atkopšanas kodi un Drive varēja rasties otra CADET_rezerve mape; spēkā bija pēdējais parādītais kods. “Pabeigt” — tikai vienreiz.
- Atkopšanas koda logā “💾 Saglabāt failā” (.txt ar kodu, datu mapi, Client ID).

## 1.38.2 — 2026-10-17
- Atcelts 1.38.1: atkopšanas koda sūtīšana uz e-pastu noņemta (kods un kopija vienā Google kontā = viens uzlaušanas punkts). Atpakaļ iepriekšējais teksts: izdrukāt / pierakstīt, nesūtīt e-pastā.

## 1.38.1 — 2026-10-17
- Atkopšanas koda logā “Nosūtīt sev uz e-pastu”: Gmail rakstīšanas logs (`mail.google.com/mail/?view=cm`) vai `mailto:` ar kodu, datu mapi un Client ID. Kods netiek sūtīts caur Apps Script (citādi tas paliktu izstrādātāja nosūtīto vēstuļu mapē).

## 1.38.0 — 2026-10-16
- `setup.js` `ageNotices(p)`: `adult18` (no 60 d. pirms līdz `adultContract(p)` — līgums `kind 'jaunietis'` neaktīvs/nearhivēts vai `p.adultContractAt`; netiek rādīts, ja persona pievienota jau pilngadīga) un `age21` (no 60 d. pirms, līdz arhivēšanai). Kartītē `personNotices(p)`; brīdinājumiem `nkey`. Vecais `adult` brīdinājums (core) noņemts.
- `dashboard.js` paziņojumu logs: `nkey` brīdinājumi ne vairāk kā 3 reizes (`localStorage cp-notice-count`).
- `contracts.js`: `contractNew('pid|jaunietis')`, līgumam `archived` (datums), `contractArchive` (arhivēt/atjaunot), pēc līguma ar jaunieti — piedāvā arhivēt līgumus ar pārstāvi. `adultContractDone`.

## 1.37.5 — 2026-10-16
- Jaunumu saraksts (`whatsnew.js`) pārrakstīts lietotājam: 19 bloki pa funkcijām, īsi, bez tehniskām detaļām un atkārtotiem labojumiem. Faila galvā noteikumi turpmākajiem ierakstiem. Tehniskā vēsture paliek šeit.

## 1.37.4 — 2026-10-16
- `CP.setup.instProblems(I)`: obligāti name, position, parvalde, nodala, phone (derīgs), email (`@jc.gov.lv`), place; nameGen — nē. Sākuma solis un līguma brīdinājums to izmanto.
- `U.capWords` / `U.capFirst`; `data-cap="words|first"` (globāls `change` klausītājs capture fāzē). `validate('name'|'fullname')` vienmēr ar lielo sākumburtu; jauns veids `place` (mācību iestāde).

## 1.37.3 — 2026-10-16
- Instruktora e-pasta laukam (Iestatījumi un līguma logs) paraugs `vards.uzvards@jc.gov.lv`.

## 1.37.2 — 2026-10-16
- `CP.setup.chip()` Pārskata galvenē (`.setup-chip.ok|.todo`): ✓ / ✕ n/m + josla; klikšķis `setupShow` atver/aizver sarakstu (`S.setupOpen` — arī pabeigtu).

## 1.37.1 — 2026-10-16
- Lapa `archive` (`CP.pages.archive`, people.js): visi `status === 'archived'` neatkarīgi no mācību gada; nav vairs pāradresācijas uz `people`.
- Sākuma saraksts: paslēpšana tikai sesijai (`S.setupHidden`); `settings.setupHidden` vairs netiek ņemts vērā.
- `ui.scrollToCard(c)`: kartīte ritināšanas konteinera vidū (garām — augša zem cilnēm).

## 1.37.0 — 2026-10-16
- `settings.js`: cilnes (`S.setTab`, `A.setTab`, `[data-stab]`), `ui.goSettingsCard(id)` (lockGoSet, encGoSet, retSettings, gadu izvēlne). Kartītēm id: dataCard, yearsCard, docsCard, commsCard, instCard.
- Jauns `js/setup.js` (`CP.setup`): instruktora datu kartīte (`settings.instructor`, kopīga ar līgumiem), sākuma saraksts Pārskatā (`settings.setupHidden`, `settings.setupDone.docs`), brīdinājums `age21` (60 d. / sasniegts), lapa `quality` + brīdinājums `quality` (`settings.qualityIgnore`).
- `encbackup.js`: ierīces ID (`localStorage cp.deviceId`), `KOPIJA.json.writer = { dev, name, at }`, `CFG.syncHead`, `CFG.multi`. `run()` neraksta, ja Drive kopiju pēdējo rakstījis cits dators un šis to nav ielādējis (`status 'newer'`); `force` — “Paturēt šī datora datus”. `checkRemote()`, `pull()` (datu fails → `_rezerves/PIRMS_IELADES_NO_DRIVE_*`, Drive jaunāki dokumenti aizstāj vietējos — vecie `_rezerves/aizvietoti_*`, `changelog.rebase`). Atjaunojot no Drive kopijas, CFG uzstādās uz to pašu kopiju. Josla `#remoteBar`, sānjoslā stāvoklis.
- `U.daysTo` — `Math.round` (laika maiņa vairs nedod +1 d.).
- `watch.js`: prombūtne netiek atskaitīta no laika pirms sesijas sākuma; sākums nākotnē tiek izlabots.

## 1.36.3 — 2026-10-16
- Sānjoslā zem datu mapes `#syncLine` (`CP.encBackup.paintSync`, izsauc `ui.updateSaveState`, `paint`, Google `onToken`, ik minūti): nav kopijas → ⚠ + `encGoSet`; Drive + nenosūtītas izmaiņas bez savienojuma → ⚠ + `gConnect`; kļūda → `encRun`; aktuāla → sinhronizēts HH:MM; gaida → info + ⟳. Lokālas mapes kopijai — tikai informācija.

## 1.36.2 — 2026-10-16
- VFS nozīmītes ekipējumā vairs nav `keep` pēc noklusējuma — jāatdod, MTL lapa. `keep` + `keepAt` nozīmē “dāvinājums” un tiek iestatīts tikai instruktora darbībā (`giftEq` vai atzīme logā). 1.36.1 automātiski izveidotajiem ierakstiem (`keep` bez `keepAt`) `keep` noņemts.

## 1.36.1 — 2026-10-16
- Ekipējumam lauks `keep` (paliek jaunsargam): nav `due`/`returned`, neskaitās `D.openEquipment`, `D.mtlStatus`, brīdinājumos un “izsniegts” skaitā; lapā atsevišķa sadaļa. Izsniegšanas logā atzīme.
- `vfs.js` `syncEq(t)`: `r.issued` + nozīmīte → `equipment { keep: true, src: 'vfs:<testa id>' }`; izsaucas no `syncQuals`, atzīmes maiņas, `vfsRemove`, dzēšot testu (`dropEq`), un `afterRootLoad` (esošajiem datiem). Ekipējuma ieraksta dzēšana/labošana → `CP.vfs.eqChanged` atjauno `r.issued`.

## 1.36.0 — 2026-10-16 — Datu glabāšanas termiņi
- Jauns modulis `js/retention.js` (`CP.retention`), lapa `retention`. `settings.retention = { left: { act: anon|erase, on }, cand, med, comms, ext, backups, changelog: { m, on } }`; izstājušos termiņš joprojām `settings.retentionDefault` un `p.retentionMonths`. Atlikšana: `p.keepUntil`, `d.keepUntil`, `p.commsKeepUntil`, `ev.extKeepUntil`.
- Anonimizēšana (`p.anon`): paliek id, statuss, dzimums, `birthYear`, iestāšanās/izstāšanās datumi, kvalifikācijas, mapes Nr.; dzēsti dokumentu, saziņas, uzdevumu, saistību, audita ieraksti; `changelog.forget(pid, { keep: true })` — dalība gados un atzīmes paliek, izmaiņa žurnālā neparādās.
- `people.js`: `CP.people.eraseRecord(pid)` (kopīgs dzēšanai un termiņiem); dzēšot izņem arī no pasākumu dalībniekiem, apmeklējuma atzīmēm, VFS rezultātiem.
- Brīdinājums `retention` — viens kopsavilkums ar pogu uz lapu (agrāk — tikai arhivētajiem aktīvā gada sarakstā). Darbību žurnāla termiņš no `retention.changelog.m`.
- Failu dzēšana — tikai pēc apstiprinājuma (`removeEntry`, atsevišķiem failiem `FileSystemHandle.remove`); JSON rezerves kopijas `_rezerves` — vecākas par termiņu, izņemot 10 jaunākās. `_arhivi` netiek dzēsts.

## 1.35.0 — 2026-10-16 — Centra arhīvs
- `registry.js`: jauna atzīme `arhivs` (`p.reg.arhivs.docs[kind] = { done, date }`), `settings.archiveDocs` (noklusēti anketa, līgums), `D.arcMissing(p)` — tikai saņemtie (pievienoti rīkā vai reģistrēti DVS), brīdinājums `registry`. Kartītē sadaļa “Centra arhīvs”, masveida `bulkReg('arhivs')`, iestatījumos dokumentu saraksts. Esošajām datu mapēm `registries` papildināts ar `arhivs` vienu reizi (`arhivsAdded`).

## 1.34.1 — 2026-10-16
- VFS — atsevišķa lapa `vfs` navigācijā (vairs nav Apmeklējuma cilne). Personas kartītē cilne `vfs` (`CP.vfs.personTab`): pēdējais tests, grafiks, visi rezultāti; skaits cilnē. Vārds VFS tabulā / dinamikā → personas VFS cilne.

## 1.34.0 — 2026-10-16 — VFS testi
- Jauns modulis `js/vfs.js` (`CP.vfs`), cilne Apmeklējums → VFS testi. `db.vfsTests = [{ id, date, yearId, title, res: { pid: { g, lvl, v: { str, push, sit, thr, spr, run }, issued } } }]`, `settings.vfs = { unit, instructor, region, sheet, mode }`. Normatīvi no JC 1.pielikuma 2.tabulas (I–IV, zēni/meitenes, 10…2 punktu robežas; laiki sekundēs; III meitenēm ķermeņa pacelšanai 2 p. robežas nav).
- Punkti: `strict` (norma jāsasniedz) vai `generous` (starp robežām — augstākais). Zem 2 p. — 1, virs 10 — 10. Nozīmīte: visi 6, min ≥ 4, 41/48/54. Kvalifikācijas `vfs-b|s|z` ar `src: 'vfs:<testa id>'` — sinhronizē pie katras izmaiņas, dzēšot testu — noņem.
- Personām jauns lauks `gender` ('m'|'f'); ieteikums pēc vārda galotnes. Pakāpe pēc vecuma testa dienā.
- Protokols: `CP.pdf.vfs` (A4 guļus, katra pakāpe — sava lapa). Nozīmīšu uzskaite: `vendor/templates/vfs-nozimites.xlsx` (JC 2.pielikums), aizpilda izvēlēto nodaļas lapu (inlineStr, stili no veidnes). `CP.docxFill.zip(entries, type)`.
- Imports no Word protokola (tabulas ar “Vārds Uzvārds”, pakāpe no “NN – NN gadi”, dzimums pēc aizpildītās pievilkšanās/kāriena kolonnas), vārdu sakritība, punkti pārrēķināti.
- Žurnālā kolekcija `vfsTests`.

## 1.33.0 — 2026-10-16 — Darbību žurnāls
- Jauns modulis `js/changelog.js` (`CP.changelog`), lapa `changes`. `store.save` pirms rakstīšanas izsauc `capture(db)`: momentuzņēmuma salīdzinājums kolekcijām people, documents, equipment, events, sessions, schedule, enrollments, years, sources, tasks, relations + settings (bez lastVisit/activeYear/stickyGroup/look/activeTemplate, gcal.lastSync). Ieraksts `db.changelog[] = { id, at, b (partija), c, eid, pid, n, op: add|edit|del, ch: [{k, f, t} | {k, big, sf, st}], obj (dzēstajiem), undo?, undone? }`. Lielas vērtības (> 6000 zīmju) — tikai kopsavilkums. Termiņš 12 mēn., ≤ 8000 ierakstu.
- Atjaunošana `clUndo`: edit → vecās vērtības (brīdina, ja lauks kopš tā mainīts vēlreiz), del → ieraksts atpakaļ, add → ieraksts prom (ne personām / mācību gadiem). Personas kodi un Google atslēga netiek rādīti.
- `erase` → `changelog.forget(pid)`: dzēš personas ierakstus, citos ierakstos izņem viņas id (apmeklējuma atzīmes, saraksti), dzēš arī viņas `enrollments`.
- Pārskata “Pēdējās izmaiņas” no žurnāla (+ “Viss žurnāls →”); personas vēsturē poga “Darbību žurnāls →”.

## 1.32.2 — 2026-10-16
- Logo — oriģinālais fails `vendor/brand/CADET_TRANSP_.png` bez krāsu maiņas (iepriekšējā maska noņemta).

## 1.32.1 — 2026-10-16
- Logo augšā un “Par rīku” — saite uz https://cadet.lv.

## 1.32.0 — 2026-10-16 — CADET.LV
- CADET.LV logo (`.cadet-logo`, PNG maska CSS, krāsa `--brand`: tumšajā #d64a40, gaišajā #530b08) — augšējās joslas centrā (`.yearbar`, paslēpts < 820 px), lielajā pulkstenī, bloķēšanas ekrānā, “Par rīku → Izstrādātājs: CADET.LV”. Testa josla un `#topBars` pārcelti zem augšējās joslas (52 px).

## 1.31.3 — 2026-10-16
- Pārskatā poga “Bloķēt rīku” (`lockNow`). `watch.js`: neaktivitātes laiks (no pēdējās darbības līdz lielā pulksteņa aizvēršanai) netiek skaitīts darbā (`ses.start` pārbīdīts), lielajā pulkstenī prombūtnes laikā “Darbā” netiek rādīts. PIN joslas teksts saīsināts.

## 1.31.2 — 2026-10-16
- Josla `#pinBanner` (ja datu mape atvērta un PIN nav iestatīts; ✕ — līdz lapas pārlādei). Kopīgs augšējo joslu konteiners `ui.topHost()` (`#topBars`) arī Google joslai.

## 1.31.1 — 2026-10-16
- Bloķēšana izmanto esošo lielo pulksteni (`watch.js`) un tā neaktivitātes iestatījumu, nevis atsevišķu pulksteni/taimeri: `CP.lock.adopt(ov)` ieliek `#watchBig` bloķējuma logā, `hideBig()` jautā `CP.lock.guard()` (→ PIN). Noņemts atsevišķais `mins` iestatījums.

## 1.31.0 — 2026-10-16 — Ekrāna bloķēšana
- Jauns modulis `js/lock.js` (`CP.lock`). Pulksteņa ekrāns ir modāls `dialog#cpLock`: citi `showModal` bloķējuma laikā paliek zem tā (`showModal` ietīts), toasti paslēpti, taustiņu notikumi neiziet ārpus.
- Neaktivitāte (`pointermove`/`keydown`/`wheel`/`touchstart`/`input`) un `visibilitychange`; `localStorage['cp.lock'] = { mins (5), salt, hash, iter, email, fails, until, sent }`. PIN — PBKDF2-SHA-256 150 000 iterāciju. Pēc 5 kļūdām pauze 30 s → līdz 15 min. Ctrl+Shift+L.
- Atkopšana: 6 ciparu kods (glabājas kā SHA-256, derīgs 15 min, ≤4/h) caur Apps Script (`k: 'cadet-pin-v1'`, `purpose: verify|reset`); `tools/zinojumi_apps_script.gs` → `pinMail` (fiksēts teksts, ≤5/h uz adresi, ≤60/h kopā). Bez e-pasta — atiestatīšana: PIN noņemts, saglabātā datu mapes atļauja aizmirsta.

## 1.30.1 — 2026-10-16
- Ieslēgta “Ziņot” sūtīšana: `CP.FEEDBACK_URL` = izstrādātāja Apps Script tīmekļa lietotne.

## 1.30.0 — 2026-10-16 — Ziņot
- Jauns modulis `js/feedback.js`, lapa `feedback` (pieejama arī bez datu mapes), navigācijas poga “Ziņot”. Tēmas: kļūda / ieteikums / atsauksme / jautājums; virsraksts, apraksts, vārds, kontakts; melnraksts `localStorage` (`cp.fbDraft`, `cp.fbContact`), vēsture `cp.fbSent`.
- Ekrānuzņēmumi (līdz 5, samazināti līdz 1600 px): ievilkšana, Ctrl+V, faila izvēle, `getDisplayMedia` (šī cilne) ar peldošu joslu “Uzņemt / Pēc 5 s / Atcelt”. Aizklāšana uz kanvas (taisnstūri, atsaukt, notīrīt); sūtīšanā aizklātais iededzināts JPEG; neaizklātam attēlam — apstiprinājums.
- Tehniskā informācija: versija, kanāls, lapa, pārlūks, ekrāns, pēdējās 10 JS kļūdas (`error` / `unhandledrejection`).
- Sūtīšana: `POST` (text/plain, bez CORS priekšpieprasījuma) uz `CP.FEEDBACK_URL` — izstrādātāja Google Apps Script tīmekļa lietotne (`tools/zinojumi_apps_script.gs`: Google tabula, attēli Drive mapē, e-pasts; ierobežojums 30/h). CSP `connect-src` + `script.google.com`, `script.googleusercontent.com`. Bez adreses vai kļūdas gadījumā — “Saglabāt failā” (HTML ar attēliem).

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
