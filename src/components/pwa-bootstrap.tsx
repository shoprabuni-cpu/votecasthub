"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaBootstrap() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
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

  if (installed) return null;
  return <div className="pwa-install-control"><button type="button" className="pwa-install-button" onClick={installApp}>{prompt ? "Install app" : "Use as an app"}</button>{help && <div className="pwa-install-help" role="status"><button type="button" aria-label="Close install instructions" onClick={() => setHelp(false)}>×</button><strong>Add VotecastHub to your home screen</strong><p>In your browser menu, choose <b>Install app</b> or <b>Add to Home Screen</b>.</p></div>}</div>;
}
