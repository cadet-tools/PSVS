# Lietošanas analītika

> **Analītika ir pastāvīga CADET PERSONĀLS daļa.** Pārbūvējot vai atjauninot rīku (arī ar Claude), to **nedrīkst izdzēst vai atslēgt**. Ja maina failu struktūru, saglabā `js/analytics.js`, tā izsaukumus (`app.js`, `perms.js`, `about.js`), konfigurāciju `core.js` un šo aprakstu. Pēc izmaiņām palaid pārbaudi (sk. “Pārbaude”).

Mērķis: redzēt, **vai un kā rīks tiek lietots** (cik instruktoru, cik bieži atgriežas, cik ilgi strādā, kuras sadaļas un funkcijas, kurās pārvaldēs un nodaļās, kuras versijas, kādas kļūdas), nesūtot nekādus personu datus.

## Arhitektūra

```
Rīks (pārlūks)                      Google (izstrādātāja konts, bezmaksas)
js/analytics.js ──POST (text/plain)──▶ Apps Script tīmekļa lietotne  (tools/analitika/Kods.gs)
  rinda localStorage cp.anQ                │  doPost: pārbauda laukus → tabula “CADET analītika”, lapa “Sesijas”
  (bezsaistē krājas)                       │  doGet ?k=ATSLĒGA → panelis (tools/analitika/Panelis.html)
                                           └─ tirit(): katru nakti dzēš sesijas, kas vecākas par 400 dienām
```

| Fails | Loma |
|---|---|
| `js/analytics.js` | Uzskaite, rinda, sūtīšana, ieslēgšana / izslēgšana (`A.anToggle`), vienreizējs paziņojums |
| `js/app.js` | `CP.analytics.act(nosaukums)` un `CP.analytics.err(…)` pogu apstrādē |
| `js/perms.js` | Rinda “Lietošanas statistika un sīkdatnes” (Iestatījumi → Atļaujas) |
| `js/about.js` | Teksts “Kur glabājas dati” (tikai, ja analītika aktīva) |
| `js/whatsnew.js` | Jaunumu bloks ar `ch: 'test'` |
| `js/core.js` | `CP.ANALYTICS_URL`, `CP.ANALYTICS_STABLE` |
| `tools/analitika/Kods.gs`, `Panelis.html` (repozitorijā `docs/analitika/`) | Saņēmējs un panelis Google Apps Script; `gasmock.js` — imitācija pārbaudēm |

Nav jauna servera, instalējamas programmas vai maksas pakalpojuma. CSP nav mainīta: `connect-src` jau atļauj `https://script.google.com` un `https://script.googleusercontent.com` (tos lieto arī “Ziņot”). Service worker pieprasījumus uz citām adresēm neapstrādā.

## Kad darbojas

- Tikai tīmekļa versijā (https).
- **Testa kanālā** (`/PSVS/test/`). Stabilajā — tikai, kad `CP.ANALYTICS_STABLE = true` (ieslēdz pēc pārbaudes testa kanālā).
- Sūta tikai, ja `CP.ANALYTICS_URL` ir norādīta (testam var ielikt arī `localStorage['cp.anUrl'] = JSON.stringify('…/exec')`). Kamēr adreses nav, sesijas krājas tikai pārlūkā.
- Ja lietotājs to izslēdzis (Iestatījumi → Atļaujas) — nekas netiek ne uzskaitīts, ne sūtīts.

## Kas tiek sūtīts (viena sesija)

| Lauks | Saturs |
|---|---|
| `s` | sesijas ID (nejaušs, 20 hex) — novērš dublēšanos |
| `u` | lietotāja ID (nejaušs, 24 hex, glabājas `cp.anId` šajā pārlūkā) — atgriešanās skaitīšanai |
| `t0`, `t1` | sesijas sākums un pēdējā darbība (sākotnējais laiks, arī ja sūtīts vēlāk) |
| `a` | aktīvais laiks sekundēs (skaitās pa 30 s, ja cilne redzama un pēdējās 5 min bija pele / tastatūra) |
| `v`, `ch` | versija, kanāls (`stable` / `test`) |
| `m`, `os`, `br`, `sc` | instalēta lietotne / pārlūka cilne, OS, pārlūka veids, ekrāna platuma grupa |
| `lg`, `tz` | pārlūka valoda, laika josla |
| `p`, `n` | instruktora **novada pārvaldes un nodaļas numurs** (Iestatījumi → Instruktora dati; tikai cipari) |
| `pc` | aktīvo personu skaita grupa (`0`, `1-10`, `11-25`, `26-50`, `51-100`, `100+`) |
| `df` | vai pieslēgta datu mape (0/1) |
| `pg` | sadaļas (lapu iekšējie nosaukumi) → cik reizes atvērtas |
| `f` | darbības (`data-act` nosaukumi, piem. `formPdf`) → cik reizes; **bez** `data-arg` |
| `e` | kļūdas `Veids@fails:rinda` vai `Veids@act:darbība` → cik reizes; **bez kļūdas teksta** |

