import { normalizeRegistration } from "./aircraft";

export type AircraftIdentity = { registration: string; hex: string | null };

/** A matching Mode S address is authoritative; never identify ownship by proximity or aircraft type. */
export function isOwnTraffic(
  target: {
    hex?: string;
    registration?: string | null;
    callsign?: string | null;
  },
  own?: AircraftIdentity | null,
) {
  if (!own) return false;
  if (own.hex && target.hex && /^[a-f0-9]{6}$/i.test(target.hex))
    return own.hex.toLowerCase() === target.hex.toLowerCase();
  const registration = normalizeRegistration(own.registration);
  const reportedRegistration = target.registration?.trim() ?? "";
  return (
    !!registration &&
    normalizeRegistration(
      reportedRegistration ? reportedRegistration : (target.callsign ?? ""),
    ) === registration
  );
}

/** The flight's typed registration takes precedence over an airframe profile's registration. */
export function ownRegistration(
  typed: string,
  profile: string | null | undefined,
) {
  const entered = typed.trim();
  const value = entered ? entered : (profile?.trim() ?? "");
  return profile &&
    normalizeRegistration(profile) === normalizeRegistration(value)
    ? profile.trim().toUpperCase()
    : value.toUpperCase();
}
