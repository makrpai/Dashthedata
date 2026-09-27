# Dash the Data – jatko-ohjeet toiselle agentille

Repo: `makrpai/Dashthedata`, branch `claude/suunnitelman-toteutus-0yjc5j`.
Suunnitelma: `/root/.claude/uploads/.../64197d64-dash-the-data-suunnitelma.md`
(liitä uudelleen jos ei näy — 1614 riviä, osiot numeroitu, "23. Toteutusvaiheet" ohjaa etenemistä).

**Lue ensin `docs/DECISIONS.md`** (päätösloki, kaikki poikkeamat suunnitelmasta) ja `TODO.md`
(vaihekohtainen tarkistuslista, vaiheet 0–5 rastitettu).

## Missä mennään

Vaiheet 0–5 valmiit, committoitu ja pushattu (ks. `git log --oneline`):
foundation, ingest, data-view, profile, ETL, transform-view, charts, suggest-engine.

**Vaihe 6 (dashboard interaction + persistence) on kesken**, viimeisin commit
`b600a5d "wip(dashboard): draggable/resizable grid, global filters and cross-filtering"`.
Tämä committi **buildaa ja typecheckaa puhtaasti, kaikki 310 yksikkötestiä menee läpi**,
mutta sitä **ei ole vielä testattu oikeassa selaimessa eikä sille ole e2e-testejä**.

Vaiheessa 6 tehty tähän mennessä:
- `src/lib/persistence/idb.ts`, `projectFile.ts` — IndexedDB-tallennus, projektitiedoston vienti/tuonti
- `src/lib/workspace/projects.ts`, `restore.ts` — autosave (1s debounce), projektin palautus reloadin
  jälkeen, tiedostojen uudelleenyhdistäminen nimen+koon perusteella
- `src/components/providers/ProjectPersistence.tsx` — autosave-subscriptio
- `src/components/layout/MissingDataBanner.tsx` — "N lähdettä tarvitsee datansa uudelleen" -palkki
- `src/components/dashboard/DashboardGrid.tsx` — **UUSI**, react-grid-layout v2:lla raahattava/koon
  muutettava ruudukko, korvaa DashboardView.tsx:n staattisen CSS-gridin
- `src/components/dashboard/FilterBar.tsx` — **UUSI**, globaalit suodattimet (dateRange quick-picks,
  multiSelect, numberRange) + ristisuodatuksen chip
- `src/lib/workspace/dashboardFilters.ts` — **UUSI**, globalFilter → FilterClause, effectiveFilters()
  yhdistää globaalit + crossFilter (lähderuutua ei suodateta itse, ks. suunnitelma osio 13)
- `src/components/settings/DataSettings.tsx` — projektin vienti/tuonti/tyhjennä-painikkeet
- `src/components/landing/RecentProjects.tsx` — etusivun projektilista

## Seuraavat askeleet (tässä järjestyksessä)