**Netiek sūtīts nekad:** vārdi, uzvārdi, personas kodi, kartīšu saturs, dokumenti, to saturs un nosaukumi, failu un mapju nosaukumi, kontakti, adreses, piezīmes, datu mapes saturs, instruktora vārds, kļūdu teksti, IP adrese (Apps Script to neredz), ierīces “pirkstu nospiedums”. Saņēmējs pieņem tikai šos laukus ar stingriem formātiem (piem. sadaļu nosaukumi `[\w.:@-]`, līdz 80 atslēgām) — brīvs teksts tiek atmests.

## Bezsaiste

- Sesija tiek saglabāta rindā `cp.anQ` uzreiz pēc katras darbības un ik 30 s. Rindā līdz **300 sesijām** un **60 dienām**; vecākās tiek izmestas.
- Sūtīšana paketē (līdz 50 sesijām): 10 s pēc atvēršanas, ik 15 min, 8 s pēc savienojuma atjaunošanas (`online`), paslēpjot vai aizverot cilni (`keepalive`).
- Katrai sesijai ir `rev` (izmaiņu skaitītājs). Nosūtīta pabeigta sesija tiek izņemta no rindas; atvērtā tiek nosūtīta vēlreiz tikai, ja mainījusies. Saņēmējs to pašu sesijas ID **atjauno**, nevis pievieno — dublikātu nav.
- Ja saņēmējs nav pieejams vai atbild ar kļūdu, rinda paliek; rīks strādā tālāk bez paziņojumiem. Analītika ir neatkarīga no Google Drive kopijas un kalendāra sinhronizācijas (`js/offline.js`).

## Lietotāja informēšana

- Pirmajā reizē — īss paziņojums (12 s): “Rīks izmanto sīkdatnes (pārlūka atmiņu) un apkopo anonīmu lietošanas statistiku — bez personu datiem. Izslēgt var Iestatījumos → Atļaujas.”
- Iestatījumi → Atļaujas → **Lietošanas statistika un sīkdatnes** — apraksts un poga Izslēgt / Ieslēgt. Izslēdzot tiek dzēsta rinda un ID.
- “Par rīku” → “Kur glabājas dati” — apraksts.
- Piekrišana netiek prasīta (izstrādātāja lēmums). Pirms ieslēgšanas stabilajā versijā ieteicams parādīt šo aprakstu Jaunsardzes centra datu aizsardzības speciālistam.

## Uzstādīšana (vienreiz)

1. Google Drive → **Jauns → Google Sheets**, nosaukums “CADET analītika”.
2. **Paplašinājumi → Apps Script.** Izdzēs parauga kodu, ielīmē `tools/analitika/Kods.gs`.
3. Pa kreisi **＋ → HTML**, nosaukums **`Panelis`** (bez .html), ielīmē `tools/analitika/Panelis.html`. Saglabā (Ctrl+S).
4. Augšā izvēlies funkciju **`uzstadit`** → **▶ Run** → atļauj piekļuvi savam kontam. Apakšā *Execution log* būs **paneļa atslēga** — saglabā to.
5. **Deploy → New deployment → ⚙ Web app**: *Execute as* — **Me**, *Who has access* — **Anyone** → Deploy. Nokopē adresi `https://script.google.com/macros/s/…/exec`.
6. Šo adresi ieraksta `js/core.js` → `CP.ANALYTICS_URL` un publicē testa kanālā (vai testam ievada pārlūka konsolē `localStorage['cp.anUrl']=JSON.stringify('…/exec')`).
7. **Panelis:** `…/exec?k=ATSLĒGA` — saglabā kā grāmatzīmi. Bez atslēgas adrese rāda tikai “saņēmējs darbojas”. Ja atslēga nonākusi svešās rokās — palaid `jaunaAtslega`.

Atjauninot `Kods.gs` vai `Panelis.html`: **Deploy → Manage deployments → ✏ → Version: New version** — adrese nemainās.

Panelī: aktīvie lietotāji (diena / nedēļa / mēnesis), jauni un atgriezušies, sesijas, tipisks darba ilgums, **pārvaldes un nodaļas**, atgriešanās pa mēnešiem, darba laiks pa nedēļas dienām un stundām, sadaļas, funkcijas, versijas, vide, personu skaits, kļūdas. Filtri: periods, kanāls, pārvalde.

## Pārbaude

Automātiskā pārbaude `t118.py` (izdomāti dati) izpilda īsto `Kods.gs` ar Apps Script imitāciju (`gasmock.js`) un pārbauda: paziņojumu, sadaļu / darbību / kļūdu / aktīvā laika uzskaiti, pārvaldi un nodaļu, ka pieprasījumos nav personu datu, mapes nosaukuma un kļūdas teksta, tikai atļautos laukus, dublikātu neesamību, uzkrāšanu bezsaistē un nosūtīšanu ar sākotnējo laiku pēc savienojuma, Google sinhronizācijas neatkarību, saņēmēja lauku filtrēšanu, paneli (ar un bez atslēgas), izslēgšanu un ka stabilajā versijā analītika nav aktīva.

Rokās (pēc uzstādīšanas): atver testa versiju → strādā dažas minūtes → pārlūka konsolē `CP.analytics.state()` (`queued` → 0 pēc sūtīšanas) → tabulā “Sesijas” parādās rinda → panelī redzama. Bezsaistē: izslēdz internetu, strādā, ieslēdz — pēc ~10 s sesija tabulā ar īsto laiku.
