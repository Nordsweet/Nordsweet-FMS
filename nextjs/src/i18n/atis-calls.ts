export const atisCallsEn = {
  "atisCall.request": "Request ATIS Call",
  "atisCall.requesting": "Requesting",
  "atisCall.disabled": "Telephone ATIS is awaiting provider activation.",
  "atisCall.unsupported": "Telephone ATIS is not configured for this airport.",
  "atisCall.unavailable":
    "Telephone ATIS unavailable. Connect to the server to request ATIS.",
  "atisCall.error":
    "ATIS call could not be requested. Refreshing request status…",
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
  "atisCall.available": "{icao} ATIS dostępny",
  "atisCall.failed": "Nie udało się pobrać ATIS {icao}.",
  "atisCall.view": "Wyświetl",
  "atisCall.source": "ATIS telefoniczny",
};
