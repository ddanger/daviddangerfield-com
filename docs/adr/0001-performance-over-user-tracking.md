# Performance over user tracking

This site exists partly to show that I build fast, well-maintained websites, so page performance outranks knowing what visitors do. I removed Google Analytics, and the site ships no third-party analytics, tracking, or embed scripts. Recruiters reach me through LinkedIn today, so visitor data wouldn't change any decision the site depends on.

## Considered options

- **Load Google Analytics on page load.** gtag.js is about 172 KB and landed in the mobile LCP window, competing with the fonts and costing about 1.9 s of simulated LCP.
- **Load it lazily, on first interaction or 3 s after load.** This protected LCP, but it still shipped 172 KB to every visitor. It also likely missed the most important click: a visitor whose first interaction is "Download Resume" triggers the load, but gtag isn't ready in time to record that click.

## Consequences

- There is no conversion data (resume downloads, schedule clicks). That's accepted.
- One exception: Cloudflare Web Analytics stays. Cloudflare injects it at the edge. It sets no cookies and loads after the page renders (about 10 KB). It gives rough visit counts with no measurable Lighthouse cost.
- Third-party embeds count as tracking scripts. The inline Calendly widget on /contact/ was removed under the same rule: it loaded 4.6 MB across 80 requests from 23 hosts (including ad and session-recording trackers) and dropped Lighthouse Best Practices to 77. Scheduling is a plain link to Calendly instead.
- Anything added later must keep every page at Lighthouse 95 or higher on mobile and must not load before first render. (Mobile scores vary a few points run to run from network simulation, so a single run in the mid 90s isn't a regression by itself.)
