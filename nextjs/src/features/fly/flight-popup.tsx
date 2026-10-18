import { type ReactNode } from "react";
import { useEffect } from "react";
import { type PopupCategory } from "~/data/flight-notification";
import { useFlightNotificationHistory } from "~/stores/flight-notifications";
import { useInFlight } from "~/stores/inflight";
import {
  ArrowUpDown,
  Info,
  Navigation,
  Radio,
  RadioTower,
  X,
} from "lucide-react";
import { useT } from "~/i18n/use-t";

export type { PopupCategory } from "~/data/flight-notification";
const icons = {
  heading: Navigation,
  altitude: ArrowUpDown,
  comms: Radio,
  frequency: RadioTower,
  system: Info,
};

/** Shared accessible presentation for every transient flight notification. */
export function FlightPopup({
  category,
  children,
  onDismiss,
  testId,
  notificationId,
  message,
  recordedAt,
}: {
  category: PopupCategory;
  children?: ReactNode;
  onDismiss: () => void;
  testId?: string;
  notificationId: string;
  message: string;
  recordedAt?: number;
}) {
  const t = useT();
  const session = useInFlight((s) => s.startedAt);
  useEffect(() => {
    useFlightNotificationHistory
      .getState()
      .record(session, {
        id: notificationId,
        category,
        message,
        createdAt: recordedAt ?? Date.now(),
      });
  }, [session, notificationId, category, message, recordedAt]);
  const Icon = icons[category];
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={t(`fly.popup.${category}`)}
      data-category={category}
      data-testid={testId}
      className="bg-card/95 text-card-foreground flex w-full items-start gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur sm:p-4"
    >
      <Icon
        className="text-primary mt-0.5 size-5 shrink-0"
        aria-hidden="true"
      />
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-primary text-[10px] font-bold tracking-wider uppercase">
          {t(`fly.popup.${category}`)}
        </span>
        <div className="text-sm leading-snug font-semibold break-words whitespace-pre-line">
          {children ?? message}
        </div>
      </div>
      <button
        type="button"
        aria-label={t("fly.popup.dismiss", {
          category: t(`fly.popup.${category}`),
        })}
        onClick={onDismiss}
        className="hover:bg-accent focus-visible:ring-ring -m-1 flex size-9 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
