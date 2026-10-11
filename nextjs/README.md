# Nordsweet FMS — Next.js (T3)

Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + zod
(układ [create-t3-app](https://create.t3.gg), na razie bez backendu), ze statycznym
eksportem i trybem offline. Plan przepisania: [`../docs/REWRITE_PLAN.md`](../docs/REWRITE_PLAN.md).

## Uruchamianie

Wymagany Node.js 22 i pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev            # serwer deweloperski
pnpm check          # lint + typy + testy jednostkowe
pnpm build          # statyczny eksport do out/
pnpm start          # serwuje out/ na http://127.0.0.1:3000
pnpm test:e2e       # Playwright na zbudowanym eksporcie
pnpm data:import    # przelicza public/data/*.json z dawnych plików danych
```

## Dwie aplikacje w trakcie migracji

- **Nowa aplikacja** — `/v2`, `src/app/(app)`: pełny Tailwind + shadcn/ui, PL/EN.
- **Poprzednia wersja** — `/`, `/<narzędzie>.html`, `src/app/(legacy)`: dotychczasowe ekrany
  i silniki DOM (`src/runtime/*.js`, bez sprawdzania typów), wyświetlane bez zmian.
  Każdy obszar jest usuwany po przeniesieniu do nowej aplikacji.

## Struktura

- `src/domain/` — czyste obliczenia (jednostki, geo, atmosfera ISA, wiatr, deklinacja WMM)
  z testami. Bez Reacta i DOM.
- `src/data/schemas.ts` — schematy zod danych referencyjnych.
- `public/data/` — lotniska, punkty nawigacyjne, częstotliwości (JSON generowany przez
  `pnpm data:import`, dostępny offline).
- `src/api/` — jedyna granica danych („dummy backend”). Procedury w kształcie przyszłych
  routerów tRPC (`api.airports.search.queryOptions(...)`), dziś rozwiązywane lokalnie.
- `src/stores/` — stan klienta (Zustand, zapis w localStorage, jednorazowa migracja
  z kluczy `nordsweet.*.v1`).
- `src/i18n/` — słowniki PL/EN.
- `src/components/ui/` — komponenty shadcn/ui; `src/components/shell/` — układ i providery.
- `public/sw.js` + `scripts/finalize-export.mjs` — service worker i manifest offline.
- `tests/legacy/` — regresje dawnego planera; `e2e/` — testy Playwright (w tym offline).

Dane lokalne pozostają pod dotychczasowymi kluczami localStorage. Folder `out` jest
generowany i nie jest źródłem do ręcznej edycji.
