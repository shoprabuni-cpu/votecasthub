import Link from "next/link";

export default function NotFound() {
  return <main className="failure-page"><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page isn’t here.</h1><p>The link may be old or the event may have been removed.</p><Link className="primary-link" href="/">Return home</Link></main>;
}
