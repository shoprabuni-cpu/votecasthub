# Search visibility launch

## Deploy

1. Apply `20261126100000_public_search_visibility.sql` with `npx supabase db push`, then deploy the application.
2. Confirm `NEXT_PUBLIC_SITE_URL` is the preferred production HTTPS origin, for example `https://www.votecasthub.com`. Redirect the alternative hostname to this one using Vercel domain settings. Canonical links, sharing links and sitemap URLs use this setting.
3. Open `/robots.txt`, `/sitemap.xml`, `/sitemaps/static.xml`, `/api/og`, `/guides` and `/pricing` on the deployed domain. The sitemap index automatically adds numbered files for public event and nominee pages, in batches of 1,000.
4. Check a published event and an active nominee: title, description, canonical link and social preview must describe that page. Drafts, pending reviews, archived/purged events, inactive nominees/categories, restricted organizations and pending deletions are excluded from search data. Private/account/payment/API pages carry `noindex` headers. Preview deployments are excluded from indexing.

The database supplies actual last-modified times for event and nominee URLs. Static pages omit the date rather than announcing a new edit on every crawl. Sitemap responses can be cached for five minutes; an unavailable database returns a retryable 503 instead of a misleading partial sitemap. Search metadata and social preview images use an anonymous Supabase client, never a logged-in organizer session or service key.

## Google Search Console

Your property is already submitted. In **Sitemaps**, submit `sitemap.xml` on the canonical domain. In **URL Inspection**, test the homepage, `/guides`, a guide, one public event and one nominee. Use **Test live URL**, confirm they are available to Google and then request indexing for important pages. Review **Page indexing**, **Performance**, and **Core Web Vitals** for real production problems.

Existing DNS verification can remain in place. If you use HTML meta-tag verification, put only Google's verification value in `GOOGLE_SITE_VERIFICATION` in Vercel and redeploy. Do not paste the complete meta tag.

## Bing Webmaster Tools

Open https://www.bing.com/webmasters/ and sign in with your account. Choose **Import from Google Search Console**, authorize it, select the VotecastHub property and import it. Confirm `sitemap.xml` is listed; submit it if needed. This account authorization must be completed by the site owner.

If importing is unavailable, add the canonical site manually. Select HTML meta-tag verification, copy only the `content` value from `msvalidate.01`, save it as `BING_SITE_VERIFICATION` in Vercel, deploy and click **Verify** in Bing. The application already renders the correct tag when that value exists. Never use the Resend key or another service credential as a verification value.

## Organizers and social presence

Published event dashboards contain a **Share your public event** panel with the public URL and copyable website link HTML. Ask organizers to place this link on their official websites. Event and nominee pages already provide public sharing tools and nominee flyers; the new guide `/guides/promote-your-event-and-nominees` explains how to use them and includes an announcement template.

Create official VotecastHub GH profiles on the social platforms you will maintain. Use the same name, logo and canonical website link. Publish useful setup advice and real event announcements; obtain permission before publishing organizer stories or nominee photos. Do not invent reviews, testimonials, partnerships or profile URLs. No accounts have been created or messages sent by this implementation.

## What to measure

Track Search Console/Bing impressions, clicks and queries, plus organizer registrations and actual event participation. Public event pages already record event views in the organizer analytics flow. Search Console measures search visibility separately. Check progress over several weeks rather than promising a ranking date or position.

Reference guidance:
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://www2.bing.com/webmasters/help/add-and-verify-site-12184f8b

The site includes Organization, WebSite and breadcrumb structured data. It does not label every voting window as an in-person Google Event: voting schedules do not establish a physical event venue, attendance or ticket offer. Structured data and sitemap submission do not guarantee a rich result or search ranking.
