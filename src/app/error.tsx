"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page rendering failed", { digest: error.digest });
  }, [error.digest]);

  return <main className="failure-page"><p className="eyebrow">PAGE UNAVAILABLE</p><h1>We couldn’t load this page.</h1><p>Please try again. Your information has not been submitted.</p><button className="primary-link" onClick={reset}>Try again</button></main>;
}

