# Nordsweet FMS — Next.js (T3)

Next.js 16.4 App Router + React 19.3 + TypeScript + Tailwind CSS 4 + zod/`@t3-oss/env-nextjs`
(układ [create-t3-app](https://create.t3.gg), bez tRPC, bazy danych i NextAuth), ze statycznym
eksportem do Sites.

## Uruchamianie

Wymagany Node.js 20.9+ i pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` serwuje produkcyjny katalog `out` na http://127.0.0.1:3000.
W produkcji obsługiwane są dotychczasowe adresy `.html`. W trybie dev są mapowane
na trasy App Router. Nawigacja między narzędziami ładuje pełny dokument,
ponieważ ich istniejące silniki mają własne nasłuchy zdarzeń i cykl życia.

## Struktura

- `src/app/`: layout, metadane, główna strona i statyczne trasy narzędzi.
- `src/views/`: komponenty TSX, w tym części głównego planera.
- `src/runtime/`: istniejące silniki obliczeniowe i obsługa kontrolek (JavaScript, `@ts-nocheck`),
  ładowane jako oddzielne moduły Next.js po hydratacji React. Każdy ekran przenoszony na React
  dostaje własne, typowane moduły zamiast silnika.
- `src/components/RuntimeBootstrap.tsx`: uporządkowane ładowanie danych,
  jednorazowy start silników, obsługa błędów uruchomienia.
- `src/pages.ts`, `src/pages.json`: lista ekranów i ich tytuły.
- `src/env.js`: walidacja zmiennych środowiskowych (zod).
- `src/styles/globals.css`: Tailwind bez Preflight — istniejące ekrany mają własny CSS i
  polegają na domyślnych stylach przeglądarki. Pełny `@import "tailwindcss"` po migracji ekranów.
- `public/`: dane lotnisk, samolotów, stref, wykresy i pozostałe zasoby.
- `scripts/finalize-export.mjs`: manifest offline związany z konkretnym buildem,
  obejmujący również pliki `_next`.
- `tests/`: regresje TOC, ograniczeń wysokości i czasu zmiany COMMs.

Obliczenia, płótno mapy i część dynamicznie generowanych paneli nadal korzystają
z dotychczasowego kodu DOM. Aplikacja nie wymaga serwera Node w produkcji.

Dane lokalne pozostają pod tymi samymi kluczami localStorage i tym samym
adresem Sites. Usługi pogodowe i inne źródła zewnętrzne zachowują dotychczasowe
wymagania dostępu. Nie dodano integracji Airframes.

Źródła projektu są w repozytorium Sites. Folder `out` jest generowany i nie
jest źródłem do ręcznej edycji.
