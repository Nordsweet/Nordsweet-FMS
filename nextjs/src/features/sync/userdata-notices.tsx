"use client";

import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useT } from "~/i18n/use-t";
import { type MessageKey } from "~/i18n/messages";
import { type Notice, useUserDataStatus } from "~/stores/userdata-status";

const logKeys: Record<number, MessageKey> = {
  409: "userdata.notice.log.409",
  413: "userdata.notice.log.413",
  422: "userdata.notice.log.422",
};

function useNoticeText() {
  const t = useT();
  return (notice: Notice) => {
    if (notice.kind === "mth_decreased")
      return notice.previousMth === null
        ? t("userdata.notice.mthUnknown", { airframe: notice.airframe })
        : t("userdata.notice.mth", {
            airframe: notice.airframe,
            previous: notice.previousMth.toFixed(2),
          });
    return t(logKeys[notice.status] ?? "userdata.notice.log.other", {
      status: notice.status,
      detail: notice.detail,
    });
  };
}

/**
 * What the typed user-data sync wants the pilot to know: items the first-sign-in import was
 * refused, an MTH below the previous reading, a flight log the server will never take.
 */
export function UserDataNotices() {
  const t = useT();
  const text = useNoticeText();
  const importRejected = useUserDataStatus((s) => s.importRejected);
  const setImportRejected = useUserDataStatus((s) => s.setImportRejected);
  const notices = useUserDataStatus((s) => s.notices);
  const dismiss = useUserDataStatus((s) => s.dismissNotice);
  return (
    <>
      <Dialog
        open={importRejected.length > 0}
        onOpenChange={(open) => !open && setImportRejected([])}
      >
        <DialogContent data-testid="import-rejected" className="max-w-lg">
          <DialogTitle>{t("userdata.import.title")}</DialogTitle>
          <DialogDescription>{t("userdata.import.body")}</DialogDescription>
          <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm">
            {importRejected.map((line) => (
              <li key={line} className="font-mono break-words">
                {line}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={() => setImportRejected([])}>
              {t("userdata.dismiss")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {notices.length > 0 && (
        <div className="fixed right-3 bottom-3 z-40 grid w-[min(24rem,calc(100vw-1.5rem))] gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              role="status"
              data-testid="userdata-notice"
              className="bg-popover text-popover-foreground flex items-start gap-2 rounded-2xl border border-amber-400/60 p-3 text-sm shadow-lg"
            >
              <p className="flex-1">{text(notice)}</p>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("userdata.dismiss")}
                onClick={() => dismiss(notice.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
