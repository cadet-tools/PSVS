# MI palīgs — izstrādātāja rokasgrāmata

> **Sāc šeit**, ja turpini MI darbu. Lietotāja skats: Ctrl+K → **Jautāt MI**.
> Statuss: **stabilajā un testa kanālā** no 1.58.0 (`MI_STABLE = true`).
> Šis fails ir vienīgais pilnais MI apraksts. `docs/mi/` ir starpnieka kods.

CADET PERSONĀLS ir Jaunsardzes instruktora rīks (personas, dokumenti, apmeklējums, veidlapas). Rīkā ir ieguldīts daudz. **MI ir papildu paka** — esošo kodu nemaina, ja vien nav citas izejas.

## Ko nedrīkst

1. **Neskart** `src/js/assist.js` (iebūvētais palīgs) un `src/js/settings.js`. MI pievieno pogu, paneli un iestatījumu kartīti no ārpuses (`#miBtn`, `#miPane`, `CP.afterRender` → `#miCard`).
2. **Nepalaid** `python3 src/_buvesana/build_web.py` ikdienā — tas **izdzēš visu repo** (izņemot `.git`) un būvē no ārējas avota mapes. Ikdienā: `build_test.py` un `build_stable.py`.
3. **Neraksti** Groq atslēgu (`gsk_…`) repo, čatā, commitā, `localStorage` piemēros ar īstu vērtību. Kopīgā atslēga — tikai Apps Script **skripta rekvizītos**.
4. **Neforce-push** uz `cadet-tools/PSVS` `main`. Tikai fast-forward.
5. **Neraksti** personu datus, datu failu vai `_rezerves` repo.
6. **Neliec** svešas GitHub Pages lapas organizācijā `cadet-tools` — tām ir **kopīga** pārlūka atmiņa ar PSVS (sk. “Atslēgas un pārlūks”).

Jauns kods vispirms `test/`, pārbauda, tad sakne. Versiju (`CP.VERSION` `src/js/core.js`) palielina, kad lietotājs kaut ko pamana; sīkus MI labojumus var iekļaut esošajā 1.58.0 blokā `whatsnew.js` (palielina `v` tikai, ja jāparādās jaunumu logam).

## Kas tas ir

Meklēšanas logā (**Ctrl+K** / “Meklēt vai jautāt”) poga **“Jautāt MI”**, josla (**Ctrl+Enter**), sarunas panelis. MI atbild **latviski** un **par rīka lietošanu**. Atbildē var būt **“Parādīt, kur → …”** (`CP.assist.guide` — iebūvētais palīgs pats atver vietu un iezīmē pogu) un **“Atvērt: sadaļa”**.

Bez interneta poga ir atslēgta; **iebūvētais palīgs paliek**. MI neredz personu kartītes, dokumentus, datu failu.

Divi ceļi:

```
Pārlūks (src/js/ai.js)
  ├─ kopīgais  ──POST JSON (text/plain)──▶ Apps Script (docs/mi/Kods.gs) ──▶ api.groq.com
  │                                            GROQ_KEY tikai skripta rekvizītos
  └─ sava atslēga ──POST JSON──────────────▶ api.groq.com
                                               localStorage cp.miKey (tikai šis pārlūks)
```

Cits instruktors **neredz un netērē** svešu `gsk_…`. Viņš lieto kopīgo MI (vai savu atslēgu savā pārlūkā).

## Faili

