export const atisCallsEn = {
  "atisCall.request": "Request ATIS Call",
  "atisCall.requesting": "Requesting",
  "atisCall.disabled": "Telephone ATIS is awaiting provider activation.",
  "atisCall.unsupported": "Telephone ATIS is not configured for this airport.",
  "atisCall.unavailable":
    "Telephone ATIS unavailable. Connect to the server to request ATIS.",
  "atisCall.error":
    "ATIS call could not be requested. Refreshing request status…",
  "atisCall.busy": "ATIS for this airport is already being requested.",
  "atisCall.again": "Call again",
  "atisCall.none": "No telephone ATIS yet.",
  "atisCall.format.text": "Text",
  "atisCall.format.datis": "D-ATIS",
  "atisCall.datisNote":
    "D-ATIS style (generated from the telephone ATIS), not the official D-ATIS.",
  "atisCall.changed": "The ATIS changed during the call.",
  "atisCall.misheard": "A letter was misheard.",
  "atisCall.unreadable": "No ATIS message could be read.",
  "atisCall.redo": "A repeat call has already been requested.",
  "atisCall.noMessage": "{icao} ATIS could not be read.",
  "atisCall.noText": "{icao} ATIS has no text: {reason}.",
  "atisCall.available": "{icao} ATIS available",
  "atisCall.failed": "{icao} ATIS call failed.",
  "atisCall.view": "View",
  "atisCall.source": "Telephone ATIS",
};

export const atisCallsPl: Record<keyof typeof atisCallsEn, string> = {
  "atisCall.request": "Zamów ATIS przez telefon",
  "atisCall.requesting": "Pobieranie",
  "atisCall.disabled": "Telefoniczny ATIS czeka na aktywację operatora.",
  "atisCall.unsupported":
    "Telefoniczny ATIS nie jest skonfigurowany dla tego lotniska.",
  "atisCall.unavailable":
    "ATIS telefoniczny niedostępny. Połącz się z serwerem, aby zamówić ATIS.",
  "atisCall.error": "Nie udało się zamówić ATIS. Odświeżam stan żądania…",
  "atisCall.busy": "ATIS tego lotniska jest już zamawiany.",
  "atisCall.again": "Zadzwoń ponownie",
  "atisCall.none": "Brak ATIS telefonicznego.",
  "atisCall.format.text": "Tekst",
  "atisCall.format.datis": "D-ATIS",
  "atisCall.datisNote":
    "W stylu D-ATIS (wygenerowany z ATIS telefonicznego), nie oficjalny D-ATIS.",
  "atisCall.changed": "ATIS zmienił się w trakcie rozmowy.",
  "atisCall.misheard": "Przesłyszano literę ATIS.",
  "atisCall.unreadable": "Nie udało się odczytać ATIS.",
  "atisCall.redo": "Ponowne połączenie zostało już zamówione.",
  "atisCall.noMessage": "Nie udało się odczytać ATIS {icao}.",
  "atisCall.noText": "ATIS {icao} bez tekstu: {reason}.",
  "atisCall.available": "{icao} ATIS dostępny",
  "atisCall.failed": "Nie udało się pobrać ATIS {icao}.",
  "atisCall.view": "Wyświetl",
  "atisCall.source": "ATIS telefoniczny",
};
