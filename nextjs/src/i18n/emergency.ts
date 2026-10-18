export const emergencyEn = {
  "emer.pneumatic": "Pneumatic Pressure",
  "emer.notInstalled": "Not installed",
  "emer.verifiedVariants": "Available aircraft procedures",
  "emer.title": "Emergency Checklists",
  "emer.out": "Engine Out",
  "emer.fire": "Engine Fire",
  "emer.engine": "Engine",
  "emer.electric": "Electric",
  "emer.hydraulic": "Hydraulic",
  "emer.pax": "Pax",
  "emer.fuel": "Fuel",
  "emer.reference": "REFERENCE ONLY — APPLICABILITY NOT VERIFIED",
  "emer.referenceInfo":
    "FR172H model assigned by owner. Registration, serial range, equipment, complete manual edition and airspeed basis still require verification. This reference is not an operational checklist.",
  "emer.showReference": "Browse source reference (FR172H)",
  "emer.unavailable":
    "Verified procedure unavailable for this aircraft — consult aircraft AFM/POH",
  "emer.fireUnavailable":
    "Verified Engine Fire procedure unavailable for this aircraft",
  "emer.equipmentUnknown":
    "Installed equipment / procedure availability not documented",
  "emer.phase": "Procedure phase (manual override)",
  "emer.unknown": "Select phase — context unknown or requires pilot assessment",
  "emer.runway": "During Take-Off — sufficient runway ahead",
  "emer.after-takeoff": "After Take-Off",
  "emer.flight": "During Flight",
  "emer.ground": "On ground — engine start",
  "emer.confirmRunway": "I confirm sufficient runway ahead",
  "emer.speedUnavailable":
    "Best glide speed unavailable — consult aircraft AFM/POH",
  "emer.restartFailed": "Engine did not restart — secure engine",
  "emer.restarted": "Pilot reports engine restarted",
  "emer.landing": "Pilot selects emergency landing",
  "emer.outcome": "Pilot outcome",
  "emer.unresolved": "Unresolved",
  "emer.ended": "Ended",
  "emer.progress":
    "Checked {done}/{total} — completion does not resolve the emergency",
  "emer.end": "End / reset emergency",
  "emer.endConfirm":
    "End this emergency session and archive progress? The flight plan is retained.",
  "emer.cancel": "Cancel",
  "emer.confirm": "End session",
  "emer.resume": "Stored session / progress retained",
  "emer.noRoute":
    "No usable threshold / approach geometry, or no fresh airborne position",
  "emer.target": "Emergency target",
  "emer.preview": "Unvalidated preview — phase or procedure restrictions apply",
  "emer.suitability": "Runway availability / landing suitability unconfirmed",
  "emer.final": "0.5 NM final — true threshold axis; planning aid only",
  "emer.recalculate": "Recalculate / choose nearest",
  "emer.alternates": "Choose another runway / airport",
  "emer.rangeUnavailable":
    "Range unavailable / stale — valid AMSL altitude, GS and descent required",
  "emer.range":
    "Current-trend range {range} NM / {minutes} min; threshold {reference} ft AMSL",
  "emer.rangeLimit":
    "10 s smoothing; inputs expire after 20 s. No wind, obstacle clearance or landing margin. Green: estimated reachable via modeled approach; suitability unknown.",
  "emer.manualAmsl": "Current indicated altitude (ft AMSL, QNH corrected)",
  "emer.manualVs": "Current measured vertical speed (ft/min; descent negative)",
  "emer.record": "Record current instrument readings",
  "emer.noReachable": "No airport estimated reachable with current valid data",
  "emer.source": "Source / revision",
  "emer.selectReference": "Reference variants (source language retained)",
  "emer.setSpeed": "Set Speed to {speed} kt {basis} — {conditions}",
  "emer.hide": "Dismiss speed prompt",
  "emer.referenceExit": "Close reference view",
  "emer.original":
    "Original flight plan retained; end session to remove the emergency overlay",
  "emer.fresh":
    "Automatic plan requires fresh airborne context; select phase manually if uncertain",
};
export const emergencyPl: Record<keyof typeof emergencyEn, string> = {
  "emer.pneumatic": "Ciśnienie pneumatyczne",
  "emer.notInstalled": "Nie zainstalowano",
  "emer.verifiedVariants": "Dostępne procedury samolotu",
  "emer.title": "Checklisty awaryjne",
  "emer.out": "Engine Out",
  "emer.fire": "Engine Fire",
  "emer.engine": "Silnik",
  "emer.electric": "Elektryka",
  "emer.hydraulic": "Hydraulika",
  "emer.pax": "Pasażerowie",
  "emer.fuel": "Paliwo",
  "emer.reference": "MATERIAŁ REFERENCYJNY — NIEZWERYFIKOWANA STOSOWALNOŚĆ",
  "emer.referenceInfo":
    "Użytkownik przypisał materiał do FR172H. Rejestracja, zakres numerów seryjnych, wyposażenie, pełne wydanie instrukcji i podstawa prędkości wymagają weryfikacji. To nie jest checklista operacyjna.",
  "emer.showReference": "Przeglądaj materiał źródłowy (FR172H)",
  "emer.unavailable":
    "Brak zweryfikowanej procedury dla tego samolotu — sprawdź AFM/POH",
  "emer.fireUnavailable":
    "Brak zweryfikowanej procedury Engine Fire dla tego samolotu",
  "emer.equipmentUnknown": "Brak danych o wyposażeniu / dostępności procedury",
  "emer.phase": "Faza procedury (wybór ręczny)",
  "emer.unknown": "Wybierz fazę — kontekst nieznany lub wymaga oceny pilota",
  "emer.runway": "Podczas startu — wystarczający pas przed samolotem",
  "emer.after-takeoff": "Po starcie",
  "emer.flight": "W locie",
  "emer.ground": "Na ziemi — uruchamianie silnika",
  "emer.confirmRunway": "Potwierdzam wystarczający pas przed samolotem",
  "emer.speedUnavailable":
    "Brak zweryfikowanej prędkości szybowania — sprawdź AFM/POH",
  "emer.restartFailed": "Silnik nie uruchomił się — zabezpiecz silnik",
  "emer.restarted": "Pilot potwierdza ponowne uruchomienie silnika",
  "emer.landing": "Pilot wybiera lądowanie awaryjne",
  "emer.outcome": "Decyzja pilota",
  "emer.unresolved": "Nierozwiązana",
  "emer.ended": "Zakończona",
  "emer.progress":
    "Zaznaczono {done}/{total} — ukończenie nie kończy sytuacji awaryjnej",
  "emer.end": "Zakończ / resetuj sytuację awaryjną",
  "emer.endConfirm":
    "Zakończyć sesję awaryjną i zarchiwizować postęp? Plan lotu zostanie zachowany.",
  "emer.cancel": "Anuluj",
  "emer.confirm": "Zakończ sesję",
  "emer.resume": "Zapisana sesja / postęp zachowany",
  "emer.noRoute":
    "Brak użytecznej geometrii progów / podejścia lub aktualnej pozycji w locie",
  "emer.target": "Cel awaryjny",
  "emer.preview":
    "Niezweryfikowany podgląd — obowiązują ograniczenia fazy i procedury",
  "emer.suitability":
    "Dostępność i przydatność pasa do lądowania niepotwierdzona",
  "emer.final": "Prosta 0,5 NM — rzeczywista oś progu; pomoc planistyczna",
  "emer.recalculate": "Przelicz / wybierz najbliższe",
  "emer.alternates": "Wybierz inny pas / lotnisko",
  "emer.rangeUnavailable":
    "Zasięg niedostępny / nieaktualny — wymagane wysokość AMSL, GS i opadanie",
  "emer.range":
    "Zasięg z bieżącego trendu {range} NM / {minutes} min; próg {reference} ft AMSL",
  "emer.rangeLimit":
    "Wygładzanie 10 s; dane wygasają po 20 s. Bez wiatru, przeszkód i marginesu lądowania. Zieleń: szacowany zasięg po modelowanej trasie; przydatność nieznana.",
  "emer.manualAmsl":
    "Bieżąca wysokość z wysokościomierza (ft AMSL, prawidłowe QNH)",
  "emer.manualVs":
    "Bieżąca zmierzona prędkość pionowa (ft/min; opadanie ujemne)",
  "emer.record": "Zapisz bieżące wskazania przyrządów",
  "emer.noReachable":
    "Żadne lotnisko nie mieści się w szacowanym zasięgu według aktualnych danych",
  "emer.source": "Źródło / rewizja",
  "emer.selectReference": "Warianty referencyjne (oryginalny język źródła)",
  "emer.setSpeed": "Ustaw prędkość {speed} kt {basis} — {conditions}",
  "emer.hide": "Ukryj komunikat prędkości",
  "emer.referenceExit": "Zamknij materiał referencyjny",
  "emer.original":
    "Oryginalny plan lotu zachowany; zakończenie sesji usuwa warstwę awaryjną",
  "emer.fresh":
    "Plan automatyczny wymaga aktualnego kontekstu lotu; w razie wątpliwości wybierz fazę ręcznie",
};
