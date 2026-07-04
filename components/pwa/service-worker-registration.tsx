"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production. Renders nothing and is a
 * no-op where service workers are unsupported.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing should never break the app.
    });
  }, []);

  return null;
}
