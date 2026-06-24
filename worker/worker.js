// worker.js — bridge-work live-signature demos
//
// Pattern: context source → compute layer → render target. Same shape, three sources.
//
//   /gds.*       music (Airtime now-playing API)
//   /news.*      Hacker News (RSS top story)
//   /worldcup.*  FIFA World Cup 2026 (TheSportsDB last 3 results)
//
// Deploy: wrangler deploy. Bind Analytics Engine dataset "gds_clicks" as GDS_CLICKS.

const AIRTIME    = "https://gdsfm.airtime.pro/api/live-info-v2";
const HN_RSS     = "https://news.ycombinator.com/rss";
const TSDB_WC    = "https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4429"; // FIFA WC

const CACHE_GDS  = 25;    // tracks change in minutes
const CACHE_NEWS = 300;   // HN front page churns slowly
const CACHE_WC   = 600;   // results don't change fast

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/$/, "");

    switch (p) {
      case "/gds":           return handleGdsRedirect(request, env, url);
      case "/gds.json":      return handleGdsJson();
      case "/gds.svg":       return handleGdsSvg(url);
      case "/news":          return handleNewsRedirect(request, env, url);
      case "/news.json":     return handleNewsJson();
      case "/news.svg":      return handleNewsSvg(url);
      case "/worldcup":      return handleWcRedirect(request, env, url);
      case "/worldcup.json": return handleWcJson();
      case "/worldcup.svg":  return handleWcSvg(url);
    }
    return new Response("not found", { status: 404 });
  },
};

// ════════════════════════════ GDS.FM ════════════════════════════

async function handleGdsRedirect(request, env, url) {
  logClick(env, request, url, "gds");
  return Response.redirect("https://gds.fm/", 302);
}
async function handleGdsJson() {
  const data = await fetchJson(AIRTIME, CACHE_GDS);
  return jsonResponse(data, CACHE_GDS);
}
async function handleGdsSvg(url) {
  const style = (url.searchParams.get("style") || "card").toLowerCase();
  const np = await fetchJson(AIRTIME, CACHE_GDS);
  const { artist, title } = parseGdsTrack(np);
  const trackLine = (artist && title) ? `${clip(artist, 28)} \u2014 ${clip(title, 36)}` : (clip(title, 60) || "Live broadcast");
  const svg = renderCard({
    mark: "\\o/",
    eyebrow: "I'M LISTENING TO",
    big: "GDS.FM",
    tagline: "Zurichs Radio gegen den Strom \u00b7 tune in \u2192",
    liveLine: trackLine,
    style,
  });
  return svgResponse(svg, CACHE_GDS);
}
function parseGdsTrack(np) {
  const currentName = np?.tracks?.current?.name || "";
  let artist = "", title = "";
  if (currentName.includes(" - ")) {
    const i = currentName.indexOf(" - ");
    artist = currentName.slice(0, i).trim();
    title  = currentName.slice(i + 3).trim();
  } else {
    title = currentName.trim();
  }
  return { artist, title };
}

// ════════════════════════════ Hacker News ════════════════════════════