1. **Aja selaintesti ensin**, ennen mitään muuta koodia. Käytä samaa kaavaa kuin aiemmissa
   vaiheissa: `npm run build`, käynnistä `npx next start -p 3100` taustalle, aja Playwright-skripti
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`-binäärillä, joka:
   - tuo esimerkkidatan, avaa Dashboardit-näkymän
   - **raahaa** yhtä ruutua hiirellä (mousedown → useita mousemove-askelia → mouseup) ja tarkistaa
     että `dashboard.tiles[].layout` muuttuu (store) ja ettei layout riko muita ruutuja
   - **muuttaa kokoa** vetämällä `.react-resizable-handle`-kahvasta
   - **klikkaa pylvästä** → tarkistaa että `FilterBar`iin ilmestyy crossFilter-chip JA että toisen
     ruudun luvut muuttuvat (tämä on plan-skenaario 1:n ydin, ei ole vielä koskaan ajettu)
   - klikkaa chipin ✕ tai painaa Esc → suodatus poistuu
   - kokeilee globaalia dateRange-suodatinta (pikavalinta "Tämä vuosi" tms.) ja tarkistaa että
     kaaviot suodattuvat
   - ottaa kuvakaappauksen (fullPage) sekä light että dark-teemalla
   Jos jokin ei toimi, korjaa **ennen** kuin jatkat mihinkään uuteen — tämä on suurin
   testaamaton riskipinta juuri nyt.

2. **react-grid-layout-yksityiskohtia joita EI ole vielä varmistettu**, tarkista nämä browser-testissä:
   - `useContainerWidth()` palauttaa `{ width, containerRef, mounted }` — SSR:ssä `mounted` on false
     ekana renderillä, joten grid ei renderöidy ennen mounttia. Varmista ettei tästä tule
     layout-hyppyä tai flash-of-empty.
   - `dragConfig.handle: '.dtd-tile-drag'` — tämä class on `ChartTile`:n headerissa
     (`dragHandleClass` prop). Varmista ettei raahaus käynnisty kun klikataan ruudun sisällä olevaa
     nappia (menu, "Miksi tämä?" -popover) — RGL:n `cancel`-selectoria ei ole vielä asetettu,
     saatat tarvita `dragConfig.cancel: 'button, a, [role="button"]'`.
   - `onLayoutChange` kutsutaan myös resize-tapahtumista — varmista ettei se aiheuta ylimääräisiä
     DuckDB-kyselyitä (ChartTile/ChartView reagoi datasetin/filttereiden muutokseen, ei layoutiin,
     joten pitäisi olla ok, mutta tarkista Reactin re-render-määrä).
   - `GRID_COLS` tuodaan `@/lib/workspace/dashboards` — tarkista ettei ristiriitaa `autoLayout.ts`:n
     kanssa (molemmat käyttävät 12 saraketta).

3. **Persistenssin e2e-testi** (plan-skenaario 8): tuo esimerkkidata → luo/muokkaa dashboard →
   `page.reload()` → tarkista että projekti ja dashboard palautuvat (myös raahatut layoutit).
   Tämä testaa koko `restore.ts`-polun ensimmäistä kertaa oikeasti.

4. **Viennit (13, puuttuu vielä kokonaan)**:
   - Dashboardin PNG: `html-to-image` (`toPng`) koko ruudukon elementistä. Lisää TopBariin
     "Vie ▾" -pudotusvalikko (ks. suunnitelma osio 17.1 layout-kaavio: `[⟳] [Vie ▾]`).
   - PDF: `jspdf`, A4 vaaka, otsikko + päivämäärä + aktiiviset suodattimet + kuva (voi käyttää
     samaa `html-to-image`-kuvaa upotettuna).
   - Siivotun datan CSV/Parquet-vienti per datasetti (ei per-kaavio, joka on jo tehty
     `useTileActions.ts`:ssä). CSV: käytä olemassa olevaa `src/lib/export/csv.ts`. Parquet:
     `runner.copyToBuffer(sql, 'parquet')` DuckDB-clientistä (`src/lib/duckdb/client.ts`, metodi
     on jo olemassa), lataa `downloadBlob`illa.
   - Näytä nämä sekä yksittäisen kaavion menussa (jo tehty) että dashboard-tason "Vie"-valikossa.

5. **Puuttuvat pikkuasiat vaiheesta 6**:
   - `ProjectSwitcher.tsx`:ssä ei ole nimeä-uudelleen/monista/poista-toimintoja — lisää ne (i18n-avaimet
     `project.renamePrompt`, `project.deleteConfirm` ovat jo olemassa `en.ts`/`fi.ts`:ssä, käytä niitä).
   - Manuaalisen dashboardin FilterBar ei tarjoa "lisää suodatin" -toimintoa datasetin sarakkeille;
     autoLayout luo suodattimet automaattisesti mutta käyttäjän itse tekemä dashboard jää ilman.
     i18n-avain `filterBar.addFilter` on jo varattu.
   - Tarkista `viewBuilders`-mekanismi `restore.ts`:ssä — se on tyhjä array jota vaihe 7 (union/join)
     tulee täyttämään datasetin `kind !== 'source'` -tapauksessa. Älä poista sitä.

6. **Kun vaihe 6 on testattu ja E2E-skenaariot 1, 2, 3, 8 menevät läpi** (suunnitelma osio 20.3),
   päivitä `TODO.md` (rastita Phase 6), lisää `docs/DECISIONS.md`:hen merkintä react-grid-layout
   v2 -valinnasta jos jotain piti poiketa suunnitelmasta, aja `npm run lint && npm run typecheck &&
   npm test && npm run build`, committoi selkeällä conventional commit -viestillä (esim.
   `feat(dashboard): draggable grid, filters, cross-filtering and persistence e2e`) ja pushaa samaan
   branchiin `claude/suunnitelman-toteutus-0yjc5j`.

## Sen jälkeen: Vaihe 7 (Monilähde ja malli)

Suunnitelman osio 10 + 23 "Vaihe 7": union-ehdotus (`src/lib/model/union.ts` — ei vielä olemassa),
relaatiotunnistus (`src/lib/model/relationships.ts`), mallinäkymä `@xyflow/react`:lla, join-datasetti.
`tests/fixtures/union-a.csv`, `union-b.csv`, `orders.csv`, `customers.csv` on jo generoitu tätä varten
(ks. `scripts/generate-samples.ts` ja niiden `.expected.json`-tiedostot vaiheen 3 testeistä — käytä
niitä referenssinä kun rakennat relaatiotunnistuksen pisteytystä osion 10.2 kaavalla).

## Yleiset työtavat tässä projektissa (opittu 6 vaiheen aikana)

- **Testaa aina oikealla DuckDB:llä** (`tests/helpers/nodeRunner.ts`, `tests/helpers/fixtures.ts`
  `processFixture()`) — älä luota pelkkään TS-tyyppeihin SQL:n oikeellisuudessa.
- **Selaintestaus Playwrightilla on pakollinen jokaisen UI-muutoksen jälkeen** ennen committia:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright
  test`. CSP on tiukka production-buildissä (ei `unsafe-eval`) — Arrow-taulukoiden rakentaminen JS:ssä
  ei toimi, siksi matriisit ladataan CSV:nä (`src/lib/duckdb/matrixCsv.ts`).
- Kaikki värit/kontrastit validoidaan `dataviz`-skillin `validate_palette.js`:llä ennen käyttöä.
- i18n: joka uusi näkyvä teksti lisätään sekä `en.ts`:ään että `fi.ts`:ään, `tests/unit/i18n/
  dictionary.test.ts` tarkistaa avainten yhtenevyyden automaattisesti.
- Committien attribuutiorivit (Co-Authored-By, Claude-Session) tulevat system-reminderistä
  jokaisen session alussa — käytä sitä, älä tätä tiedostoa.
