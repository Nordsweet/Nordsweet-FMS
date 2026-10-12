# Nordsweet FMS

Planowanie lotu VFR, osiągi, pogoda, mapa i nawigacja w locie — aplikacja Next.js (T3) w
[`nextjs/`](nextjs/README.md).

| Gałąź | Rola |
|---|---|
| `develop` | przedprodukcyjna — nowa aplikacja; dostęp tylko przez Tailscale (brak uwierzytelniania) |
| `main` | produkcja (poprzednia wersja do czasu przełączenia) |

```sh
cd nextjs
pnpm install --frozen-lockfile
pnpm dev
```

Dane na żywo (METAR/TAF, ATIS, NOTAM, ruch, przestrzenie, punkty VFR) pochodzą z
[Aviation API Collector](https://aviation.lab.vibecde.com/llms.txt). Historia przepisania i decyzje:
[`docs/REWRITE_PLAN.md`](docs/REWRITE_PLAN.md).

Workflow `Next.js validation` (push na `main`/`develop`, pull requesty) uruchamia lint, formatowanie,
typy, testy jednostkowe, build i testy Playwright.
