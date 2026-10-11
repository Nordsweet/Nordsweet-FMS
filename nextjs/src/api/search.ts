import { type Airport, type Navpoint } from "~/data/schemas";

/** Case- and diacritic-insensitive key ("Łódź" → "lodz"). */
export function searchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .trim();
}

function rank(query: string, codes: string[], name: string) {
  if (codes.some((code) => searchKey(code) === query)) return 0;
  if (codes.some((code) => searchKey(code).startsWith(query))) return 1;
  const folded = searchKey(name);
  if (folded.startsWith(query)) return 2;
  if (folded.includes(query)) return 3;
  return null;
}

function search<T>(
  items: T[],
  rawQuery: string,
  limit: number,
  fields: (item: T) => [string[], string],
) {
  const query = searchKey(rawQuery);
  if (!query) return [];
  return items
    .map((item) => {
      const [codes, name] = fields(item);
      return { item, score: rank(query, codes, name) };
    })
    .filter((hit): hit is { item: T; score: number } => hit.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((hit) => hit.item);
}

export function searchAirports(airports: Airport[], query: string, limit = 20) {
  return search(airports, query, limit, (a) => [
    [a.ident, ...a.aliases],
    a.name,
  ]);
}

export function searchNavpoints(
  navpoints: Navpoint[],
  query: string,
  limit = 20,
) {
  return search(navpoints, query, limit, (p) => [[p.ident], p.name]);
}

export function findAirport(airports: Airport[], code: string) {
  const key = code.trim().toUpperCase();
  return (
    airports.find((a) => a.ident === key) ??
    airports.find((a) => a.aliases.includes(key))
  );
}
