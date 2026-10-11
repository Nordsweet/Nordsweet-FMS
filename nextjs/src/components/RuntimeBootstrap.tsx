"use client";

import { useEffect, useState } from "react";

import { type PageId } from "~/pages";
import { engines } from "~/runtime/loaders";

declare global {
  interface Window {
    __nordsweetBoots?: Partial<Record<PageId, Promise<void>>>;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string) {
  const url = new URL(src, location.href).href;
  let pending = scripts.get(url);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Cannot load " + src));
      document.head.appendChild(script);
    });
    scripts.set(url, pending);
  }
  return pending;
}

export default function RuntimeBootstrap({
  page,
  bodyClass = "",
  bodyStyle = "",
}: {
  page: PageId;
  bodyClass?: string;
  bodyStyle?: string;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    document.body.className = bodyClass;
    if (bodyStyle) document.body.setAttribute("style", bodyStyle);
    // Each existing tool uses document-level events. Navigation between tools is a full
    // document navigation, so one initialization per document also handles Strict Mode.
    const boots = (window.__nordsweetBoots ??= {});
    const boot = (boots[page] ??= engines[page]()
      .then((engine) => engine.start(loadScript))
      .then(() => {
        document.documentElement.dataset.nordsweetReady = page;
      }));
    let active = true;
    boot.catch((e: unknown) => {
      console.error(e);
      if (active)
        setError("Nie udało się uruchomić aplikacji. Odśwież stronę.");
    });
    return () => {
      active = false;
    };
  }, [page, bodyClass, bodyStyle]);
  return error ? (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100000,
        padding: 16,
        background: "#8b2020",
        color: "white",
      }}
    >
      {error}
    </div>
  ) : null;
}
