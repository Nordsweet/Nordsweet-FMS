export const userDataEn = {
  "userdata.import.title": "Some data was not uploaded",
  "userdata.import.body":
    "The server refused these items from this device. They stay on this device and are not sent again until you change them.",
  "userdata.dismiss": "Dismiss",
  "userdata.notice.mth":
    "MTH of {airframe} is lower than the previous reading ({previous}). It was saved; check it.",
  "userdata.notice.mthUnknown":
    "MTH of {airframe} is lower than the previous reading. It was saved; check it.",
  "userdata.notice.log.409":
    "The server has deleted this flight log before, so it was not saved again.",
  "userdata.notice.log.413":
    "The flight log is too large for the server and was not saved. {detail}",
  "userdata.notice.log.422":
    "The server refused the flight log and it was not saved. {detail}",
  "userdata.notice.log.other":
    "The flight log could not be saved (error {status}). {detail}",
  "userdata.delete.title": "Server data",
  "userdata.delete.body":
    "Everything stored for your account on the server: saved flights, custom aircraft, flight history with GPS tracks, settings, favorites and airframe readings. Your account stays.",
  "userdata.delete.button": "Delete my server data",
  "userdata.delete.confirmTitle": "Delete all your server data?",
  "userdata.delete.confirmBody":
    "This cannot be undone. The copies of this data on this device are removed too. Type your username ({username}) to confirm.",
  "userdata.delete.username": "Username",
  "userdata.delete.submit": "Delete everything",
  "userdata.delete.cancel": "Cancel",
  "userdata.delete.working": "Deleting…",
  "userdata.delete.done": "Your server data was deleted.",
  "userdata.delete.failed": "Could not delete: {error}",
  "nav.history": "History",
  "history.title": "Flight history",
  "history.intro":
    "Finished flights saved on the server. Deleting a flight also deletes its GPS track.",
  "history.empty": "No finished flights yet.",
  "history.loading": "Loading…",
  "history.error": "Could not load the history: {error}",
  "history.more": "Show more",
  "history.details": "Details",
  "history.hide": "Hide",
  "history.delete": "Delete",
  "history.delete.confirm":
    "Delete this flight and its GPS track from the server? This cannot be undone.",
  "history.untyped": "Unknown aircraft",
  "history.block": "Block time",
  "history.air": "Air time",
  "history.mth": "MTH",
  "history.fuel": "Fuel",
  "history.track": "Track",
  "history.track.points": {
    one: "{count} point",
    other: "{count} points",
  },
  "history.track.none": "No track was saved.",
  "history.track.summary": "{distance} NM, up to {altitude} ft",
  "history.track.loading": "Loading the track…",
  "history.track.gpx": "Download GPX",
  "history.emergencies": "Emergency sessions",
  "history.unknown": "—",
} as const;

export const userDataPl = {
  "userdata.import.title": "Część danych nie została wysłana",
  "userdata.import.body":
    "Serwer odrzucił te elementy z tego urządzenia. Zostają na tym urządzeniu i nie będą wysyłane ponownie, dopóki ich nie zmienisz.",
  "userdata.dismiss": "Zamknij",
  "userdata.notice.mth":
    "MTH statku {airframe} jest niższe niż poprzedni odczyt ({previous}). Zapisano; sprawdź to.",
  "userdata.notice.mthUnknown":
    "MTH statku {airframe} jest niższe niż poprzedni odczyt. Zapisano; sprawdź to.",
  "userdata.notice.log.409":
    "Serwer usunął wcześniej ten dziennik lotu, więc nie zapisano go ponownie.",
  "userdata.notice.log.413":
    "Dziennik lotu jest za duży dla serwera i nie został zapisany. {detail}",
  "userdata.notice.log.422":
    "Serwer odrzucił dziennik lotu i nie został zapisany. {detail}",
  "userdata.notice.log.other":
    "Nie udało się zapisać dziennika lotu (błąd {status}). {detail}",
  "userdata.delete.title": "Dane na serwerze",
  "userdata.delete.body":
    "Wszystko, co serwer przechowuje dla Twojego konta: zapisane loty, własne samoloty, historia lotów ze śladami GPS, ustawienia, ulubione i odczyty płatowców. Konto zostaje.",
  "userdata.delete.button": "Usuń moje dane z serwera",
  "userdata.delete.confirmTitle": "Usunąć wszystkie dane z serwera?",
  "userdata.delete.confirmBody":
    "Tego nie można cofnąć. Kopie tych danych na tym urządzeniu też zostaną usunięte. Wpisz swoją nazwę użytkownika ({username}), aby potwierdzić.",
  "userdata.delete.username": "Nazwa użytkownika",
  "userdata.delete.submit": "Usuń wszystko",
  "userdata.delete.cancel": "Anuluj",
  "userdata.delete.working": "Usuwanie…",
  "userdata.delete.done": "Dane z serwera zostały usunięte.",
  "userdata.delete.failed": "Nie udało się usunąć: {error}",
  "nav.history": "Historia",
  "history.title": "Historia lotów",
  "history.intro":
    "Zakończone loty zapisane na serwerze. Usunięcie lotu usuwa też jego ślad GPS.",
  "history.empty": "Brak zakończonych lotów.",
  "history.loading": "Ładowanie…",
  "history.error": "Nie udało się wczytać historii: {error}",
  "history.more": "Pokaż więcej",
  "history.details": "Szczegóły",
  "history.hide": "Ukryj",
  "history.delete": "Usuń",
  "history.delete.confirm":
    "Usunąć ten lot i jego ślad GPS z serwera? Tego nie można cofnąć.",
  "history.untyped": "Nieznany samolot",
  "history.block": "Czas blokowy",
  "history.air": "Czas w powietrzu",
  "history.mth": "MTH",
  "history.fuel": "Paliwo",
  "history.track": "Ślad",
  "history.track.points": {
    one: "{count} punkt",
    few: "{count} punkty",
    many: "{count} punktów",
    other: "{count} punktu",
  },
  "history.track.none": "Nie zapisano śladu.",
  "history.track.summary": "{distance} NM, do {altitude} ft",
  "history.track.loading": "Wczytywanie śladu…",
  "history.track.gpx": "Pobierz GPX",
  "history.emergencies": "Sesje awaryjne",
  "history.unknown": "—",
} as const;
