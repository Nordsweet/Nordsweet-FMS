# Nordsweet FMS

Planowanie lotu VFR, osiągi, pogoda, mapa i nawigacja w locie — aplikacja Next.js (T3) w
[`nextjs/`](nextjs/README.md).

| Gałąź | Rola |
|---|---|
| `develop` | przedprodukcyjna — https://dev.fms.lab.vibecde.com (tylko Tailscale, brak uwierzytelniania), wdrażana automatycznie ([`deploy/`](deploy/README.md)) |
| `main` | produkcja (poprzednia wersja do czasu przełączenia) |

```sh
cd nextjs
pnpm install --frozen-lockfile
pnpm dev
```

Dane na żywo (METAR/TAF, ATIS, NOTAM, ruch, przestrzenie, punkty VFR) pochodzą z
[Aviation API Collector](https://aviation.lab.vibecde.com/llms.txt), który wymaga logowania
(`POST /auth/login`, token Bearer); kont nie zakłada się samodzielnie — zakłada je administrator API.
Token trzyma `localStorage` (`nordsweet.auth.v1`); szczegóły i kompromis: `nextjs/src/stores/auth.ts`. Historia przepisania i decyzje:
[`docs/REWRITE_PLAN.md`](docs/REWRITE_PLAN.md).
Przenoszenie pozostałych ekranów ze starej wersji (instrukcje dla agentów i tablica prac):
[`AGENTS.md`](AGENTS.md).

Workflow `Next.js validation` (push na `main`/`develop`, pull requesty) uruchamia lint, formatowanie,
typy, testy jednostkowe, build i testy Playwright.
