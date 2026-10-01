"use client";

import "./globals.css";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application rendering failed", { digest: error.digest });
  }, [error.digest]);

  return (
    <html lang="en-GH"><body>
      <main className="failure-page">
        <p className="eyebrow">TEMPORARILY UNAVAILABLE</p>
        <h1>Something went wrong.</h1>
        <p>We could not confirm whether your last action completed. Check its status before trying again.</p>
        <button className="primary-link" onClick={reset}>Try again</button>
      </main>
    </body></html>
  );
}