| Fails | Ko dara | Drīkst mainīt |
|---|---|---|
| `src/js/ai.js` | Visa MI loģika: RULES, FACTS, `knowledge`, `redact`, `ask`, UI, kartīte | Jā — galvenā vieta |
| `src/css/ai.css` | Stili (`#miBtn`, `#miPane`, josla) | Jā |
| `src/js/whatsnew.js` | Lietotāja jaunumi (1.58.0 “MI palīgs”) | Jā, lietotāja valodā |
| `src/js/core.js` | `CP.VERSION` | Tikai versijas palielināšanai |
| `src/_buvesana/build_test.py` | Pārbūvē **tikai** `test/` | Jā |
| `src/_buvesana/build_stable.py` | Pārbūvē **tikai** sakni | Jā |
| `src/_buvesana/build_web.py` | Pilns būvējums, **tīra repo**; CSP `api.groq.com` | Uzmanīgi |
| `docs/mi/Kods.gs` | Kopīgā MI starpnieks (limiti, RULES, modeļi) | Jā + **Jauna versija** Apps Script |
| `docs/mi/mimock.js` | Lokāls serveris: izpilda īsto `Kods.gs` + pasniedz rīku | Jā |
| `docs/mi/mi_test.mjs` | RULES sinhronizācija + starpnieka testi | Jā |
| `src/js/assist.js` | Iebūvētais palīgs, `HELP`, `guide` | **Nē** (MI to sauc) |
| `src/js/settings.js` | Iestatījumu lapa | **Nē** (kartīte caur `CP.afterRender`) |
| `app.bundle.js`, `test/app.bundle.js` | Ģenerēti | Nē — būvē no `src/` |

Kanāls: `<meta name="cp-channel" content="stable|test">`. MI ielādējas, ja `CP.WEB` un (`CHANNEL === 'test'` **vai** `MI_STABLE`).

## Izstrādes cikls

```bash
# 1. Labo AVOTU, ne bundle
#    src/js/ai.js   src/css/ai.css   docs/mi/Kods.gs

# 2. Pārbūvē to kanālu, ko pārbaudi
python3 src/_buvesana/build_test.py      # test/ — parasti vispirms
python3 src/_buvesana/build_stable.py    # sakne — kad gatavs visiem

# 3. Testi (bez īstas atslēgas)
node docs/mi/mi_test.mjs

# 4. Lokāli atver
node docs/mi/mimock.js 47613             # bez GROQ_KEY — imitēts modelis
# http://127.0.0.1:47613/__mi/dev   → iestata cp.miUrl="/__mi", atver testu
# http://127.0.0.1:47613/           → stabilā
# http://127.0.0.1:47613/test/      → tests

# Īsts Groq caur to pašu Kods.gs (atslēga tikai vidē, ne repo):
GROQ_KEY=gsk_… node docs/mi/mimock.js 47613
```

`mimock.js` testiem: `POST /__mi/props` (skripta rekvizīti), `POST /__mi/reset` (skaitītāji), `GET /__mi/stats` (bez `GROQ_KEY`).

Pēc `Kods.gs` izmaiņām **repo nepietiek**: script.google.com → projekts **CADET PERSONALS GROCK MI** → ielīmē failu → **Izvietot → Pārvaldīt izvietojumus → ✏ → Versija: Jauna versija**. Adrese paliek.

Iebūvētā adrese: `src/js/ai.js` → `MI_URL`. Lokāli pārraksta: `localStorage['cp.miUrl'] = JSON.stringify('/__mi')` vai `…/exec`.

## RULES un kvalitāte

`RULES` **jābūt burtiski vienādiem** `src/js/ai.js` un `docs/mi/Kods.gs` (bloki `// RULES:BEGIN` … `// RULES:END`). To pārbauda `mi_test.mjs`. Sava atslēga lieto `ai.js` RULES; kopīgais — `Kods.gs` RULES.

Atbilde no modeļa: JSON `{ answer, guide, page, offtopic }`. `parse()` atstāj tikai **esošus** `HELP` indeksus un **esošu** sadaļu; sadaļu atslēgas tekstā (`forms`) pārvērš latviski (“Veidlapas”).

`knowledge(q)` sūta īsu kb (~2000 tokenu): sadaļas, atbilstošākie FACTS, palīga virsraksti, līdz 4 pamācībām. Jokam (`isJoke`) — `SLIM` (bez HELP). FACTS var tikt līdzi arī bez HELP, ja `score > 0.45`. Īsie tokeni (`dvs`, `vfs`, `api`, …) ir `SHORT`, citādi 3 burti pazūd.

**Vietējās atbildes** (`localAns`, bez Groq, netērē limitu): “kas tu esi”, MI atslēgas ceļš, pulkstenis, mācību gads, DVS, joka iestatījums, sarunas audits. Tās jāpatur — modelis bieži kļūdās.

Mācības no dzīvajām atbildēm (neatkārtot):

