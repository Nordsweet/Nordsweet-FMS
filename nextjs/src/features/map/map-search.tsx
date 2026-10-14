import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { type MapSearchResult } from "~/domain/map-search";
import { useT } from "~/i18n/use-t";

/** Search is submitted explicitly; duplicate matches are chosen by the pilot. */
export function MapSearch({
  search,
  select,
  close,
}: {
  search: (text: string) => Promise<MapSearchResult[]>;
  select: (result: MapSearchResult) => void;
  close: () => void;
}) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<MapSearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  return (
    <section
      role="dialog"
      aria-label={t("mapsearch.title")}
      className="bg-card/95 text-card-foreground absolute top-20 right-3 left-3 z-40 grid max-h-[65%] gap-3 overflow-auto rounded-2xl border p-4 shadow-xl backdrop-blur sm:right-auto sm:w-80"
    >
      <div className="flex items-center justify-between gap-2">
        <strong>{t("mapsearch.title")}</strong>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            request.current++;
            close();
          }}
        >
          {t("map.close")}
        </Button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const id = ++request.current;
          setBusy(true);
          setMessage(null);
          setResults([]);
          try {
            const matches = await search(text);
            if (id !== request.current) return;
            if (matches.length === 1) select(matches[0]!);
            else {
              setResults(matches);
              if (!matches.length) setMessage(t("mapsearch.noResults"));
            }
          } catch {
            if (id === request.current) setMessage(t("mapsearch.error"));
          } finally {
            if (id === request.current) setBusy(false);
          }
        }}
      >
        <Input
          autoFocus
          aria-label={t("mapsearch.query")}
          placeholder="KELEL, EPKK, TR 165, SP-GUN…"
          value={text}
          onChange={(e) => {
            request.current++;
            setBusy(false);
            setText(e.target.value);
            setResults([]);
            setMessage(null);
          }}
        />
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {t("mapsearch.submit")}
        </Button>
      </form>
      {busy && <p role="status">{t("mapsearch.loading")}</p>}
      {message && <p role="status">{message}</p>}
      {!!results.length && (
        <div className="grid gap-2" aria-label={t("mapsearch.results")}>
          {results.map((result, i) => (
            <Button
              key={i}
              className="h-auto justify-start text-left whitespace-normal"
              variant="outline"
              onClick={() => select(result)}
            >
              {result.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
