# signature-lab

A tiny Cloudflare Worker that powers three live email-signature badges — and a writeup on what changes when signatures stop being static.

```
\o/  I'M LISTENING TO
     GDS.FM
     Zürichs Radio gegen den Strom
     ● Boards of Canada — Pete Standing Alone
```

Three demos, one Worker, ~300 lines:

- **GDS.FM now-playing** — what's spinning on Zürich's underground radio (Airtime API)
- **Hacker News top story** — what's at the top of the front page (RSS)
- **FIFA World Cup latest results** — last three matches of the 2026 tournament (TheSportsDB)

The point isn't the radio, the news, or the football. The point is that a signature used to be a static artifact, and now it doesn't have to be. The pattern (context source → compute → render target) generalises to anything live: your Confluence newsroom, your team's GitHub releases, your customer success story of the week. See the [writeup](https://lab.bridge-work.ai) for that part.

→ **Live writeup:** [lab.bridge-work.ai](https://lab.bridge-work.ai)
→ **Radio share page:** [gds.bridge-work.ai](https://gds.bridge-work.ai)
→ **API root:** `go.bridge-work.ai`

## Live endpoints

| Path | What |
|---|---|
| `/gds.svg` · `/gds.json` · `/gds` | radio now-playing |
| `/news.svg` · `/news.json` · `/news` | Hacker News top story |
| `/worldcup.svg` · `/worldcup.json` · `/worldcup` | FIFA WC 2026 last 3 results |

The `.svg` endpoints render a live badge. `.json` returns the parsed source data (CORS-enabled). The bare path is a 302 redirect to the source, with the click logged.

All `.svg` endpoints accept `?style=pill` for a compact variant, and `?u=YOU` to tag clicks.

## Repo layout

```
signature-lab/
├── worker/                  Cloudflare Worker (the 3 routes)
│   ├── worker.js
│   ├── wrangler.toml
│   └── package.json
├── sites/
│   ├── lab/                 lab.bridge-work.ai (the writeup)
│   │   └── index.html
│   └── gds/                 gds.bridge-work.ai (radio share page)
│       └── index.html
├── SETUP.md                 deploy steps
├── LICENSE
└── README.md
```

Two Cloudflare Pages projects, one Worker, one GitHub repo. See [SETUP.md](./SETUP.md) for the deploy walk-through.

## Use the badges yourself

Drop into an email signature, GitHub profile, Notion, anywhere `<img>` renders:

```html
<a href="https://go.bridge-work.ai/gds?u=YOU">
  <img src="https://go.bridge-work.ai/gds.svg?u=YOU"
       alt="I'm listening to GDS.FM" width="540" height="120">
</a>
```

Markdown for READMEs:

```md
[![GDS.FM](https://go.bridge-work.ai/gds.svg?u=YOU)](https://go.bridge-work.ai/gds?u=YOU)
[![Hacker News](https://go.bridge-work.ai/news.svg?u=YOU)](https://go.bridge-work.ai/news?u=YOU)
[![World Cup](https://go.bridge-work.ai/worldcup.svg?u=YOU)](https://go.bridge-work.ai/worldcup?u=YOU)
```

Replace `YOU` with your handle so clicks tag correctly.

## Run your own

The Worker is one file, ~300 lines, three demo routes. Fork, point the source URLs at anything that returns JSON or RSS, and you have a live badge for that thing.

```bash
git clone https://github.com/blackmath88/signature-lab
cd signature-lab/worker
npm install -g wrangler
wrangler login
wrangler deploy
```

## The challenge

The three built versions are static — same data for everyone who opens your email. The interesting version is per-recipient: the badge changes based on who's reading. World Cup is the demo example; the same shape works for regulatory citations per jurisdiction, customer case studies per industry, language per recipient, sales evidence per pipeline stage.

That's a 2–3 day build inside an M365 tenant. Components: Outlook Web Add-in (`OnMessageSend` event), Copilot Studio or Azure Function for orchestration, Microsoft Graph for recipient context, Azure OpenAI for generation, App Insights for audit. Architecture is in the [writeup](https://lab.bridge-work.ai).

**If you ship a working tenant deployment, tag me. The first one I see gets a writeup on bridge-work.ai/lab.**

## License

MIT. Take it, run it, change it, ship it.

## Credits

- [GDS.FM](https://gds.fm) — Zürich's radio gegen den Strom. Support them.
- [Airtime Pro](https://www.airtime.pro) — for the public now-playing API.
- [TheSportsDB](https://www.thesportsdb.com) — for the free sports API.
- Cloudflare — for free Workers, Pages, and Analytics Engine.
- Built at [bridge-work.ai](https://bridge-work.ai).
