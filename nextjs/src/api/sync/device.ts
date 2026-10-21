const first = (
  userAgent: string,
  table: [string, string][],
  fallback: string,
) => table.find(([needle]) => userAgent.includes(needle))?.[1] ?? fallback;

/** A short name for the flight-in-progress prompt ("iPad · Safari"); the device id itself is opaque. */
export function deviceLabel(userAgent = navigator.userAgent) {
  const os = first(
    userAgent,
    [
      ["iPad", "iPad"],
      ["iPhone", "iPhone"],
      ["Android", "Android"],
      ["Mac OS X", "Mac"],
      ["Windows", "Windows"],
      ["Linux", "Linux"],
    ],
    "Device",
  );
  // Order matters: Edge and Chrome user agents also say Safari.
  const browser = first(
    userAgent,
    [
      ["Edg/", "Edge"],
      ["Firefox/", "Firefox"],
      ["Chrome/", "Chrome"],
      ["CriOS", "Chrome"],
      ["Safari/", "Safari"],
    ],
    "",
  );
  return browser ? `${os} · ${browser}` : os;
}
