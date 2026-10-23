export const myPlannerEn = {
  "planner.title": "My Planner",
  "planner.add": "Add flight",
  "planner.today": "Today",
  "planner.previous": "Previous period",
  "planner.next": "Next period",
  "planner.week": "Week",
  "planner.month": "Month",
  "planner.departure": "Planned take-off (local time)",
  "planner.create": "Continue in Flight Planner",
  "planner.save": "Save to My Planner",
  "planner.saved": "Flight saved to My Planner",
  "planner.edit": "Edit flight",
  "planner.remove": "Remove from calendar",
  "planner.removeHint": "The flight remains in Saved Flights.",
  "planner.inherit": "Previous flight: {route} · {registration}",
  "planner.fuel": "Planned fuel after landing: {fuel}",
  "planner.fuelUnknown":
    "Previous flight fuel cannot be calculated yet. Enter starting fuel in Flight Planner.",
  "planner.none":
    "No previous scheduled flight. Complete aircraft, airports and fuel in Flight Planner.",
  "planner.hint":
    "Local time · event length follows the planned flight time. Click a flight to edit it.",
  "planner.empty": "No flights in this period. Use + to plan a flight.",
  "planner.incomplete": "Complete flight plan",
  "planner.duration": "{minutes} min",
  "planner.invalid": "Enter a valid take-off date and time.",
  "planner.saveHint":
    "Choose a take-off time, complete the plan, then save it to My Planner.",
  "planner.error":
    "Could not save the flight. Your current plan is still available.",
} as const;

export const myPlannerPl: Record<keyof typeof myPlannerEn, string> = {
  "planner.title": "My Planner",
  "planner.add": "Dodaj lot",
  "planner.today": "Dzisiaj",
  "planner.previous": "Poprzedni okres",
  "planner.next": "Następny okres",
  "planner.week": "Tydzień",
  "planner.month": "Miesiąc",
  "planner.departure": "Planowany start (czas lokalny)",
  "planner.create": "Kontynuuj w Flight Plannerze",
  "planner.save": "Zapisz do My Planner",
  "planner.saved": "Lot zapisany w My Planner",
  "planner.edit": "Edytuj lot",
  "planner.remove": "Usuń z kalendarza",
  "planner.removeHint": "Lot pozostanie w Saved Flights.",
  "planner.inherit": "Poprzedni lot: {route} · {registration}",
  "planner.fuel": "Planowane paliwo po lądowaniu: {fuel}",
  "planner.fuelUnknown":
    "Nie można jeszcze obliczyć paliwa po poprzednim locie. Wpisz paliwo początkowe w Flight Plannerze.",
  "planner.none":
    "Brak poprzedniego lotu w harmonogramie. Uzupełnij samolot, lotniska i paliwo w Flight Plannerze.",
  "planner.hint":
    "Czas lokalny · długość wydarzenia odpowiada planowanemu czasowi lotu. Kliknij lot, aby go edytować.",
  "planner.empty": "Brak lotów w tym okresie. Użyj +, aby zaplanować lot.",
  "planner.incomplete": "Uzupełnij plan lotu",
  "planner.duration": "{minutes} min",
  "planner.invalid": "Wpisz prawidłową datę i godzinę startu.",
  "planner.saveHint":
    "Wybierz czas startu, uzupełnij plan i zapisz go w My Planner.",
  "planner.error":
    "Nie udało się zapisać lotu. Bieżący plan jest nadal dostępny.",
};
