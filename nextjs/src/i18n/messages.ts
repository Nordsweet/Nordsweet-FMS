import { type Language } from "~/stores/settings";

const pl = {
  "app.name": "Nordsweet FMS",
  "nav.plan": "Plan lotu",
  "nav.settings": "Ustawienia",
  "nav.legacy": "Poprzednia wersja",
  "plan.title": "Plan lotu",
  "plan.comingSoon":
    "Nowy planer powstaje. Do tego czasu korzystaj z poprzedniej wersji.",
  "plan.openLegacy": "Otwórz poprzedni planer",
  "settings.title": "Ustawienia",
  "settings.language": "Język",
  "settings.homeAirport": "Lotnisko macierzyste (ICAO)",
  "settings.pilotWeight": "Masa pilota (kg)",
  "settings.avwxToken": "Token AVWX",
  "settings.notamifyToken": "Token Notamify",
  "settings.tokensHint": "Tokeny są przechowywane tylko na tym urządzeniu.",
} as const;

export type MessageKey = keyof typeof pl;

const en: Record<MessageKey, string> = {
  "app.name": "Nordsweet FMS",
  "nav.plan": "Flight plan",
  "nav.settings": "Settings",
  "nav.legacy": "Previous version",
  "plan.title": "Flight plan",
  "plan.comingSoon":
    "The new planner is being built. Until then, use the previous version.",
  "plan.openLegacy": "Open the previous planner",
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.homeAirport": "Home airport (ICAO)",
  "settings.pilotWeight": "Pilot weight (kg)",
  "settings.avwxToken": "AVWX token",
  "settings.notamifyToken": "Notamify token",
  "settings.tokensHint": "Tokens are stored on this device only.",
};

export const messages: Record<Language, Record<MessageKey, string>> = {
  pl,
  en,
};
