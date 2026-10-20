export const sessionSyncEn = {
  "session.status.idle": "Synced",
  "session.status.syncing": "Syncing…",
  "session.status.offline":
    "Offline: changes are kept on this device and sent when the connection returns.",
  "session.status.error": "Sync problem",
  "session.status.pending": "{count} change(s) waiting to be sent.",
  "session.status.title": "Session sync: {status}",
  "session.reason.conflict":
    "Could not merge a change with the server's version. It stays on this device.",
  "session.reason.forbidden": "This account cannot sync.",
  "session.rejected": "Not synced: {items}",
  "session.offer.title": "Flight in progress on {device}",
  "session.offer.body":
    "Last update {time}. Take it over here, or keep flying on this device?",
  "session.offer.bodyConflict":
    "Last update {time}. You also have a flight in progress on this device. Taking over replaces it.",
  "session.offer.take": "Take over here",
  "session.offer.keep": "Keep this device",
  "session.offer.dismiss": "Not now",
} as const;
export const sessionSyncPl = {
  "session.status.idle": "Zsynchronizowano",
  "session.status.syncing": "Synchronizacja…",
  "session.status.offline":
    "Offline: zmiany czekają na tym urządzeniu i zostaną wysłane po odzyskaniu połączenia.",
  "session.status.error": "Problem z synchronizacją",
  "session.status.pending": "Zmiany oczekujące na wysłanie: {count}.",
  "session.status.title": "Synchronizacja sesji: {status}",
  "session.reason.conflict":
    "Nie udało się scalić zmiany z wersją z serwera. Zostaje na tym urządzeniu.",
  "session.reason.forbidden": "To konto nie może synchronizować danych.",
  "session.rejected": "Nie zsynchronizowano: {items}",
  "session.offer.title": "Lot w toku na urządzeniu: {device}",
  "session.offer.body":
    "Ostatnia aktualizacja {time}. Przejąć lot tutaj czy lecieć dalej na tym urządzeniu?",
  "session.offer.bodyConflict":
    "Ostatnia aktualizacja {time}. Na tym urządzeniu też trwa lot. Przejęcie go zastąpi.",
  "session.offer.take": "Przejmij tutaj",
  "session.offer.keep": "Zostań na tym urządzeniu",
  "session.offer.dismiss": "Nie teraz",
} as const;
