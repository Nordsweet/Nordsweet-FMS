# Nordsweet FMS — Next.js

Next.js 16.4 App Router + React 19.3, ze statycznym eksportem do Sites.

## Uruchamianie

Wymagany Node.js 20.9+ i pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm start
```

`pnpm start` serwuje produkcyjny katalog `out` na http://127.0.0.1:3000.
W produkcji obsługiwane są dotychczasowe adresy `.html`. W trybie dev są mapowane
na trasy App Router. Nawigacja między narzędziami ładuje pełny dokument,
ponieważ ich istniejące silniki mają własne nasłuchy zdarzeń i cykl życia.

## Struktura

- `app/`: layout, metadane, główna strona i statyczne trasy narzędzi.
- `src/views/`: edytowalne komponenty JSX, w tym części głównego planera.
- `src/runtime/`: istniejące silniki obliczeniowe i obsługa kontrolek, ładowane
  jako oddzielne moduły Next.js po hydratacji React.
- `src/components/RuntimeBootstrap.jsx`: uporządkowane ładowanie danych,
  jednorazowy start silników, obsługa błędów uruchomienia.
- `public/`: dane lotnisk, samolotów, stref, wykresy i pozostałe zasoby.
- `scripts/finalize-export.mjs`: manifest offline związany z konkretnym buildem,
  obejmujący również pliki `_next`.
- `tests/`: regresje TOC, ograniczeń wysokości i czasu zmiany COMMs.

Migracja obejmuje wszystkie 11 ekranów. Obliczenia, płótno mapy i część
dynamicznie generowanych paneli nadal korzystają z dotychczasowego kodu DOM,
wydzielonego z HTML do modułów. Nie przepisano ich na hooki React ani nie
zmieniono modelu danych. Aplikacja nie wymaga serwera Node w produkcji.

Dane lokalne pozostają pod tymi samymi kluczami localStorage i tym samym
adresem Sites. Usługi pogodowe i inne źródła zewnętrzne zachowują dotychczasowe
wymagania dostępu. Nie dodano integracji Airframes.

Źródła projektu są w repozytorium Sites. Folder `out` jest generowany i nie
jest źródłem do ręcznej edycji. `scripts/migrate-to-next.mjs` dokumentuje
jednorazową konwersję; nie uruchamiać go ponownie po edycji komponentów.
