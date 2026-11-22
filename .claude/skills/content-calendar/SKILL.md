---
name: content-calendar
description: Plan a posting calendar (week or month) for a brand across platforms, balanced across content pillars and formats, optionally producing the assets. Use for "content plan", "calendar", "what should I post this month".
argument-hint: <brand-slug> [period, e.g. "December" or "next 2 weeks"] [posts per week]
---

# Content calendar

1. Load brand.json (pillars, platforms, products, audience). Ask for anything date-specific: launches, sales, holidays, events.
2. Decide cadence (default: 4 posts/week — 2 reels, 1 carousel, 1 post/story set).
3. Balance: rotate pillars evenly; ≤ 1 in 4 posts directly sells; put promos near the relevant dates.
4. Write `projects/<slug>/calendars/<period>.md` as a table: date · platform · format · pillar · working title · hook · CTA · status.
5. Offer to batch-produce: for each row run `/short-video` or `/static-post`. Produce the first week, show it, then continue.
