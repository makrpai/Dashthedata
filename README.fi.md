<p align="center"><img src="public/brand/mark.svg" width="72" alt=""></p>

# Dash the Data

**Sotkuisesta datasta dashboardiksi minuutissa.** Avoimen lähdekoodin BI-työkalu selaimessa:
pudota sotkuinen Excel, CSV, tietokanta tai rajapinta, niin saat siivotun datan, selityksen siitä
mitä siivottiin ja valmiin dashboardin, jonka jokaiselle kaaviolle on perustelu. [In English](README.md)

Suunnitelman vaiheet 0–10 ovat puussa: tuonti ja siivous, kaaviot, raahattava dashboard, unionit ja
liitokset, tietokanta- ja HTTP-lähteet sekä valinnainen Claude tai paikallinen malli.
Katso [TODO.md](TODO.md) ja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Paikalliset tietokannat: `docker compose up`. Yhdistäminen niihin vaatii `.env.local`-tiedostoon
`CONNECTORS_ALLOW_PRIVATE=true`.

## Paikallinen kehitys

```bash
npm install          # kopioi myös DuckDB-WASM-bundlet kansioon public/duckdb
cp .env.example .env.local
npm run dev
```

## Lisenssi

MIT
