export const airportLandingEn = {
  "airportLanding.title": "Landing at arrival",
  "airportLanding.ldaUsed": "LDA USED",
  "airportLanding.runway": "Landing runway",
  "airportLanding.remaining": "{meters} m remaining",
  "airportLanding.short": "{meters} m short",
  "airportLanding.noLda": "Published LDA unavailable",
  "airportLanding.needPosition":
    "A current position is needed to predict arrival.",
  "airportLanding.needPrediction":
    "Arrival cannot be calculated with the available speed, wind and fuel data.",
  "airportLanding.route": "Along FPL",
  "airportLanding.direct": "Direct from present position",
  "airportLanding.arrivalValues":
    "At arrival: {weight} kg · fuel {fuel} {unit}",
  "airportLanding.insufficientFuel":
    "Estimated fuel is insufficient for this arrival.",
  "airportLanding.holding": "ETA assumes leaving the hold now.",
  "airportLanding.weather":
    "Latest conditions / pilot inputs ({station}), held constant to arrival. Distance from 50 ft AGL.",
  "airportLanding.assumed":
    "Missing weather fields use 15°C, QNH 1013 or calm wind.",
};

export const airportLandingPl: Record<keyof typeof airportLandingEn, string> = {
  "airportLanding.title": "Lądowanie przy dolocie",
  "airportLanding.ldaUsed": "WYKORZYSTANIE LDA",
  "airportLanding.runway": "Pas do lądowania",
  "airportLanding.remaining": "{meters} m zapasu",
  "airportLanding.short": "brakuje {meters} m",
  "airportLanding.noLda": "Brak opublikowanej LDA",
  "airportLanding.needPosition": "Prognoza dolotu wymaga aktualnej pozycji.",
  "airportLanding.needPrediction":
    "Dostępne dane prędkości, wiatru i paliwa nie pozwalają obliczyć dolotu.",
  "airportLanding.route": "Dolot po FPL",
  "airportLanding.direct": "Direct z obecnej pozycji",
  "airportLanding.arrivalValues":
    "Przy dolocie: {weight} kg · paliwo {fuel} {unit}",
  "airportLanding.insufficientFuel":
    "Szacowane paliwo nie wystarcza na ten dolot.",
  "airportLanding.holding": "ETA zakłada opuszczenie holdingu teraz.",
  "airportLanding.weather":
    "Ostatnie warunki / dane pilota ({station}), stałe do czasu dolotu. Dystans od 50 ft AGL.",
  "airportLanding.assumed":
    "Brakujące dane pogody: przyjęto 15°C, QNH 1013 lub ciszę.",
};
