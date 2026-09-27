# Dash the Data – jatko-ohjeet toiselle agentille

Repo: `makrpai/Dashthedata`, branch `claude/suunnitelman-toteutus-0yjc5j`.
Suunnitelma: `/root/.claude/uploads/.../64197d64-dash-the-data-suunnitelma.md`
(liitä uudelleen jos ei näy — 1614 riviä, osiot numeroitu, "23. Toteutusvaiheet" ohjaa etenemistä).

**Lue ensin `docs/DECISIONS.md`** ja `TODO.md` (vaiheet 0–10 rastitettu).

## Missä mennään

Vaiheet 0–10 ovat työpuussa. Viimeisin pushattu commit on yhä vaiheen 6 WIP
`b600a5d`. Sen jälkeiset vaiheet 6–10 (vienti, mallinäkymä, liittimet, tekoäly, yksityisyys)
eivät ole vielä commitissa. `npm test` (318), `npm run typecheck` ja `npm run build` menevät läpi.

Selainvarmistus production-palvelimella: esimerkkidata, demo-API, lähteen päivitys, mallinäkymä,
dashboardin vienti ja suodattimet, kaavion selitys (suostumusdialogi) ja tekoälyasetukset.
Promootio-GIFiä ei ole generoitu. Claude-selitys vaatii `ANTHROPIC_API_KEY`n tai oman avaimen.

## Seuraava askel

Committoi ja pushaa samaan branchiin vasta kun käyttäjä pyytää. Älä commitoi `package-lock.json`-kohinaa.

## Yleiset työtavat

- **Testaa aina oikealla DuckDB:llä** (`tests/helpers/nodeRunner.ts`, `tests/helpers/fixtures.ts`
  `processFixture()`).
- CSP on tiukka production-buildissä (ei `unsafe-eval`) — matriisit ladataan CSV:nä
  (`src/lib/duckdb/matrixCsv.ts`).
- i18n: joka uusi näkyvä teksti lisätään sekä `en.ts`:ään että `fi.ts`:ään.
  `tests/unit/i18n/dictionary.test.ts` tarkistaa avainten yhtenevyyden.