| Jautājums | Nepareizi | Pareizi |
|---|---|---|
| “pagatavot pīrāgus” | tuvākā HELP → instruktāža | offtopic / “nav rīka jautājums” |
| “jaunsargs iet uz mežu…” | palīga soļi par personu | īss joks |
| “cik ir pulkstenis / pulksyrnis” | offtopic | Pārskata pulkstenis (laiku MI nezina) |
| “cik dienu gadā” | offtopic | 365/366; mācību gads 1.09–31.08 |
| “man ir DVS” | offtopic | `dvs.mod.gov.lv`, rīks DVS neaizstāj, atzīme “✓ DVS” |
| “kur mainīt API” | izdomāta “API konfigurācija” | Iestatījumi → Atļaujas → **MI palīgs** |
| “kopsavilkums auditam” | Jaunsarga kopsavilkums PDF | šīs sarunas jautājumu pārstāsts |

Ja kopīgais izsmelts **un** ir sava atslēga: **nedrīkst** rādīt “Pievienot savu Groq atslēgu” / likt kopēt jautājumu. Jautā ar savu vai poga **“Jautāt ar savu atslēgu”**. `preferOwn()` pēc auto-429 atgriežas uz savu, kad minūtes locks beidzies.

Groq **neatklāj** `x-ratelimit-*` pārlūkam (CORS). Savas atslēgas josla skaita `tokEst` / 60 s `win` lokāli; `tickQuota` ~400 ms, `until` paliek `localStorage`. Precīzie tokeni: [console.groq.com/settings/usage](https://console.groq.com/settings/usage).

## Kas tiek sūtīts

- Jautājums pēc `redact`: kodi → `[kods]`, tālruņi → `[tālrunis]`, e-pasti → `[e-pasts]`, vārdi no datu faila (arī locījumos) → `[persona]`. Lietotājs redz nosūtīto tekstu.
- Pēdējie 3 jautājumi / atbildes.
- Sadaļas atslēga (`people` u. c.).
- `knowledge` teksts.
- Kopīgajam: `cp.miId` (24 hex, limitam), versija, kanāls. Formāts `k: "cadet-mi-v1"`.

**Nekad:** kartītes, dokumenti, faili, datu fails, iestatījumi, instruktora anketas. Starpnieks **nesaglabā** jautājumus — tikai skaitītāju `day:GGGG-MM-DD`. Statistika: darbību nosaukumi `miAsk`, `miErr:<kods>` (bez teksta).

## Atslēgas un pārlūks

Viss zemāk ir **šī pārlūka** `localStorage` uz origina `https://cadet-tools.github.io` (tāpēc **tests un stabilā dalās**; cita `cadet-tools` Pages lapa **var izlasīt** tos pašus laukus, ja tajā ir tāds kods). Cits dators / cits pārlūks / cits cilvēks — tukšs.

| Atslēga | Saturs |
|---|---|
| `cp.miKey` | Lietotāja Groq `gsk_…`. Nav datu failā, nav kopijā, nav starpniekā. |
| `cp.miOff` | `true` — slēpj “Jautāt MI” |
| `cp.miSrc` | `own` / `shared` |
| `cp.miSrcWhy` | `user` / `auto` (automātiskā pārslēgšanās) |
| `cp.miUrl` | Starpnieka adrese; tukšs → `MI_URL` |
| `cp.miId` | Nejaušs ID kopīgajam limitam |
| `cp.miUse` | `{ d, n, own }` šodienas skaitītājs |
| `cp.miShareQ` | Kopīgā atlikums (`left`, `resetMin`) |
| `cp.miOwnQ` | Savas atslēgas logs (`tokEst`, `win`, `until`) |

- **Kopīgais MI:** Apps Script `GROQ_KEY`. Pārlūkā tās nav. Limits: 20 jautājumi / 6 h lietotājam; 2500 dienā; 15 minūtē. Modeļi pēc kārtas: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`.
- **Sava atslēga:** Iestatījumi → Atļaujas → MI palīgs, vai slēdzis sarunā. Pārbaude: `GET https://api.groq.com/openai/v1/models`. CSP `connect-src` abos kanālos ietver `https://api.groq.com`.
- Ja viena puse 429 / limits — `ask()` mēģina otru un rāda paziņojumu.

Citi repo uz `cadet-tools.github.io` **šos laukus neizmanto**, ja tajos nav koda, kas lasa `cp.miKey`. Tāpēc organizācijā neliek neuzticamas lapas.

## Kopīgā starpnieka uzstādīšana (vienreiz / pēc nozaudēšanas)

Esošā tīmekļa lietotne (adrese **nav** slepena; slepena ir `GROQ_KEY`):

`https://script.google.com/macros/s/AKfycbzk3IFUpvMRZSF8RxagcE-FRIGQTjFmdsx7Oo5CHqsYKxcDXlf4W6LlPR_hTljWaTJj/exec`

Jauns projekts:

1. [script.google.com](https://script.google.com) → Jauns projekts. Ielīmē `docs/mi/Kods.gs`. Saglabā.
2. ⚙ → Skripta rekvizīti → `GROQ_KEY` = `gsk_…`. Pēc izvēles: `USER_LIMIT`, `DAY_LIMIT`, `MINUTE_LIMIT`, `MODELS`.
3. Funkcija **`uzstadit`** → ▶ Run → atļaut ārējo savienojumu. Žurnālā: “Gatavs. Groq atbild…”.
4. Izvietot → Tīmekļa lietotne: izpildīt kā **Es**, piekļuve **Ikviens**. Nokopē `…/exec`.
5. Pārbaude pārlūkā: `{"ok":true,"info":"CADET MI starpnieks darbojas","ready":true,…}`.
6. Adresi ieraksta `MI_URL` un pārbūvē. Funkcija `statistika` — dienas skaitītāji.

Ja atslēga noplūdusi: jauna [console.groq.com/keys](https://console.groq.com/keys), ieraksti `GROQ_KEY`, veco dzēs.

## Publicēšana (GitHub Pages)

Adreses: [stabilā](https://cadet-tools.github.io/PSVS/) · [tests](https://cadet-tools.github.io/PSVS/test/) · repo [cadet-tools/PSVS](https://github.com/cadet-tools/PSVS) (`main`).

1. Avots + `build_test.py` / `build_stable.py` (ne `build_web.py`).
2. `node docs/mi/mi_test.mjs`. Pēc UI izmaiņām — e2e pret `mimock` (stabilajā jābūt `CP.ai`, `#miBtn`, jaunumu 1.58.0).
3. Commit. Uz `cadet-tools/PSVS` — **tikai ff** (`git merge --ff-only` / `git push` bez `--force`).
4. Pēc Pages: `https://cadet-tools.github.io/PSVS/version.json` un `…/test/version.json`. Cietā pārlāde (Ctrl+Shift+R) **abām** adresēm.

Jaunumu logs rāda blokus, kuru `v` ir jaunāka par `localStorage cp-news-seen`. `ch: 'test'` slēpj bloku stabilajā. 1.58.0 MI blokam **nav** `ch` — redz abi kanāli; kas jau redzējis 1.58.0 testā, vēlreiz neredz.

Lietotāja teksts — `whatsnew.js` (ko pamana). Tehnika — `CHANGELOG.md`.

## Pilnais `build_web.py` (rets)

Būvē no **ārējas** avota mapes un tīra repo. Pirms tam avotā jābūt: `src/js/ai.js`, `src/css/ai.css`, `src/index.html`, `src/js/core.js`, `src/js/whatsnew.js`, `src/_buvesana/*` (arī `build_test.py`, `build_stable.py`), `docs/MI.md`, `docs/mi/*` kā `tools/mi/` (skripts to kopē uz `docs/mi`). Analītiku (`docs/analitika/`, `analytics.js`) **nedzēš**.

## Ātrā karte `ai.js`

- `MI_STABLE`, `MI_URL`, `OWN_MODELS`, `RULES`, `PAGES`, `FACTS`
- `knowledge` / `isJoke` / `redact` / `localAns` / `ABOUT_Q`
- `ask` → `viaOwn` / `viaShared` + fallback
- `parse` / `md` / `mount` (`#miBtn` `#miBar` `#miPane`)
- `quotaHtml` / `tickQuota` / `card` (`#miCard`)
- `CP.ai` — `ask`, `redact`, `parse`, `md`, `knowledge`, `state` (testiem)
