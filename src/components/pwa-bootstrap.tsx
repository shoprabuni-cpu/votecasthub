"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function subscribeToDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => { query.removeEventListener("change", onChange); window.removeEventListener("appinstalled", onChange); };
}
const serverStandalone = () => false;

export function PwaBootstrap() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, serverStandalone);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", install); window.removeEventListener("appinstalled", done); };
  }, []);

  async function installApp() {
    if (!prompt) { setHelp(value => !value); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  if (installed || standalone) return null;
  return (
    <div className="fixed bottom-4 left-4 z-30">
      <button
        type="button"
        className="cursor-pointer rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-md transition hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-emerald-400 dark:hover:bg-stone-800"
        onClick={installApp}
      >
        {prompt ? "Install app" : "Use as an app"}
      </button>
      {help && (
        <div className="absolute bottom-12 left-0 w-[min(285px,calc(100vw-32px))] rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed shadow-xl dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200" role="status">
          <button
            type="button"
            aria-label="Close install instructions"
            className="absolute top-1.5 right-2 border-0 bg-transparent text-xl cursor-pointer text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            onClick={() => setHelp(false)}
          >
            ×
          </button>
          <strong className="block font-semibold text-stone-900 dark:text-white mb-1">Add VotecastHub to your home screen</strong>
          <p>In your browser menu, choose <b>Install app</b> or <b>Add to Home Screen</b>.</p>
        </div>
      )}
    </div>
  );
}
