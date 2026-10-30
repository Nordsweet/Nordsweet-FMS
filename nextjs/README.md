# Nordsweet FMS — aplikacja

Next.js 16 (App Router, statyczny eksport) + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui +
zod + TanStack Query + Zustand + deck.gl. Układ [create-t3-app](https://create.t3.gg). Dane pilota
(zapisane loty, własne samoloty, godziny i paliwo płatowców, historia lotów, ustawienia, ulubione)
są na serwerze Aviation API; przeglądarka trzyma kopię i działa offline (service worker,
IndexedDB). Szczegóły: [docs/agents/USER_DATA.md](../docs/agents/USER_DATA.md).

## Uruchamianie

Wymagany Node.js 26 i pnpm 11.19.

```sh
pnpm install --frozen-lockfile
pnpm dev            # http://127.0.0.1:3000
pnpm check          # lint + typy + testy jednostkowe
pnpm format:check   # Prettier
pnpm build          # statyczny eksport do out/
pnpm start          # serwuje out/ na http://127.0.0.1:3000 (PORT zmienia port)
pnpm test:e2e       # Playwright na zbudowanym eksporcie
```

`NEXT_PUBLIC_AVIATION_API_URL` (domyślnie `https://aviation.lab.vibecde.com`) — adres API, patrz
`.env.example`.

## Ekrany

| Ścieżka       | Zawartość                                                                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | plan lotu: samolot, trasa (SID/STAR), pogoda i NOTAM (+ udostępnianie ATIS), przelot i ekonomia mocy, log nawigacyjny z TOC/TOD, paliwo, masa i wyważenie, osiągi startu/lądowania, kołowanie, zapisane loty (`.nord`) |
| `/map`        | mapa: przestrzenie (AUP/UUP), lotniska, punkty VFR/IFR, trasa, ruch ADS-B                                                                                                                                              |
| `/fly`        | lot: GPS, aktywny odcinek, direct-to, FREDA, częstotliwości, ślad i GPX                                                                                                                                                |
| `/checklists` | checklisty samolotu, czytanie na głos                                                                                                                                                                                  |
| `/settings`   | język PL/EN, lotnisko macierzyste, masa pilota                                                                                                                                                                         |

Dawne adresy (`index.html`, `airspaces-map.html`, `PFD.html`, …) przekierowują do nowych ekranów.
Dane z poprzedniej wersji (ustawienia, zapisane trasy) są przenoszone przy pierwszym uruchomieniu.

## Struktura

- `src/app/` — trasy (cienkie). `src/features/` — ekrany (plan, map, fly, checklists).
- `src/domain/` — czyste obliczenia z testami: geo, atmosfera ISA, wiatr, WMM, osiągi (siatki POH),
  wznoszenie, przelot, paliwo, log nawigacyjny, masa i wyważenie, postęp lotu, kołowanie, METAR, ślad.
- `src/data/` — schematy zod (lotniska, punkty, samoloty, procedury, kołowanie, mapy, lot, `.nord`).
- `public/data/` — dane referencyjne (JSON, źródło prawdy; edycja ręczna do czasu panelu
  administracyjnego w backendzie). Przy zmianie uruchom `pnpm test` — testy walidują pliki.
- `src/api/` — jedyna granica danych, procedury w kształcie przyszłych routerów tRPC; dziś dane
  referencyjne lokalnie, dane na żywo i dane pilota z Aviation API (`src/api/userdata/`), z kopią
  w IndexedDB/localStorage.
- `src/stores/` — Zustand (ustawienia, bieżący lot, lot w toku). `src/i18n/` — słowniki PL/EN.
- `tests/` — testy złote osiągów względem wyników poprzedniego planera (`tests/fixtures`), `e2e/` —
  Playwright (w tym offline, mapa, lot z symulowanym GPS).

Wszystkie wartości są pomocą w planowaniu — nie zastępują POH, AIP, NOTAM ani obserwacji.