async function handleNewsRedirect(request, env, url) {
  logClick(env, request, url, "news");
  const top = (await fetchHnItems(1))[0] || { link: "https://news.ycombinator.com/" };
  return Response.redirect(top.link, 302);
}
async function handleNewsJson() {
  const items = await fetchHnItems(5);
  return jsonResponse({ items }, CACHE_NEWS);
}
async function handleNewsSvg(url) {
  const style = (url.searchParams.get("style") || "card").toLowerCase();
  const top = (await fetchHnItems(1))[0] || { title: "" };
  const svg = renderCard({
    mark: "HN",
    eyebrow: "I'M READING",
    big: "HACKER NEWS",
    tagline: "Top of the front page \u00b7 read it \u2192",
    liveLine: clip(top.title || "front page", 64),
    style,
  });
  return svgResponse(svg, CACHE_NEWS);
}
async function fetchHnItems(n) {
  try {
    const res = await fetch(HN_RSS, { cf: { cacheTtl: CACHE_NEWS, cacheEverything: true }, headers: { "user-agent": "bridge-work-go/1.0" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) && items.length < n) {
      const block = m[1];
      const title = pickXml(block, "title");
      const link  = pickXml(block, "link");
      if (title) items.push({ title: decodeEntities(title), link });
    }
    return items;
  } catch { return []; }
}
function pickXml(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
}

// ════════════════════════════ World Cup ════════════════════════════
// Same pattern, third source. THIS is the static version: same 3 results for everyone.
// The PER-RECIPIENT version (Hopp Schwiiz to a Swiss, Forza Italia to an Italian) is the
// challenge thrown to the M365/Copilot community. See explainer.

async function handleWcRedirect(request, env, url) {
  logClick(env, request, url, "worldcup");
  return Response.redirect("https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026", 302);
}
async function handleWcJson() {
  const results = await fetchWcResults(5);
  return jsonResponse({ results }, CACHE_WC);
}
async function handleWcSvg(url) {
  const style = (url.searchParams.get("style") || "card").toLowerCase();
  const results = await fetchWcResults(3);
  if (style === "pill") {
    // Pill: just show the most recent result
    const top = results[0];
    const line = top ? `${top.home} ${top.homeScore}\u2013${top.awayScore} ${top.away}` : "Live tournament";
    const svg = renderCard({
      mark: "WC",
      eyebrow: "I'M FOLLOWING",
      big: "WORLD CUP",
      tagline: "Latest result",
      liveLine: line,
      style,
    });
    return svgResponse(svg, CACHE_WC);
  }
  const svg = renderWorldCupCard(results);
  return svgResponse(svg, CACHE_WC);
}

async function fetchWcResults(n) {
  const data = await fetchJson(TSDB_WC, CACHE_WC);
  const events = data?.events || [];
  const finished = events
    .filter(e => e && e.intHomeScore !== null && e.intHomeScore !== "" && e.intAwayScore !== null && e.intAwayScore !== "")
    .reverse(); // TheSportsDB returns oldest→newest; we want newest first
  return finished.slice(0, n).map(e => ({
    home: abbrev(e.strHomeTeam),
    away: abbrev(e.strAwayTeam),
    homeName: e.strHomeTeam,
    awayName: e.strAwayTeam,
    homeScore: String(e.intHomeScore).trim(),
    awayScore: String(e.intAwayScore).trim(),
    date: e.dateEvent || "",
  }));
}

// FIFA 3-letter codes for 2026 WC participants (best-effort; falls back to first 3 chars)
const ABBREV = {
  "Argentina":"ARG","Australia":"AUS","Austria":"AUT","Belgium":"BEL","Bosnia and Herzegovina":"BIH",
  "Brazil":"BRA","Canada":"CAN","Cape Verde":"CPV","Colombia":"COL","Congo DR":"COD","Croatia":"CRO",
  "Curacao":"CUW","Czechia":"CZE","Denmark":"DEN","Ecuador":"ECU","Egypt":"EGY","England":"ENG",
  "France":"FRA","Germany":"GER","Ghana":"GHA","Haiti":"HAI","Iran":"IRN","Iraq":"IRQ","Italy":"ITA",
  "Ivory Coast":"CIV","Japan":"JPN","Jordan":"JOR","Korea Republic":"KOR","Mexico":"MEX","Morocco":"MAR",
  "Netherlands":"NED","New Zealand":"NZL","Norway":"NOR","Panama":"PAN","Paraguay":"PAR","Portugal":"POR",
  "Qatar":"QAT","Saudi Arabia":"KSA","Scotland":"SCO","Senegal":"SEN","South Africa":"RSA","Spain":"ESP",
  "Sweden":"SWE","Switzerland":"SUI","Tunisia":"TUN","United States":"USA","Uruguay":"URU","Uzbekistan":"UZB",
  "Algeria":"ALG","Wales":"WAL","Turkey":"TUR","Greece":"GRE",
};
function abbrev(name) {
  if (!name) return "???";
  if (ABBREV[name]) return ABBREV[name];
  return name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "???";
}

function renderWorldCupCard(results) {
  const W = 540, H = 178;
  const rows = results.length || 0;
  const startY = 118;
  const rowH = 18;

  let scoreLines = "";
  if (rows === 0) {
    scoreLines = `<text x="104" y="${startY + 14}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" fill="#000">No completed matches yet. Tournament starting.</text>`;
  } else {
    for (let i = 0; i < rows; i++) {
      const r = results[i];
      const y = startY + i * rowH;
      const score = `${r.homeScore}\u2013${r.awayScore}`;
      // Layout: dot · HOME · score · AWAY · date
      scoreLines += `
  <circle cx="110" cy="${y - 3}" r="2.5" fill="#FF3B30"${i === 0 ? `><animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></circle>` : `/>`}
  <text x="120" y="${y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#000">${esc(r.home)}</text>
  <text x="170" y="${y}" font-family="SF Mono, Menlo, Consolas, monospace" font-size="12" font-weight="700" fill="#000">${esc(score)}</text>
  <text x="210" y="${y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#000">${esc(r.away)}</text>
  <text x="${W - 22}" y="${y}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10" fill="#5a5651" text-anchor="end">${esc(r.date)}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="I'm following the FIFA World Cup. Latest results listed.">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="16" y="22" width="68" height="68" fill="none" stroke="#000" stroke-width="2.5"/>
  <text x="50" y="68" font-family="SF Mono, Menlo, Consolas, monospace" font-size="22" font-weight="700" fill="#000" text-anchor="middle">WC</text>
  <text x="104" y="40" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10" letter-spacing="1.6" fill="#000">I'M FOLLOWING</text>
  <text x="104" y="70" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="-0.5" fill="#000">WORLD CUP 2026</text>
  <text x="104" y="88" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" fill="#000">Canada \u00b7 Mexico \u00b7 USA \u00b7 last 3 results</text>
  <line x1="104" y1="98" x2="${W - 20}" y2="98" stroke="#000" stroke-width="0.5"/>
  ${scoreLines}
</svg>`;
}

// ════════════════════════════ shared card renderer (gds + hn) ════════════════════════════

function renderCard({ mark, eyebrow, big, tagline, liveLine, style }) {
  if (style === "pill") return renderPill({ mark, big, liveLine });
  const W = 540, H = 120;
  const markFont = mark.length <= 2 ? 24 : 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(eyebrow)} ${esc(big)}: ${esc(liveLine)}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="16" y="22" width="68" height="68" fill="none" stroke="#000" stroke-width="2.5"/>
  <text x="50" y="68" font-family="SF Mono, Menlo, Consolas, monospace" font-size="${markFont}" font-weight="700" fill="#000" text-anchor="middle">${esc(mark)}</text>
  <text x="104" y="40" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="10" letter-spacing="1.6" fill="#000">${esc(eyebrow)}</text>
  <text x="104" y="70" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${big.length > 8 ? 24 : 30}" font-weight="900" letter-spacing="-0.5" fill="#000">${esc(big)}</text>
  <text x="104" y="88" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" fill="#000">${esc(tagline)}</text>
  <line x1="104" y1="98" x2="${W - 20}" y2="98" stroke="#000" stroke-width="0.5"/>
  <circle cx="110" cy="108" r="3" fill="#FF3B30"><animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></circle>
  <text x="120" y="111" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#000">${esc(liveLine)}</text>
</svg>`;
}

function renderPill({ mark, big, liveLine }) {
  const W = 500, H = 34;
  const labelWidth = 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(big)}: ${esc(liveLine)}">
  <rect x="0" y="0" width="${labelWidth}" height="${H}" fill="#000"/>
  <rect x="${labelWidth}" y="0" width="${W - labelWidth}" height="${H}" fill="#fff" stroke="#000" stroke-width="1"/>
  <text x="14" y="22" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="900" font-size="13" fill="#fff">${esc(mark)} &#160;${esc(big)}</text>
  <circle cx="${labelWidth + 14}" cy="17" r="3" fill="#FF3B30"><animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></circle>
  <text x="${labelWidth + 26}" y="22" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="12" fill="#000" font-weight="500">${esc(clip(liveLine, 48))}</text>
</svg>`;
}

// ════════════════════════════ helpers ════════════════════════════

async function fetchJson(url, ttl) {
  try {
    const res = await fetch(url, { cf: { cacheTtl: ttl, cacheEverything: true }, headers: { "user-agent": "bridge-work-go/1.0" } });
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}
function jsonResponse(data, ttl) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${ttl}`,
    },
  });
}
function svgResponse(svg, ttl) {
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": `public, max-age=${ttl}, s-maxage=${ttl}`,
    },
  });
}
function logClick(env, request, url, kind) {
  if (!env.GDS_CLICKS) return;
  const supporter = (url.searchParams.get("u") || "anon").slice(0, 32);
  const variant   = (url.searchParams.get("v") || "x").slice(0, 4);
  const referer   = request.headers.get("referer") || "";
  const ua        = request.headers.get("user-agent") || "";
  env.GDS_CLICKS.writeDataPoint({
    blobs:   [supporter, variant, referer, refererHost(referer), request.cf?.country || "??", request.cf?.city || "", uaFamily(ua), kind],
    doubles: [1],
    indexes: [supporter],
  });
}
function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clip(s, n) {
  s = (s || "").trim();
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}
function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function refererHost(r) { try { return new URL(r).hostname; } catch { return ""; } }
function uaFamily(ua) {
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  if (/iphone|ipad|ios/i.test(ua))  return "ios";
  if (/android/i.test(ua))          return "android";
  if (/mac/i.test(ua))              return "mac";
  if (/windows/i.test(ua))          return "win";
  return "other";
}
