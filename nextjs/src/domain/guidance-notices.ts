import { type TimedGuidance } from "./guidance-timeline";

export type GuidanceNotice = TimedGuidance & { announcedAt: number | null };
export type GuidanceNotices = {
  session: string | null;
  seen: Set<string>;
  notices: GuidanceNotice[];
};

/** Countdown predictions can move with the aircraft; NOW and its history timestamp are latched once. */
export function observeGuidance(
  state: GuidanceNotices,
  session: string,
  context: string,
  events: TimedGuidance[],
  now: number,
  available = true,
): GuidanceNotices {
  const same = state.session === session;
  const seen = new Set(same ? state.seen : []);
  const previous = same ? state.notices : [];
  let notices = previous.filter(
    (n) => n.announcedAt !== null && now < n.announcedAt + 12000,
  );
  // The aircraft may already have captured the new course at the boundary.
  // Finish its countdown even when a corrective command is no longer needed.
  for (const n of previous) {
    if (
      available &&
      n.key.startsWith(`${context}|`) &&
      n.announcedAt === null &&
      now >= n.dueAt &&
      now - n.dueAt < 5000 &&
      !events.some((e) => `${context}|${e.key}` === n.key && e.dueAt > now)
    ) {
      notices.push({ ...n, announcedAt: now });
      seen.add(n.key);
    }
  }
  for (const event of events) {
    const key = `${context}|${event.key}`;
    if (seen.has(key)) continue;
    const existing = previous.find(
      (n) => n.key === key && n.announcedAt === null,
    );
    const announcedAt = now >= event.dueAt ? now : null;
    const notice =
      existing?.dueAt === event.dueAt && announcedAt === null
        ? existing
        : { ...event, key, announcedAt };
    notices.push(notice);
    if (announcedAt !== null) seen.add(key);
  }
  // A newly due instruction supersedes the previous target of that category.
  notices = notices.filter(
    (n, i) =>
      n.announcedAt === null ||
      !notices.some(
        (other, j) =>
          j > i &&
          other.announcedAt !== null &&
          other.command.category === n.command.category,
      ),
  );
  if (
    same &&
    seen.size === state.seen.size &&
    notices.length === state.notices.length &&
    notices.every((n, i) => n === state.notices[i])
  )
    return state;
  return { session, seen, notices };
}
