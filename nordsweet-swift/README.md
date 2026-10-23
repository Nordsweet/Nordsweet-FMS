# Nordsweet — Swift / SwiftUI 0.2.0

Nowy, natywny projekt dla iPhone’a i iPada (iOS 17+). Interfejs używa SwiftUI, mapa MapKit, GPS CoreLocation, a obliczenia Swift. Nie zawiera Capacitor, WKWebView ani JavaScriptCore. Poprzedni projekt `nordsweet-ios` pozostaje oddzielną wersją referencyjną.

To pierwsza część migracji, a nie pełna zgodność funkcjonalna z rozbudowaną aplikacją webową. Źródła przygotowano na Windowsie. GitHub Actions na macOS wykonał 6 testów XCTest bez błędów i zbudował aplikację dla symulatora w Xcode 16.4: [wynik kompilacji](https://github.com/Nordsweet/Nordsweet-FMS/actions/runs/36243663324). Nie wykonano jeszcze testów interfejsu ani instalacji na iPhonie. Projekt nie jest podpisany i nie został wysłany do TestFlight.

## Działania zaimplementowane w kodzie

- Natywna mapa z gestami, trasą, TOC/TOD, przełączaniem podkładu, przyciskiem dopasowania trasy i lokalizacją po zgodzie użytkownika.
- Wybór spośród 590 lotnisk oraz trasy przez 756 punktów nawigacyjnych z dotychczasowych plików.
- Profil wysokości Swift Charts z ręcznie zadanymi gradientami wznoszenia i zniżania. Nieosiągalny profil zwraca błąd zamiast fikcyjnego TOC. ETE jest liczone bez wiatru.
- Kalkulator startu P2006T: masa, pressure altitude, temperatura, wiatr, nawierzchnia, nachylenie, rozbieg i dystans do 50 ft. Zachowuje interpolację, punkt ISA, poprawki i konserwatywny odczyt tabeli ze źródłowego JS. Poza zakresem tabel zwraca błąd zamiast zaciskać parametry do granicy tabeli.
- Checklisty przeniesione z danych samolotów; zaznaczenia są przechowywane lokalnie i można je zresetować dla wybranego profilu.
- Lokalny zapis lotów, otwieranie i usuwanie, eksport JSON/GPX, import natywnego JSON, istniejących plików NORD zawierających `route.plan.points` oraz pojedynczej trasy/segmentu GPX.

Import NORD przenosi geometrię trasy, nazwy punktów, wysokości i prędkość przelotową. Nie importuje całej konfiguracji pogodowej, ograniczeń proceduralnych, masy, zdarzeń ani ustawień aplikacji webowej. GPX nie zawiera prędkości przelotowej — import przyjmuje 100 kt; jego ETE jest szacunkiem dla tej wartości. Wielosegmentowe tracki GPX są odrzucane, aby nie łączyć przerw w jeden lot.

## Pozostały zakres migracji

| Funkcja webowa | Stan natywny |
|---|---|
| Mapa, gesty, trasa, GPS | Kod SwiftUI/MapKit przygotowany; test na iOS wymagany |
| TOC/TOD | Profil uproszczony, gradienty podawane ręcznie; brak pełnego solvera ograniczeń SID/STAR |
| Start P2006T | Port do Swift z 12 przypadkami referencyjnymi ze źródłowego JS |
| Pozostałe samoloty, lądowanie, wznoszenie i cruise performance | Do przeniesienia |
| Masa i wyważenie | Do przeniesienia |
| Strefy, AUP, NOTAM, ruch, radio | Do przeniesienia; nie są rysowane na obecnej mapie |
| METAR/TAF/ATIS/AWOS i usługi lokalnego serwera | Do przeniesienia; nie dodano backendu |
| SID/STAR, podejścia i rozwijanie dróg lotniczych | Do przeniesienia; można importować gotową geometrię z NORD |
| Timery automatyczne i symulacja GPX | Do przeniesienia |
| PDF i edytory danych | Do przeniesienia |
| Pełne mapy offline i GPS w tle | Niezaimplementowane |

Lokalne dane są kopią istniejącego projektu, nie aktualizują się automatycznie i nie są nową bazą AIRAC. Wersja w Sites nie jest zmieniana przez ten projekt.

## Otworzenie i kompilacja

Otwórz `Nordsweet.xcodeproj` w Xcode. Schemat: **Nordsweet**. Nie jest potrzebne npm, Capacitor, CocoaPods ani XcodeGen. Pakiet `Packages/NordsweetCore` jest dołączony lokalnie i zawiera również zasoby JSON.

Na Macu:

```sh
bash scripts/verify-macos.sh
open Nordsweet.xcodeproj
```

Skrypt uruchamia `swift test` dla pakietu z obliczeniami, a następnie buduje aplikację na symulator bez podpisu. Oba kroki przeszły na macOS; zachowanie interfejsu i GPS wymaga jeszcze sprawdzenia na urządzeniu.

## Praca z Windowsa

Repozytorium `Nordsweet/Nordsweet-FMS` zawiera projekt w `nordsweet-swift`, a workflow w głównym `.github/workflows/ios-check.yml`. Push zmian projektu na gałąź `codex/swiftui-native` uruchamia testy i kompilację na runnerze macOS. Dostępny jest też trigger `workflow_dispatch` (przycisk ręcznego uruchomienia wymaga workflow na domyślnej gałęzi).

Workflow przeszedł i zapisał artefakt `Nordsweet-simulator`. Nie wysyła aplikacji do Apple. Artefakt symulatora nie jest IPA i nie można go zainstalować przez TestFlight.

## TestFlight

Do TestFlight potrzebne jest aktywne, płatne członkostwo Apple Developer Program; sam bezpłatny profil developera nie wystarcza. Informacje: https://developer.apple.com/testflight/ oraz https://developer.apple.com/programs/enroll/.

Po pomyślnych testach i kompilacji:

1. W Xcode ustaw **Signing & Capabilities → Team** na swój zespół. Bundle ID roboczo wynosi `com.nordsweet.performance`; musi odpowiadać identyfikatorowi zarejestrowanemu na Twoim koncie. Nie zarejestrowano go automatycznie.
2. Wersja marketingowa: `0.2.0`, build: `2`. Jeśli te numery były już wysyłane, zwiększ build przed archiwizacją.
3. Utwórz rekord aplikacji w App Store Connect z tym samym Bundle ID, jeśli jeszcze go nie ma.
4. Zbuduj **Product → Archive** dla **Any iOS Device**, następnie **Distribute App → App Store Connect → Upload**. Sprawdź aktualne wymagania wersji Xcode: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds.
5. Uzupełnij wymagane dane beta, deklarację szyfrowania oraz informacje o prywatności i przypisz przetworzony build do grupy TestFlight.

Nie zapisuj certyfikatów ani kluczy w repozytorium. Do budowania i podpisywania w chmurze trzeba skonfigurować podpisywanie na wybranym hoście — ten projekt nie zawiera żadnych poświadczeń.

## Weryfikacja wykonana na Windowsie

- Eksport i sprawdzenie bazy: 590 unikalnych lotnisk, obecne EPBC i EPPO, 756 punktów.
- Uruchomienie dotychczasowego silnika JavaScript i zapis 12 oczekiwanych wyników do `takeoff-oracle.json`.
- Sprawdzenie składni 13 plików Swift parserem tree-sitter (bez błędów; nie jest to kompilacja).
- Sprawdzenie struktury projektu, plików zasobów, plist i schematu Xcode.

Na macOS wykonano 6 testów XCTest dla osiągów (12 przypadków porównawczych), odległości, TOC na punkcie trasy, nieosiągalnego profilu, importu NORD i zapisu/odczytu JSON/GPX. Wynik: 0 błędów. Kompilacja aplikacji dla symulatora: BUILD SUCCEEDED.

## Aktualizowanie źródeł

Kod aplikacji: `Nordsweet/App` i `Nordsweet/Views`. Obliczenia i modele: `Packages/NordsweetCore/Sources/NordsweetCore`. Testy: `Packages/NordsweetCore/Tests/NordsweetCoreTests`.

`node scripts/generate-project.cjs` odtwarza projekt Xcode po dodaniu plików Swift do katalogu aplikacji. Nadpisuje ustawienia projektu, więc wykonuj go przed ustawieniem własnego Team i podpisywania lub przenieś te ustawienia do generatora.

`node scripts/export-data.cjs` ponownie eksportuje bazę i przypadki porównawcze z sąsiedniego katalogu `nordsweet-ios/web-src`, jeśli istnieje, albo z nadrzędnego katalogu aplikacji webowej w repozytorium. Nie jest wymagany do zbudowania pobranej paczki — gotowe dane są już dołączone.
