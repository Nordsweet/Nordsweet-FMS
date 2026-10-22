export const atisCallsEn = {
  "atisCall.tokens": "Tokens Available",
  "atisCall.request": "Request ATIS Call (Cost = 1 token)",
  "atisCall.requesting": "Requesting",
  "atisCall.disabled":
    "Telephone ATIS is awaiting provider activation. No token will be charged.",
  "atisCall.unsupported": "Telephone ATIS is not configured for this airport.",
  "atisCall.empty": "Not enough tokens.",
  "atisCall.unavailable":
    "Token balance unavailable. Connect to the server to request ATIS.",
  "atisCall.error":
    "ATIS call could not be requested. Refreshing request status…",
  "atisCall.available": "{icao} ATIS available",
  "atisCall.failed": "{icao} ATIS call failed. Token returned.",
  "atisCall.view": "View",
  "atisCall.source": "Telephone ATIS",
};

export const atisCallsPl: Record<keyof typeof atisCallsEn, string> = {
  "atisCall.tokens": "Dostępne tokeny",
  "atisCall.request": "Zamów ATIS przez telefon (koszt = 1 token)",
  "atisCall.requesting": "Pobieranie",
  "atisCall.disabled":
    "Telefoniczny ATIS czeka na aktywację operatora. Token nie zostanie pobrany.",
  "atisCall.unsupported":
    "Telefoniczny ATIS nie jest skonfigurowany dla tego lotniska.",
  "atisCall.empty": "Brak wystarczającej liczby tokenów.",
  "atisCall.unavailable":
    "Saldo tokenów niedostępne. Połącz się z serwerem, aby zamówić ATIS.",
  "atisCall.error": "Nie udało się zamówić ATIS. Odświeżam stan żądania…",
  "atisCall.available": "{icao} ATIS dostępny",
  "atisCall.failed": "Nie udało się pobrać ATIS {icao}. Token został zwrócony.",
  "atisCall.view": "Wyświetl",
  "atisCall.source": "ATIS telefoniczny",
};
