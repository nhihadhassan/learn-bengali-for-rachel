"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function OfflineIndicator() {
  // Assume online during SSR / first paint so the banner never flashes on load.
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    function update() {
      setIsOffline(!navigator.onLine);
    }

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-soft-rise fixed inset-x-0 top-2 z-50 mx-auto flex w-fit max-w-[92%] items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-sm font-black text-amber-900 shadow-[0_10px_30px_rgba(15,23,42,0.15)] backdrop-blur dark:border-amber-300/25 dark:bg-amber-400/15 dark:text-amber-100"
    >
      <CloudOff size={16} />
      Offline — your saved lessons still work
    </div>
  );
}
