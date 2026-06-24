# Setup — step by step

Goal: deploy the Worker to `go.bridge-work.ai` and the two sites to `lab.bridge-work.ai` and `gds.bridge-work.ai`. All from this one repo.

---

## 0. Sanity check (one minute)

Confirm the upstream APIs are alive before you deploy anything pointed at them.

```bash
# GDS.FM now-playing — should return JSON with a track name
curl -s https://gdsfm.airtime.pro/api/live-info-v2 | head -200

# Hacker News RSS — should return XML
curl -sI https://news.ycombinator.com/rss

# TheSportsDB World Cup — should return events
curl -s "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4429" | head -200
```

If GDS returns HTML or an error, their public API is disabled on the station — ask the GDS team to enable it (Airtime → Settings → Preferences → "Public Airtime API"). Without it, the radio badge can't show live tracks.

---

## 1. Deploy the Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

First deploy gives you a `*.workers.dev` URL. Test all nine routes:

```bash
# Replace with your actual workers.dev subdomain
BASE=https://signature-lab.YOUR_SUBDOMAIN.workers.dev

curl -I $BASE/gds          # expect 302 → gds.fm
curl    $BASE/gds.json     # expect track JSON
curl    $BASE/gds.svg      # expect SVG with current track

curl -I $BASE/news         # expect 302 → top HN story
curl    $BASE/news.json    # expect items array
curl    $BASE/news.svg     # expect SVG with HN top

curl -I $BASE/worldcup     # expect 302 → fifa.com
curl    $BASE/worldcup.json
curl    $BASE/worldcup.svg
```

Save the SVGs to disk and open them to verify they render with live data.

---

## 2. Worker custom domain

Cloudflare dashboard → **Workers & Pages** → **signature-lab** → **Triggers** → **Custom Domains** → **Add**.

Enter `go.bridge-work.ai`. Cloudflare auto-configures DNS since bridge-work.ai is on Cloudflare. Wait ~1 minute, then re-test:

```bash
curl -I https://go.bridge-work.ai/gds
```

---

## 3. Analytics Engine binding

Dashboard → **Workers & Pages** → **signature-lab** → **Settings** → **Bindings** → **Add binding** → **Analytics Engine**.

- Variable name: `GDS_CLICKS`
- Dataset: `signature_clicks`

Redeploy to pick up the binding:

```bash
cd worker && npx wrangler deploy
```

Click a few test links, then check in dashboard → **Workers & Pages** → **signature-lab** → **Metrics** → **Analytics Engine** tab. Takes a few minutes for first writes to surface.

To query the dataset (via Cloudflare's SQL API):

```sql
SELECT
  blob1 AS supporter,
  blob5 AS country,
  blob8 AS source,
  COUNT() AS clicks
FROM signature_clicks
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob1, blob5, blob8
ORDER BY clicks DESC
```

---

## 4. Deploy the writeup → lab.bridge-work.ai

Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** → select `blackmath88/signature-lab`.

Build configuration:

| Setting | Value |
|---|---|
| Project name | `signature-lab-lab` |
| Production branch | `main` |
| Build command | *(leave empty)* |
| Build output directory | `sites/lab` |
| Root directory | *(leave empty)* |

Click **Save and Deploy**. First deploy gives you `signature-lab-lab.pages.dev`.

Then **Custom domains** → **Set up a custom domain** → enter `lab.bridge-work.ai`. Cloudflare auto-configures DNS. ~1 minute.

---

## 5. Deploy the radio share page → gds.bridge-work.ai

Same flow, second project from the same repo:

Cloudflare dashboard → **Create application** → **Pages** → **Connect to Git** → select `blackmath88/signature-lab`.

| Setting | Value |
|---|---|
| Project name | `signature-lab-gds` |
| Production branch | `main` |
| Build command | *(leave empty)* |
| Build output directory | `sites/gds` |

**Custom domains** → enter `gds.bridge-work.ai`.

---

## 6. Verify everything end-to-end

```bash
# Worker routes
curl -I https://go.bridge-work.ai/gds
curl -I https://go.bridge-work.ai/news
curl -I https://go.bridge-work.ai/worldcup

# Pages sites
curl -I https://lab.bridge-work.ai
curl -I https://gds.bridge-work.ai
```

All should return `200` or `302` (the `/gds`, `/news`, `/worldcup` redirects).

Visit each page in a browser. The badges should show current data:
- `lab.bridge-work.ai` — all three badges, live
- `gds.bridge-work.ai` — just the GDS badge, big, with copy buttons

---

## 7. Add the badge to your mail signature

For Gmail:
- Settings → See all settings → Signature → Create new
- Paste the HTML snippet from `gds.bridge-work.ai` (use "Copy" on the page)
- Test by emailing yourself

For Outlook (Mac/Windows):
- Settings → Signatures → +
- Paste, save
- Note: Outlook desktop blocks remote images by default for unknown senders. For internal threads it'll load fine.

For Apple Mail:
- Mail → Settings → Signatures
- Variant: the static B/W card without live data is safer here (Apple Mail can strip styles on paste of complex HTML)

---

## 8. Ship the LinkedIn post

The post draft lives in your notes; the explainer at `lab.bridge-work.ai` is where it links. Screenshot the live badges (especially the World Cup one with current results) and use that as the post image.

Suggested timing: ship before Wednesday evening Zürich time to ride the World Cup group stage. After the round of 16 ends, the timing weakens.

---

## Routine maintenance

- **GDS API goes down occasionally.** The Worker falls back to "Live broadcast" — graceful. No action needed unless extended outage.
- **TheSportsDB rate limits.** Free tier is generous but not infinite. The Worker caches 10 minutes; should be fine for normal use.
- **Hacker News RSS** is bulletproof; if it ever breaks, it's the end of the internet anyway.

To update copy on either site: edit the HTML, push to main, Cloudflare Pages auto-deploys. ~30 seconds.

To add a fourth source: copy one of the three route blocks in `worker/worker.js`, swap the URL and parser, add cases to the router. ~30 lines.

---

## Realistic ship-ready time

- Steps 1–3 (Worker): 25 minutes
- Steps 4–5 (Pages): 10 minutes
- Step 6 (verify): 5 minutes
- Step 7 (signature): 15 minutes per mail client
- Step 8 (post): when you're ready

**Same evening doable.**
