# Figade SEO review — 2 October 2026

The practical opportunity is to become a dependable answer to specific file tasks,
then use Search Console to learn which of those tasks people already find you for.
This review is not a ranking forecast or a claim that every page is indexed.

## What was checked

The production output contains 30 HTML pages: 29 intended for indexing and a
noindex error page. All 29 have unique titles, descriptions and canonical URLs.
The sitemap lists those exact 29 canonical URLs, with no duplicates or error-page
entry. Every indexable page is reachable from the homepage through ordinary HTML
links. Related guidance and tool links are now visible below the main tool. No duplicate title or description
was found. These checks now run automatically alongside the tool tests.

The live homepage was inspected in a browser and has the correct canonical URL
and an indexable robots meta tag. Public search returned several Figade pages;
this is evidence of discoverability in that search service, not a complete Google
index report or a ranking measurement.

The source robots.txt allows crawling and declares the sitemap. This environment
could not retrieve live robots.txt/sitemap.xml or independently confirm HTTP,
www, .html and missing-page response/redirect status codes. Do not interpret
network restrictions here as evidence that Googlebot is blocked. Check those
URLs with Search Console URL Inspection and a normal HTTP client outside this
restricted environment. Cloudflare's production 404 behavior remains a check to
confirm; the local preview server returns an actual 404.

No Search Console metrics, manual-action report, backlink analysis, field Core
Web Vitals or Lighthouse/PageSpeed score was available. No scores or keyword
volumes are inferred.

## Local improvements prepared

- Added specific guidance to the 20KB, 50KB, 100KB and 200KB image pages: exact
  dimensions, small-text readability, format requirements and quality tradeoffs.
  These pages previously changed mostly the number while repeating the same text.
- Updated the 100KB guide to explain the real exact-dimensions option and linked
  directly to the relevant tool. No new keyword-targeted pages were created.
- Added a visible Tom byline linking to About on the five guides and matched it
  with the Article author URL. The author identity already existed in the site.
- Added regression checks for unique metadata, exact sitemap coverage, ordinary
  HTML link reachability and visible/structured authorship.

All 47 automated tests pass on the production build. These follow-up changes
are included in this release; GitHub commit history records publication.

## Priorities from here

1. Use the existing Search Console property. Confirm sitemap submission, inspect
   the homepage and the main image/video/converter pages, and review Page indexing,
   Manual actions and Security issues. “Crawled — currently not indexed” needs page
   inspection and context; it is not automatically a penalty or technical error.
2. Export Search results Performance for the last three months: Queries and Pages,
   with clicks, impressions, CTR and average position. Keep the search type and date
   range consistent. For a newer site, use all available history. Include the Page
   indexing report, and device/country breakdowns if useful. Exclude account details.
   We can prioritize pages with demonstrated demand instead of guessed volumes.
3. Start with a few distinct tasks: preparing a photo under 100KB with specific
   dimensions, fitting a video under a sharing limit, and converting MOV to MP4.
   These are candidate topics, not validated high-volume keywords. Add original
   examples from measured tests, including source/output size, dimensions, browser,
   sound outcome and limitations. Existing synthetic smoke tests are too limited
   to support broad quality or browser compatibility claims.
4. Strengthen existing guides only when they answer a real question. Prefer useful
   examples, relevant tool links and clear explanations over extra paragraphs.
   The interactive tool itself is valuable main content; articles need not be padded
   to an arbitrary word count. The image-page additions are an initial improvement,
   not proof those pages will outperform competitors.
5. Keep app limits sourced and dated. Use the official service documentation when
   updating a limit. This sweep did not re-verify Discord/email/WhatsApp limits.
   Existing sitemap dates come from source-file git history; shared template/data
   updates can make those dates less representative of the rendered page. Track
   substantive content updates honestly rather than stamping every rebuild “today.”
6. Check real mobile usability and field performance. The current functional tests
   do not establish Core Web Vitals or visual quality on all devices. Good scores
   support the experience; they are not a ranking guarantee.
7. Earn relevant mentions by sharing a useful, demonstrable tool in communities
   where it solves a problem. Avoid bought links, mass directory submissions and
   repeated near-identical landing pages. Monitor impressions and successful tool
   use before adding more features or pages.

## Structured data

The existing FAQPage JSON-LD is present on 18 tool pages. Google retired FAQ rich
results from May 7, 2026 and removed the documentation in June. The markup is not
an SEO growth mechanism. It has not been removed as if it were a penalty; the
visible answers remain useful. No invented ratings, reviews, awards or performance
claims were added. The guides have Article markup; its author now links to About.

## Primary references

- Google helpful-content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Sitemap and lastmod guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Canonical URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Article author guidance: https://developers.google.com/search/docs/appearance/structured-data/article
- FAQ retirement, May/June 2026 entries: https://developers.google.com/search/updates
- Titles: https://developers.google.com/search/docs/appearance/title-link

Next useful input: the Search Console exports above. They will let us distinguish
technical indexing problems from content opportunities and insufficient demand.
