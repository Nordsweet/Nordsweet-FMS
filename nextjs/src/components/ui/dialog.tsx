"use client";

import * as React from "react";
import { cn } from "cn";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-open:animate-in data-open:fade-in-0 fixed inset-0 z-50 bg-black/50 supports-backdrop-filter:backdrop-blur-xs" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 fixed top-1/2 left-1/2 z-50 grid max-h-[90dvh] w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[20px] border p-5 shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-primary pr-10 text-base font-semibold tracking-[0.06em] uppercase",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * Non-modal panel over a live page (map tools): Escape closes it and focus returns, but there is
 * no overlay, it stays where the caller positions it, and clicks outside leave it open.
 * Name it with a `DialogPanelTitle`.
 */
function DialogPanel({
  onClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Content
        aria-describedby={undefined}
        onInteractOutside={(event) => event.preventDefault()}
        {...props}
      />
    </DialogPrimitive.Root>
  );
}

const DialogPanelTitle = DialogPrimitive.Title;

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogPanel,
  DialogPanelTitle,
  DialogTitle,
};
