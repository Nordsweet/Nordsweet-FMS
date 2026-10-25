"use client";
import { Info } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { RADIO_GREETINGS, radioLanguage } from "~/domain/radio-language";
import { useT } from "~/i18n/use-t";

/** A compact, touch/keyboard accessible greeting guide beside a foreign radio service. */
export function RadioLanguageInfo({
  station,
  context,
  sector,
}: {
  station: string;
  context?: string;
  sector?: string | null;
}) {
  const t = useT();
  const language = radioLanguage(context, station, sector);
  if (!language) return null;
  const label = t("fly.comms.languageInfo", {
    station: station || (context ?? ""),
  });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-primary"
          aria-label={label}
          title={label}
        >
          <Info className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        className="max-h-[min(28rem,80dvh)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto text-sm"
      >
        <h4 className="text-primary font-semibold">
          {t(`fly.comms.guide.${language}`)}
        </h4>
        <p className="text-muted-foreground text-xs">{station || context}</p>
        <dl className="grid gap-3 border-t pt-3">
          {(["greeting", "thanks", "goodbye", "hearYou"] as const)
            .filter((key) => RADIO_GREETINGS[language][key])
            .map((key) => (
              <div key={key}>
                <dt className="text-muted-foreground text-xs">
                  {t(`fly.comms.${key}`)}
                </dt>
                <dd>
                  <strong lang={language}>
                    {RADIO_GREETINGS[language][key]}
                  </strong>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {t(`fly.comms.${language}.${key}Pronunciation`)}
                  </span>
                </dd>
              </div>
            ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
