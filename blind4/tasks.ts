// blind4 (g1..g40): independent author, r10 preregistered suite. Real public sites, read-only, no login. Truth is recomputed live at prepare and check
// time from the same pages a browser loads (plain GET of the site's own HTML, or of the very fragment the page itself loads when the page is client-rendered).
import type { Task } from "../src/tasks.ts";
import { live, visited, getText, strip, numsIn, answerLine, datesIn, dayDiff, inputShows, anyOf, resultShows, navigatedTo, type Evidence } from "../blind/lib.ts";

// ---------- helpers ----------
const BUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const lastHit = new Map<string, number>();
const chain = new Map<string, Promise<void>>();
/** Plain GET, spaced per host (min gap) so the checker itself never trips a rate limit. */
async function page(url: string, gap = 1500, ua = false): Promise<string> {
  const host = new URL(url).host;
  const prev = chain.get(host) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((r) => (release = r));
  chain.set(host, prev.then(() => mine));
  await prev;
  try {
    const wait = (lastHit.get(host) ?? 0) + gap - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    return await getText(url, ua ? { headers: { "user-agent": BUA } } : {}, 4);
  } finally { lastHit.set(host, Date.now()); release(); }
}
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const has = (a: string, t: string) => norm(a).includes(norm(t));
const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&ndash;/g, "-").replace(/&nbsp;/g, " ");
const txt = (h: string) => dec(strip(h));
const firstNum = (line: string) => numsIn(line)[0];
const near = (line: string, t: number, tol: number) => numsIn(line).some((n) => Math.abs(n - t) <= tol);
const nearFirst = (line: string, t: number, tol: number) => { const n = firstNum(line); return n !== undefined && Math.abs(n - t) <= tol; };
const rows = (h: string) => [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
const cells = (r: string) => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => txt(m[1]));
const money = (s: string) => Number(s.replace(/[^0-9.]/g, ""));

/** Interaction evidence, tool-neutral: a CLI verb that drives a control, an MCP-style call that carries an element reference or a typed value, or a script that really sets/clicks a control. Navigation, snapshot and read-only evaluation do not match. */
export const interacted = (what: string): Evidence => anyOf(what,
  inputShows(what + ":cli", /\bagent-browser\b[^\n]*?\s(?:fill|click|select|check|press|type|dblclick|hover|keyboard)\s/i),
  inputShows(what + ":ref", /"(?:ref|element|elementRef|selectorRef)"\s*:\s*"[^"]+"[^\n]*"(?:text|value|values|key|option|submit)"\s*:|"(?:text|values?|key)"\s*:\s*"[^"]*"[^\n]*"(?:ref|element)"\s*:/i),
  inputShows(what + ":click", /"(?:ref|element)"\s*:\s*"[^"]+"/i),
  inputShows(what + ":script", /\.click\(\)|\.value\s*=[^=]|dispatchEvent|\.requestSubmit\(|\.submit\(\)|\.selectedIndex\s*=|\.checked\s*=[^=]/));

const wf = (rubric: string, interaction?: Evidence[]): Task["workflow"] =>
  interaction ? { deepLink: "does-not-satisfy", rubric, interaction } : { deepLink: "satisfies", rubric };
const FN = true;   // forbiddenNav: a recorded navigation to a data endpoint counts

type Samp = Record<string, { right: (t: any) => string; wrong: (t: any) => string }>;
export const blind4Samples: Samp = {};
export const blind4: Task[] = [];
function add(t: Omit<Task, "suite" | "prompt" | "check" | "prepare" | "snapshotAware"> & { prompt: string; compute: () => Promise<any>; fmt: (t: any) => string; judge: (line: string, t: any) => boolean; right: (t: any) => string; wrong: (t: any) => string }) {
  const { prompt, compute, fmt, judge, right, wrong, ...rest } = t;
  blind4.push({ ...rest, suite: "blind4", forbiddenNav: FN, prompt: () => prompt + "\nPut your final answer on the last line as `ANSWER: ...`", ...live(compute, fmt, judge) } as Task);
  blind4Samples[t.id] = { right, wrong };
}

// ---------- g1: CDC travel health notices (server-rendered list, grouped by level) ----------
const cdcNotices = async () => {
  const h = await page("https://wwwnc.cdc.gov/travel/notices");
  const out: Record<string, { n: number; dates: string[] }> = {};
  for (const lv of [1, 2, 3, 4]) {
    const i = h.indexOf(`id="level${lv}"`); if (i < 0) { out[lv] = { n: 0, dates: [] }; continue; }
    const j = [1, 2, 3, 4].map((x) => h.indexOf(`id="level${x}"`)).filter((x) => x > i).sort((a, b) => a - b)[0] ?? h.indexOf('id="travel-notice-definitions"');
    const seg = h.slice(i, j > i ? j : i + 400000);
    const ds = [...seg.matchAll(/<span class="date">([^<]+)<\/span>/g)].map((m) => datesIn(m[1].trim())[0]).filter(Boolean);
    out[lv] = { n: [...seg.matchAll(/<span class="date">/g)].length, dates: ds };
  }
  return out;
};
add({
  id: "g1", title: "CDC travel health notices: level 2 count and latest date",
  prompt: "On the CDC Travel Health Notices page (wwwnc.cdc.gov/travel/notices), look only at the notices filed under \"Level 2 - Practice Enhanced Precautions\". How many Level 2 notices are listed, and what is the most recent date shown next to any of them? Give the count, a semicolon, and the date as YYYY-MM-DD.",
  compute: cdcNotices,
  fmt: (t) => `L2 n=${t[2].n} latest=${[...t[2].dates].sort().pop()}`,
  judge: (line, t) => { const d = datesIn(line)[0]; return nearFirst(line, t[2].n, 0) && !!d && d === [...t[2].dates].sort().pop(); },
  right: (t) => `${t[2].n}; ${[...t[2].dates].sort().pop()}`, wrong: (t) => `${t[2].n + 4}; ${[...t[2].dates].sort().pop()}`,
  evidence: [visited("cdc travel notices", /wwwnc\.cdc\.gov\/travel/i)],
  forbidden: /\.json\b|\/api\/|tools\.cdc\.gov/i,
  workflow: wf("Read the Level 2 block on the notices list page; the list is on one server-rendered page, so a direct load of that page is the interface."),
});

// ---------- g2: PubMed filtered count ----------
const pubmedCount = async () => {
  const h = await page("https://pubmed.ncbi.nlm.nih.gov/?term=melatonin+sleep&filter=years.2023-2023&filter=pubt.randomizedcontrolledtrial&filter=simsearch2.ffrft", 2000);
  const m = h.match(/<span class="value">([\d,]+)<\/span>\s*<\/span>?\s*results|<span class="value">([\d,]+)/);
  return Number((m?.[1] ?? m?.[2] ?? "NaN").replace(/,/g, ""));
};
add({
  id: "g2", title: "PubMed: melatonin sleep, 2023 RCTs with free full text",
  prompt: "On PubMed (pubmed.ncbi.nlm.nih.gov) search for: melatonin sleep. Using the filters in the left sidebar, restrict Publication Date to the single year 2023 (custom range 2023 to 2023), Article Type to Randomized Controlled Trial, and Text Availability to Free full text. How many results does PubMed report for that filtered search? Answer with the number only.",
  compute: pubmedCount, fmt: (t) => String(t), judge: (line, t) => nearFirst(line, t, Math.max(2, Math.round(t * 0.08))),
  right: (t) => String(t), wrong: (t) => String(t + 40),
  evidence: [visited("pubmed", /pubmed\.ncbi\.nlm\.nih\.gov/i)],
  forbidden: /eutils|api\.ncbi|\/api\/|format=pubmed|\.json\b/i,
  workflow: wf("PubMed keeps the search and its filters in the URL (term= and filter=); a deep link with those parameters is the filtered search page itself."),
});

// ---------- g3: timeanddate distance calculator, two legs ----------
const tdDist = async (a: number, b: number) => {
  const h = await page(`https://www.timeanddate.com/worldclock/distanceresult.html?p1=${a}&p2=${b}`, 2500);
  const m = h.match(/Distance is (\d[\d,]*) kilometers or (\d[\d,]*) miles/);
  if (!m) throw new Error("distance not found");
  return { km: Number(m[1].replace(/,/g, "")), mi: Number(m[2].replace(/,/g, "")) };
};
add({
  id: "g3", title: "Distance calculator: two-leg trip in miles",
  prompt: "On timeanddate.com use the Distance Calculator (under the World Clock tools). Find the distance in miles from Lisbon, Portugal to Warsaw, Poland, and then from Warsaw, Poland to Nairobi, Kenya, using the miles figure the site shows for each leg. What is the total number of miles for the two-leg trip Lisbon - Warsaw - Nairobi? Answer with the number only.",
  compute: async () => { const a = await tdDist(133, 262), b = await tdDist(262, 170); return { a: a.mi, b: b.mi, total: a.mi + b.mi }; },
  fmt: (t) => `${t.a}+${t.b}=${t.total}`, judge: (line, t) => nearFirst(line, t.total, 3),
  right: (t) => String(t.total), wrong: (t) => String(t.total + 250),
  evidence: [visited("timeanddate", /timeanddate\.com\/worldclock\/distance/i)],
  forbidden: /\/scripts\/|\.json\b|\/api\//i,
  workflow: wf("The result pages are plain pages of the site (distanceresult.html); using the calculator form or loading the result URL both reach the same displayed figure."),
});

// ---------- g4: MIT course catalog units ----------
const mitUnits = async () => {
  const h = txt(await page("https://catalog.mit.edu/subjects/6/", 1500));
  const get = (id: string) => {
    const re = new RegExp(id.replace(".", "\\.") + " [A-Z][^|]*?(\\d+)-(\\d+)-(\\d+) units");
    const m = h.match(re); if (!m) throw new Error("units for " + id);
    return Number(m[1]) + Number(m[2]) + Number(m[3]);
  };
  const ids = ["6.1010", "6.1020", "6.1210", "6.1910"];
  const u = Object.fromEntries(ids.map((i) => [i, get(i)]));
  return { u, total: Object.values(u).reduce((a, b) => a + b, 0) };
};
add({
  id: "g4", title: "MIT catalog: total units of four Course 6 subjects",
  prompt: "In the MIT Course Catalog (catalog.mit.edu), open the Electrical Engineering and Computer Science (Course 6) subjects listing. Each subject shows its units as three numbers like \"a-b-c units\". Find subjects 6.1010, 6.1020, 6.1210 and 6.1910, add the three numbers of each (a+b+c), and sum those four totals. Answer with the final number only.",
  compute: mitUnits, fmt: (t) => JSON.stringify(t.u) + "=" + t.total, judge: (line, t) => nearFirst(line, t.total, 0),
  right: (t) => String(t.total), wrong: (t) => String(t.total + 3),
  evidence: [visited("mit catalog", /catalog\.mit\.edu/i)],
  forbidden: /\.json\b|\/api\//i,
  workflow: wf("The Course 6 subject listing is one catalog page; the catalog's own search or a direct load of that page both show the units lines."),
});

// ---------- g5: FIDE top lists (tabs loaded by the page) ----------
const fideList = async (list: string) => {
  const h = await page(`https://ratings.fide.com/a_top.php?list=${list}`, 2000);
  return rows(h).map((r) => { const m = r.match(/rank_span">(\d+)<[\s\S]*?<a [^>]*>([^<]+)<\/a>[\s\S]*?([A-Z]{3})\s*<\/td>[\s\S]*?rating_column>(\d+)</); return m ? { rank: +m[1], name: dec(m[2]).trim(), fed: m[3], rating: +m[4] } : null; }).filter(Boolean) as { rank: number; name: string; fed: string; rating: number }[];
};
add({
  id: "g5", title: "FIDE top players: women's tab, federation count and best rating",
  prompt: "On the FIDE world top players page (ratings.fide.com/top_lists.phtml), open the tab for the top women players (not the open list). How many of the players listed in that tab represent the federation CHN (China), and what is the standard rating of the highest-rated CHN player? Answer as `count; rating`.",
  compute: async () => { const l = await fideList("women"); const c = l.filter((p) => p.fed === "CHN"); return { n: c.length, best: Math.max(...c.map((p) => p.rating)), total: l.length }; },
  fmt: (t) => `${t.n}; ${t.best} (of ${t.total})`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.n && n[1] === t.best; },
  right: (t) => `${t.n}; ${t.best}`, wrong: (t) => `${t.n + 3}; ${t.best}`,
  evidence: [visited("fide top lists", /ratings\.fide\.com/i)],
  forbidden: /a_top\.php|\.json\b|\/api\//i,
  workflow: wf("The women's list is a tab of the top lists page whose content the page loads itself; the prompt asks to open that tab, so the run must show the tab being operated, not a request for the fragment.", [interacted("tab/control interaction on fide top lists")]),
});

// ---------- g6: Box Office Mojo worldwide year table ----------
const bomWorld = async (year: number) => {
  const h = await page(`https://www.boxofficemojo.com/year/world/${year}/`, 2000);
  const out: { rank: number; title: string; ww: number; dom: number; pct: number }[] = [];
  for (const r of rows(h)) { const c = cells(r); if (/^\d+$/.test(c[0] ?? "") && c.length >= 7) out.push({ rank: +c[0], title: c[1], ww: money(c[2]), dom: money(c[3]), pct: Number(c[4].replace("%", "")) }); }
  return out.slice(0, 10);
};
add({
  id: "g6", title: "Box Office Mojo: top-10 worldwide 2016, highest domestic share",
  prompt: "On Box Office Mojo (boxofficemojo.com), open the Worldwide yearly chart for 2016. Among the ten releases ranked 1 to 10 by worldwide gross, which one has the HIGHEST share of its worldwide gross coming from the Domestic market (the first % column)? Answer as `Title; percentage` (for example `Some Film; 47.1%`).",
  compute: () => bomWorld(2016), fmt: (t) => { const b = [...t].sort((a, c) => c.pct - a.pct)[0]; return `${b.title}; ${b.pct}%`; },
  judge: (line, t) => { const b = [...t].sort((a, c) => c.pct - a.pct)[0]; return has(line, b.title) && near(line, b.pct, 0.15); },
  right: (t) => { const b = [...t].sort((a, c) => c.pct - a.pct)[0]; return `${b.title}; ${b.pct}%`; }, wrong: (t) => { const b = [...t].sort((a, c) => a.pct - c.pct)[0]; return `${b.title}; ${b.pct}%`; },
  evidence: [visited("box office mojo", /boxofficemojo\.com/i)],
  forbidden: /\.json\b|\/api\/|imdb\.com\/api/i,
  workflow: wf("The worldwide yearly chart is a server-rendered page of the site; a direct load of the 2016 worldwide URL is the chart."),
});

// ---------- g7: hockey-reference standings ----------
const hockey = async (year: number) => {
  const h = await page(`https://www.hockey-reference.com/leagues/NHL_${year}.html`, 4000);
  const out: { team: string; gf: number; ga: number; pts: number }[] = [];
  for (const m of h.matchAll(/<tr class="full_table"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const r = m[1]; const t = r.match(/<a [^>]*>([^<]+)<\/a>/)?.[1]; const gf = r.match(/data-stat="goals"[^>]*>(\d+)</)?.[1]; const ga = r.match(/data-stat="opp_goals"[^>]*>(\d+)</)?.[1]; const pts = r.match(/data-stat="points"[^>]*>(\d+)</)?.[1];
    if (t && gf && ga && pts) out.push({ team: dec(t), gf: +gf, ga: +ga, pts: +pts });
  }
  const seen = new Set<string>(); return out.filter((x) => (seen.has(x.team) ? false : (seen.add(x.team), true)));
};
const hbest = (t: any[]) => [...t].sort((a, b) => b.gf - b.ga - (a.gf - a.ga))[0];
add({
  id: "g7", title: "Hockey Reference: best goal differential, 2016-17 NHL",
  prompt: "On hockey-reference.com open the standings for the 2016-17 NHL season (the 2017 season page). Using the GF (goals for) and GA (goals against) columns of the conference standings, which team had the best goal differential (GF minus GA) over the whole league, and what was it? Answer as `Team; +N`.",
  compute: () => hockey(2017), fmt: (t) => { const b = hbest(t); return `${b.team}; +${b.gf - b.ga} (${t.length} teams)`; },
  judge: (line, t) => { const b = hbest(t); return has(line, b.team) && near(line, b.gf - b.ga, 0); },
  right: (t) => { const b = hbest(t); return `${b.team}; +${b.gf - b.ga}`; }, wrong: (t) => { const b = [...t].sort((a, c) => a.gf - a.ga - (c.gf - c.ga))[0]; return `${b.team}; ${b.gf - b.ga}`; },
  evidence: [visited("hockey-reference", /hockey-reference\.com/i)],
  forbidden: /\.json\b|\/api\/|\.csv\b|output=csv/i,
  workflow: wf("The season standings are one server-rendered page; loading it directly is the interface."),
});

// ---------- g8: Debian package search across suites ----------
const debianRg = async () => {
  const h = txt(await page("https://packages.debian.org/search?keywords=ripgrep&searchon=names&suite=all&section=all", 2000));
  const pick = (role: string) => { const m = h.match(new RegExp("\\w+ \\(" + role + "\\) \\(utils\\): [^:]*?(\\d[\\w.+~:-]*): "));  if (!m) throw new Error("no " + role); return m[1]; };
  return { oldstable: pick("oldstable"), stable: pick("stable") };
};
add({
  id: "g8", title: "Debian package search: ripgrep in oldstable vs stable",
  prompt: "On packages.debian.org, search for packages whose names contain \"ripgrep\" across all suites and sections. In the results, what version of the ripgrep package is listed for the suite labelled (oldstable), and what version for the suite labelled (stable)? Answer as `oldstable_version; stable_version`, copying the version strings exactly as shown (without the architecture list).",
  compute: debianRg, fmt: (t) => `${t.oldstable}; ${t.stable}`, judge: (line, t) => { const i = line.indexOf(t.oldstable), j = line.indexOf(t.stable); return i >= 0 && j > i; },
  right: (t) => `${t.oldstable}; ${t.stable}`, wrong: (t) => `${t.stable}; ${t.oldstable}`,
  evidence: [visited("debian packages", /packages\.debian\.org/i)],
  forbidden: /sources\.debian|api\.ftp-master|\.json\b|\/api\//i,
  workflow: wf("The package search results page is addressed by its query string; a deep link to it is the site's own search page."),
});

// ---------- g9: Jisho kanji stroke counts ----------
const jishoStrokes = async (k: string) => {
  const h = txt(await page(`https://jisho.org/search/${encodeURIComponent(k)}%20%23kanji`, 2000));
  const m = h.match(new RegExp(k + " (\\d+) strokes")); if (!m) throw new Error("strokes " + k);
  return Number(m[1]);
};
add({
  id: "g9", title: "Jisho: total strokes of a two-kanji word",
  prompt: "Using jisho.org, look up the individual kanji details (the \"#kanji\" search shows stroke counts) for each of the two characters in the word 憂鬱 (melancholy). What is the total number of strokes of the two kanji together, according to the stroke counts the site shows? Answer with the number only.",
  compute: async () => { const a = await jishoStrokes("憂"), b = await jishoStrokes("鬱"); return { a, b, total: a + b }; },
  fmt: (t) => `${t.a}+${t.b}=${t.total}`, judge: (line, t) => nearFirst(line, t.total, 0),
  right: (t) => String(t.total), wrong: (t) => String(t.total - 5),
  evidence: [visited("jisho", /jisho\.org/i)],
  forbidden: /jisho\.org\/api|\.json\b/i,
  workflow: wf("Jisho search state lives in the URL path (/search/<query>); loading the search URL is the site's search."),
});

// ---------- g10: Bank of Russia official rates on a date ----------
const cbrRates = async () => {
  const h = await page("https://www.cbr.ru/currency_base/daily/?UniDbQuery.Posted=True&UniDbQuery.To=15.03.2023", 1500);
  const row = (code: string) => { for (const r of rows(h)) { const c = cells(r); if (c[1] === code) return { nominal: Number(c[2]), rate: Number(c[4].replace(",", ".")) }; } throw new Error("cbr " + code); };
  const eur = row("EUR"), jpy = row("JPY");
  return { eur, jpy, total: 250 * eur.rate / eur.nominal + 1500 * jpy.rate / jpy.nominal };
};
add({
  id: "g10", title: "Bank of Russia rates: roubles for EUR and JPY on a past date",
  prompt: "On the Bank of Russia website (cbr.ru), open the official exchange rates table (\"Официальные курсы валют на заданную дату\") and set the date to 15 March 2023 (15.03.2023). Using the official rates shown for that date (mind the 'Номинал' unit column), how many roubles are 250 euros plus 1,500 Japanese yen worth together? Round to the nearest whole rouble. Answer with the number only.",
  compute: cbrRates, fmt: (t) => `${t.total.toFixed(2)}`, judge: (line, t) => nearFirst(line, Math.round(t.total), 1),
  right: (t) => String(Math.round(t.total)), wrong: (t) => String(Math.round(t.total) + 400),
  evidence: [visited("cbr.ru", /cbr\.ru/i)],
  forbidden: /cbr\.ru\/(?:scripts|dataservice|api)|\.xml\b|\.json\b|XML_daily/i,
  workflow: wf("The date lives in the URL query of the rates page (UniDbQuery.To); a deep link with that date is the rates page for it.", undefined),
});

// ---------- g11: NHS conditions A to Z, one letter ----------
const nhsLetter = async (letter: string) => {
  const h = await page("https://www.nhs.uk/conditions/", 1500);
  const i = h.indexOf(`id="${letter.toLowerCase()}"`); if (i < 0) throw new Error("letter");
  const nxt = h.indexOf('<h2', i + 10); const seg = h.slice(i, nxt > 0 ? nxt : i + 60000);
  const items = [...seg.matchAll(/<li>\s*<a [^>]*>([\s\S]*?)<\/a>/g)].map((m) => dec(m[1]).replace(/\s+/g, " ").trim());
  return { n: items.length, see: items.filter((x) => /, see /i.test(x)).length };
};
add({
  id: "g11", title: "NHS conditions A to Z: entries under one letter and cross-references",
  prompt: "On the NHS website (nhs.uk) open the \"Health A to Z\" list of conditions (Conditions A to Z). Look at the section for the letter K. How many entries are listed under K in total, and how many of those are cross-references whose label contains \", see \" (pointing you to another entry)? Answer as `total; cross-references`.",
  compute: () => nhsLetter("K"), fmt: (t) => `${t.n}; ${t.see}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.n && n[1] === t.see; },
  right: (t) => `${t.n}; ${t.see}`, wrong: (t) => `${t.n + 2}; ${t.see}`,
  evidence: [visited("nhs conditions", /nhs\.uk\/conditions/i)],
  forbidden: /\.json\b|\/api\/|api\.nhs/i,
  workflow: wf("The A to Z list is one server-rendered page with all letters; loading it directly is the interface."),
});

// ---------- g12: Rightmove area house prices ----------
const rightmove = async (slug: string) => {
  const h = txt(await page(`https://www.rightmove.co.uk/house-prices/${slug}.html`, 2500, true));
  const m = h.match(/overall average of £([\d,]+) over the last year/); if (!m) throw new Error("rightmove " + slug);
  return Number(m[1].replace(/,/g, ""));
};
add({
  id: "g12", title: "Rightmove house prices: Bristol vs Manchester average gap",
  prompt: "On Rightmove's house prices section (rightmove.co.uk, House Prices), look up the area page for Bristol and the one for Manchester. Each states an overall average sold price over the last year. By how many pounds (£) is Bristol's overall average higher than Manchester's? Answer with the number only (digits, no currency sign).",
  compute: async () => { const b = await rightmove("bristol"), m = await rightmove("manchester"); return { b, m, d: b - m }; },
  fmt: (t) => `${t.b}-${t.m}=${t.d}`, judge: (line, t) => nearFirst(line, t.d, 4000),
  right: (t) => String(t.d), wrong: (t) => String(t.d + 60000),
  evidence: [visited("rightmove house prices", /rightmove\.co\.uk\/house-prices/i)],
  forbidden: /\.json\b|\/api\/|_next\/data/i,
  workflow: wf("Each area's house-price summary is its own page (/house-prices/<area>.html); searching for the area or loading that URL both show the sentence with the average."),
});

// ---------- g13: Walk Score Boston neighbourhood table ----------
const walkscore = async () => {
  const h = await page("https://www.walkscore.com/MA/Boston", 2000);
  const out: { name: string; walk: number; transit: number; bike: number }[] = [];
  for (const r of rows(h)) { const c = cells(r); if (c.length >= 6 && /^\d+$/.test(c[0]) && /^\d+$/.test(c[2]) && /^\d+$/.test(c[3])) out.push({ name: c[1], walk: +c[2], transit: +c[3], bike: +c[4] }); }
  return out;
};
const wsBest = (t: any[]) => [...t.filter((x) => x.walk >= 95)].sort((a, b) => b.bike - a.bike || a.name.localeCompare(b.name));
add({
  id: "g13", title: "Walk Score Boston: best bike score among very walkable neighbourhoods",
  prompt: "On walkscore.com open the Boston, MA city page and find the table of Boston neighborhoods with Walk Score, Transit Score and Bike Score. Considering only neighborhoods whose Walk Score is 95 or higher, which one has the highest Bike Score, and what is that Bike Score? Answer as `Neighborhood; score`. (If the table is split over several pages or tabs, use all of it.)",
  compute: walkscore, fmt: (t) => { const b = wsBest(t); return `${b[0]?.name}; ${b[0]?.bike} (ties: ${b.filter((x) => x.bike === b[0].bike).length}) rows=${t.length}`; },
  judge: (line, t) => { const b = wsBest(t); const top = b.filter((x) => x.bike === b[0].bike); return top.some((x) => has(line, x.name)) && near(line, b[0].bike, 0); },
  right: (t) => { const b = wsBest(t); return `${b[0].name}; ${b[0].bike}`; }, wrong: (t) => { const b = wsBest(t); return `${b[b.length - 1].name}; ${b[b.length - 1].bike}`; },
  evidence: [visited("walkscore", /walkscore\.com/i)],
  forbidden: /\.json\b|\/api\/|api\.walkscore|\/score\?/i,
  workflow: wf("The neighbourhood table is part of the city page; a direct load of that page is the interface."),
});

// ---------- g14: Mathematics Genealogy advisor chain ----------
const mgp = async (id: number | string) => {
  const h = await page(`https://www.mathgenealogy.org/id.php?id=${id}`, 1200);
  const name = dec(h.match(/<h2[^>]*>\s*([^<]*)/)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const a = h.match(/Advisor(?: 1)?:\s*<a href="id\.php\?id=(\d+)">/);
  return { name, adv: a ? Number(a[1]) : null };
};
const mgpChain = async () => {
  const chain: string[] = []; let id: number | null = 8011;
  for (let k = 0; k < 14 && id; k++) { const r = await mgp(id); chain.push(r.name); if (/Euler/.test(r.name)) break; id = r.adv; }
  const steps = chain.length - 1; return { steps, before: chain[chain.length - 2], chain, ok: /Euler/.test(chain[chain.length - 1]) };
};
add({
  id: "g14", title: "Mathematics Genealogy: advisor steps from a logician to Euler",
  prompt: "On the Mathematics Genealogy Project (mathgenealogy.org) open the record of Alonzo Church (record id 8011). Repeatedly follow the FIRST listed advisor (\"Advisor 1\", or the single \"Advisor\") from each record until you reach the record of Leonhard Euler. How many advisor steps does it take from Church to Euler, and which person is the one listed immediately before Euler on that path? Answer as `steps; Name`.",
  compute: async () => { const c = await mgpChain(); if (!c.ok) throw new Error("chain did not reach Euler"); return c; },
  fmt: (t) => `${t.steps}; ${t.before}`, judge: (line, t) => nearFirst(line, t.steps, 0) && has(line, t.before.split(" ").pop()!),
  right: (t) => `${t.steps}; ${t.before}`, wrong: (t) => `${t.steps + 2}; ${t.before}`,
  evidence: [visited("mathgenealogy", /mathgenealogy\.org/i)],
  forbidden: /\.json\b|\/api\/|query-prep|\.xml\b/i,
  workflow: wf("Each person is a server-rendered page and the path has to be followed link by link; loading the chain's record URLs is the site's own navigation."),
});

// ---------- g15: IRS standard mileage rates ----------
const irsRates = async () => {
  const h = await page("https://www.irs.gov/tax-professionals/standard-mileage-rates", 1500);
  const map: Record<string, number[]> = {};
  for (const r of rows(h)) { const c = cells(r); if (c.length >= 4 && /^(\d{4}|\d{1,2}\/\d{1,2}\/\d{4}-\d{1,2}\/\d{1,2}\/\d{4})/.test(c[0].replace(/\s+/g, ""))) map[c[0].replace(/\s+/g, "")] = [Number(c[1]), Number(c[2]), Number(c[3])]; }
  const h1 = map["1/1/2022-6/30/2022"], h2 = map["7/1/2022-12/31/2022"], y21 = map["2021"];
  if (!h1 || !h2 || !y21) throw new Error("irs rows");
  return { h1: h1[0], h2: h2[0], med21: y21[2], total: 6000 * h1[0] / 100 + 8000 * h2[0] / 100 + 5000 * y21[2] / 100 };
};
add({
  id: "g15", title: "IRS standard mileage rates: mixed-year deduction",
  prompt: "On the IRS page for standard mileage rates (irs.gov, \"Standard mileage rates\"), use the table of mileage rates for all years (cents per mile). Compute the total deduction in dollars for: 6,000 business miles driven between 1 January and 30 June 2022, plus 8,000 business miles driven between 1 July and 31 December 2022, plus 5,000 medical miles driven in 2021. Answer with the dollar amount as a number (no $ sign).",
  compute: irsRates, fmt: (t) => `${t.h1}c,${t.h2}c,${t.med21}c => ${t.total}`, judge: (line, t) => nearFirst(line, t.total, 1),
  right: (t) => String(t.total), wrong: (t) => String(t.total + 700),
  evidence: [visited("irs mileage", /irs\.gov\/tax-professionals\/standard-mileage-rates/i)],
  forbidden: /\.json\b|\/api\/|\.pdf\b/i,
  workflow: wf("The all-years table is on the single mileage rates page; loading it directly is the interface."),
});

// ---------- g16: AEMET (Spain) climate normals, annual precipitation ----------
const aemetStations: [string, string, string][] = [["Bilbao Aeropuerto", "1082", "pva"], ["Sevilla Aeropuerto", "5783", "and"], ["València", "8416", "val"], ["Madrid, Retiro", "3195", "mad"]];
const aemetRain = async () => {
  const out: { name: string; mm: number }[] = [];
  for (const [name, l, k] of aemetStations) {
    const h = await page(`https://www.aemet.es/es/serviciosclimaticos/datosclimatologicos/valoresclimatologicos?l=${l}&k=${k}`, 2000);
    let mm = NaN;
    for (const r of rows(h)) { const c = cells(r); if (c.length >= 12 && /^A.{0,2}o$/.test(c[0])) mm = Number(c[4]); }
    if (!Number.isFinite(mm)) throw new Error("aemet " + name);
    out.push({ name, mm });
  }
  return out;
};
const aemetSort = (t: { name: string; mm: number }[]) => [...t].sort((a, b) => b.mm - a.mm);
add({
  id: "g16", title: "AEMET climate normals: wettest vs driest of four Spanish stations",
  prompt: "On the website of Spain's weather agency AEMET (aemet.es), open Servicios climáticos > Datos climatológicos > Valores normales and look at the climate normals table of these four stations: Bilbao Aeropuerto, Sevilla Aeropuerto, València and Madrid, Retiro. Use the annual precipitation figure (column R, row \"Año\", in mm). Which of the four is the wettest, which is the driest, and what is the difference between them in mm? Answer as `Wettest; Driest; difference`.",
  compute: aemetRain, fmt: (t) => { const s = aemetSort(t); return `${s[0].name}; ${s[3].name}; ${s[0].mm - s[3].mm}`; },
  judge: (line, t) => { const s = aemetSort(t); const parts = line.split(";"); return parts.length >= 3 && has(parts[0], s[0].name.split(" ")[0]) && has(parts[1], s[3].name.replace(", Retiro", "")) && near(parts[2], s[0].mm - s[3].mm, 0); },
  right: (t) => { const s = aemetSort(t); return `${s[0].name}; ${s[3].name}; ${s[0].mm - s[3].mm}`; }, wrong: (t) => { const s = aemetSort(t); return `${s[3].name}; ${s[0].name}; ${s[0].mm - s[3].mm}`; },
  evidence: [visited("aemet", /aemet\.es/i)],
  forbidden: /opendata\.aemet|\.json\b|\/api\/|\.csv\b|\.xml\b/i,
  workflow: wf("Each station's normals are a page reached through the site's station selector (query l=<station>&k=<region>); the prompt names the section to browse, and loading those station pages is the site's own navigation."),
});

// ---------- g17: Federal Reserve H.15 spread ----------
const h15 = async () => {
  const h = await page("https://www.federalreserve.gov/releases/h15/", 1500);
  const rs = rows(h);
  const head = cells(rs[0]);
  const nom = rs.findIndex((r) => /^Nominal/.test(cells(r)[0] ?? ""));
  const find = (label: string) => { for (let i = nom; i < rs.length; i++) { const c = cells(rs[i]); if (c[0] === label) return c.slice(1).map((x) => Number(x.replace(/ /g, "").trim())); } throw new Error("h15 " + label); };
  const y2 = find("2-year"), y10 = find("10-year");
  let k = -1; for (let i = head.length - 2; i >= 0; i--) if (Number.isFinite(y2[i]) && Number.isFinite(y10[i]) && y2[i] > 0 && y10[i] > 0) { k = i; break; }
  if (k < 0) throw new Error("h15 col");
  const date = head[k + 1].replace(/\*/g, "");   // e.g. 2026Nov12
  const day = Number(date.match(/(\d+)$/)![1]);
  return { date, day, y2: y2[k], y10: y10[k], bp: Math.round((y10[k] - y2[k]) * 100) };
};
add({
  id: "g17", title: "Federal Reserve H.15: 10-year minus 2-year Treasury spread",
  prompt: "On the Federal Reserve's H.15 \"Selected Interest Rates\" release (federalreserve.gov/releases/h15), look at the daily table of Treasury constant maturities (Nominal). Take the most recent date column for which both the 2-year and the 10-year yields are shown, and compute the 10-year minus 2-year spread in basis points (1 percentage point = 100 bp). Answer as `day of month; spread in bp` (for example `7; 25`).",
  compute: h15, fmt: (t) => `${t.date} 10y=${t.y10} 2y=${t.y2} => ${t.day}; ${t.bp}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.day && n[1] === t.bp; },
  right: (t) => `${t.day}; ${t.bp}`, wrong: (t) => `${t.day}; ${t.bp + 30}`,
  evidence: [visited("federal reserve h15", /federalreserve\.gov\/releases\/h15/i)],
  forbidden: /\/datadownload|\.csv\b|\.json\b|\/api\/|fred\.stlouisfed/i,
  workflow: wf("The H.15 release page itself contains the daily table; loading it is the interface."),
});

// ---------- g18: UK public holidays table ----------
const ukHolidays = async () => {
  const h = await page("https://publicholidays.co.uk/", 1500, true);
  const blocks: { date: string; day: string; name: string; where: string }[][] = [];
  for (const r of rows(h)) { const c = cells(r); if (c.length >= 4 && /^\d{1,2} [A-Z][a-z]{2}$/.test(c[0]) && /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(c[1])) { if (c[0] === "1 Jan") blocks.push([]); blocks[blocks.length - 1]?.push({ date: c[0], day: c[1], name: c[2], where: c[3] }); } }
  const rs = blocks[1] ?? []; if (rs.length < 8) throw new Error("holiday block");
  return { n: rs.length, scot: rs.filter((x) => /Scotland/.test(x.where)).length, scotMon: rs.filter((x) => /Scotland/.test(x.where) && x.day === "Mon").length };
};
add({
  id: "g18", title: "publicholidays.co.uk: Scottish holidays and how many fall on Monday",
  prompt: "On publicholidays.co.uk open the \"2027 Public Holidays\" table of UK public holidays (the home page lists a table per year). Count the rows of the 2027 table whose 'Countries' column mentions Scotland, and, of those rows, how many fall on a Monday according to the 'Day' column. Answer as `rows mentioning Scotland; of which on Monday`.",
  compute: ukHolidays, fmt: (t) => `${t.scot}; ${t.scotMon} (all rows ${t.n})`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.scot && n[1] === t.scotMon; },
  right: (t) => `${t.scot}; ${t.scotMon}`, wrong: (t) => `${t.scot + 2}; ${t.scotMon}`,
  evidence: [visited("publicholidays uk", /publicholidays\.co\.uk/i)],
  forbidden: /\.ics\b|\.json\b|\/api\/|\.csv\b/i,
  workflow: wf("The table is on the site's own pages; loading the page is the interface."),
});

// ---------- g19: iFixit store prices ----------
const ifixitPrice = async (slug: string) => {
  const h = await page(`https://www.ifixit.com/products/${slug}`, 2000);
  const m = h.match(/"price":\s*"?([\d.]+)/); if (!m) throw new Error("ifixit " + slug); return Number(m[1]);
};
add({
  id: "g19", title: "iFixit store: three-item basket total",
  prompt: "On iFixit's online store (ifixit.com, Store/Products), find these three products by name and note the current price shown for each: \"Pro Tech Toolkit\" (the iFixit Pro Tech Toolkit), \"iOpener\" (iPhone and iPad Screen Opener, Adhesive Softener), and \"Magnetic Project Mat\". What is the total price in US dollars for one of each? Answer with the number only, two decimals.",
  compute: async () => { const a = await ifixitPrice("pro-tech-toolkit"), b = await ifixitPrice("iopener"), c = await ifixitPrice("magnetic-project-mat"); return { a, b, c, total: Math.round((a + b + c) * 100) / 100 }; },
  fmt: (t) => `${t.a}+${t.b}+${t.c}=${t.total}`, judge: (line, t) => nearFirst(line, t.total, 0.05),
  right: (t) => t.total.toFixed(2), wrong: (t) => (t.total + 10).toFixed(2),
  evidence: [visited("ifixit", /ifixit\.com/i)],
  forbidden: /ifixit\.com\/api|\.json\b|\/api\/2\.0/i,
  workflow: wf("Each product is a page of the store; searching the store or loading the product pages both read the shown price."),
});

// ---------- g20: CRAN Imports counts ----------
const cranImports = async (pkg: string) => {
  const h = await page(`https://cran.r-project.org/web/packages/${pkg}/index.html`, 1500);
  for (const r of rows(h)) { const c = cells(r); if (/^Imports:?$/.test(c[0])) return c[1].split(",").map((x) => x.trim()).filter(Boolean).length; }
  return 0;
};
add({
  id: "g20", title: "CRAN: total Imports across three R packages",
  prompt: "On CRAN (cran.r-project.org) open the package pages for dplyr, tidyr and ggplot2. Each page has an \"Imports:\" line listing the packages it imports (separated by commas; a version requirement in parentheses does not make a separate entry). How many packages are listed under Imports for each of the three, and what is the total? Answer as `dplyr; tidyr; ggplot2; total`.",
  compute: async () => { const d = await cranImports("dplyr"), t = await cranImports("tidyr"), g = await cranImports("ggplot2"); return { d, t, g, total: d + t + g }; },
  fmt: (t) => `${t.d}; ${t.t}; ${t.g}; ${t.total}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.d && n[1] === t.t && n[2] === t.g && n[3] === t.total; },
  right: (t) => `${t.d}; ${t.t}; ${t.g}; ${t.total}`, wrong: (t) => `${t.d}; ${t.t}; ${t.g + 1}; ${t.total + 1}`,
  evidence: [visited("cran", /cran\.r-project\.org/i)],
  forbidden: /\.json\b|\/api\/|crandb|packages\.rds|PACKAGES/i,
  workflow: wf("Each package has a static index page; loading the three pages is the interface."),
});

// ---------- g21: StatsF1 2012 championship table ----------
const f1 = async () => {
  const h = await page("https://www.statsf1.com/en/2012.aspx", 2000);
  const rs = rows(h); const out: { pos: number; name: string; wins: number }[] = [];
  const di = rs.findIndex((r) => cells(r)[0] === "Drivers"); const ci = rs.findIndex((r) => cells(r)[0] === "Constructors");
  for (let i = di + 1; i < ci; i++) { const c = cells(rs[i]); const m = c[0].match(/^(\d+)\.$/); if (m) out.push({ pos: +m[1], name: c[1], wins: c.slice(2, -1).filter((x) => x === "25").length }); }
  return out;
};
add({
  id: "g21", title: "StatsF1: race wins of drivers ranked 4th to 10th in 2012",
  prompt: "On statsf1.com (English version) open the 2012 Formula 1 season page and its World Championship drivers table (rows of points per Grand Prix). A race win scored 25 points in 2012. Counting the cells that show exactly 25, how many race wins in total were scored by the drivers ranked 4th through 10th (inclusive) in the final standings? Answer with the number only.",
  compute: f1, fmt: (t) => { const s = t.filter((x: any) => x.pos >= 4 && x.pos <= 10); return `${s.reduce((a: number, b: any) => a + b.wins, 0)} (${s.map((x: any) => x.name + ":" + x.wins).join(",")})`; },
  judge: (line, t) => nearFirst(line, t.filter((x: any) => x.pos >= 4 && x.pos <= 10).reduce((a: number, b: any) => a + b.wins, 0), 0),
  right: (t) => String(t.filter((x: any) => x.pos >= 4 && x.pos <= 10).reduce((a: number, b: any) => a + b.wins, 0)), wrong: (t) => String(t.filter((x: any) => x.pos >= 4 && x.pos <= 10).reduce((a: number, b: any) => a + b.wins, 0) + 3),
  evidence: [visited("statsf1", /statsf1\.com/i)],
  forbidden: /\.json\b|\/api\//i,
  workflow: wf("The season page is one server-rendered page of the site; loading it is the interface."),
});

// ---------- g22: Coffee Review, price per ounce ----------
const coffee = async (slug: string) => {
  const h = txt(await page(`https://www.coffeereview.com/review/${slug}/`, 1500));
  const m = h.match(/Est\. Price: \$([\d.]+)\/([\d.]+) ounces/); const r = h.match(/(\d{2}) [^|]{0,3}(?:[A-Z][\w&'. -]+) (?=Roaster Location)/);
  if (!m) throw new Error("coffee " + slug);
  return { price: Number(m[1]), oz: Number(m[2]), ppo: Number(m[1]) / Number(m[2]) };
};
const coffeeNames: [string, string][] = [["Daniso Horsa Ethiopia Natural", "daniso-horsa-ethiopia-natural"], ["Colombia Marlon Bolaños Washed Ají Bourbon", "colombia-marlon-bolanos-washed-aji-bourbon"], ["Cloister Reserve Blend Espresso", "cloister-reserve-blend-espresso"]];
add({
  id: "g22", title: "Coffee Review: cheapest per ounce of three reviewed coffees",
  prompt: "On coffeereview.com find the reviews of these three coffees: \"Daniso Horsa Ethiopia Natural\" (JBC Coffee Roasters), \"Colombia Marlon Bolaños Washed Ají Bourbon\" (Heady Cup Coffee Roasters) and \"Cloister Reserve Blend Espresso\" (Mystic Monk Coffee). Each review shows an \"Est. Price\" as dollars per package size in ounces. Which of the three is cheapest per ounce, and what is that price per ounce rounded to cents? Answer as `Coffee name; $x.xx`.",
  compute: async () => { const o: any[] = []; for (const [n, s] of coffeeNames) o.push({ n, ...(await coffee(s)) }); return o; },
  fmt: (t) => { const b = [...t].sort((a, c) => a.ppo - c.ppo)[0]; return `${b.n}; ${b.ppo.toFixed(2)}`; },
  judge: (line, t) => { const b = [...t].sort((a, c) => a.ppo - c.ppo)[0]; return has(line, b.n.split(" ")[0]) && near(line, Math.round(b.ppo * 100) / 100, 0.011); },
  right: (t) => { const b = [...t].sort((a, c) => a.ppo - c.ppo)[0]; return `${b.n}; $${b.ppo.toFixed(2)}`; }, wrong: (t) => { const b = [...t].sort((a, c) => c.ppo - a.ppo)[0]; return `${b.n}; $${b.ppo.toFixed(2)}`; },
  evidence: [visited("coffeereview", /coffeereview\.com/i)],
  forbidden: /\.json\b|wp-json|\/api\//i,
  workflow: wf("Each review is a page of the site reached by its search or by URL; loading the review pages is the interface."),
});

// ---------- g23: Flathub category result counts (client-rendered, infinite list) ----------
const flathubCount = async (cat: string) => {
  const h = txt(await page(`https://flathub.org/en/apps/category/${cat}`, 2000));
  const m = h.match(/(\d[\d,]*) results/); if (!m) throw new Error("flathub " + cat); return Number(m[1].replace(/,/g, ""));
};
add({
  id: "g23", title: "Flathub: Education vs Science category sizes",
  prompt: "On flathub.org browse the application categories and open the Education category and the Science category. Each category page states how many results it has. How many more apps does Education have than Science (Education minus Science)? Answer with the number only.",
  compute: async () => { const e = await flathubCount("Education"), s = await flathubCount("Science"); return { e, s, d: e - s }; },
  fmt: (t) => `${t.e}-${t.s}=${t.d}`, judge: (line, t) => nearFirst(line, t.d, 3),
  right: (t) => String(t.d), wrong: (t) => String(t.d + 25),
  evidence: [visited("flathub", /flathub\.org/i)],
  forbidden: /flathub\.org\/api|\/api\/v2|\.json\b|\.appdata|appstream/i,
  workflow: wf("Category pages are routes of the site (/apps/category/<name>); navigating the categories or loading those routes both show the result counts."),
});

// ---------- g24: Alpine package search across release branches ----------
const alpine = async (branch: string) => {
  const h = await page(`https://pkgs.alpinelinux.org/packages?name=curl&branch=${branch}&repo=main&arch=x86_64`, 2000);
  for (const r of rows(h)) { const c = cells(r); if (c[0] === "curl" && c[4] === branch) return c[1]; }
  throw new Error("alpine " + branch);
};
add({
  id: "g24", title: "Alpine package search: curl version in two release branches",
  prompt: "On pkgs.alpinelinux.org (Alpine Linux packages), search for the package named curl and filter by branch, repository main and architecture x86_64. What version of the package \"curl\" does branch v3.19 list, and what version does branch v3.21 list? Answer as `v3.19 version; v3.21 version`, copying the version strings exactly as shown.",
  compute: async () => ({ a: await alpine("v3.19"), b: await alpine("v3.21") }), fmt: (t) => `${t.a}; ${t.b}`,
  judge: (line, t) => { const i = line.indexOf(t.a), j = line.indexOf(t.b); return i >= 0 && j > i; },
  right: (t) => `${t.a}; ${t.b}`, wrong: (t) => `${t.b}; ${t.a}`,
  evidence: [visited("alpine packages", /pkgs\.alpinelinux\.org/i)],
  forbidden: /\.json\b|\/api\/|APKINDEX|dl-cdn/i,
  workflow: wf("The package filter form (name, branch, repo, arch) is a GET form whose state is in the query string; a deep link to the filtered results is the site's own search page."),
});

// ---------- g26: NDBC buoy stations, water depth ----------
const ndbcDepth = async (id: string) => {
  const h = txt(await page(`https://www.ndbc.noaa.gov/station_page.php?station=${id}`, 2000));
  const m = h.match(/Water depth: ([\d,.]+) m/); if (!m) throw new Error("ndbc " + id); return Number(m[1].replace(/,/g, ""));
};
add({
  id: "g26", title: "NDBC buoy pages: deepest of four stations",
  prompt: "On the NOAA National Data Buoy Center site (ndbc.noaa.gov) open the station pages for buoys 41001, 46026, 51001 and 42040. Each page states the water depth at the station. Which of the four stations has the deepest water, and how many metres deeper is it than the shallowest of the four? Answer as `station id; difference in metres`.",
  compute: async () => { const o: Record<string, number> = {}; for (const s of ["41001", "46026", "51001", "42040"]) o[s] = await ndbcDepth(s); return o; },
  fmt: (t) => { const e = Object.entries(t).sort((a: any, b: any) => b[1] - a[1]) as [string, number][]; return `${e[0][0]}; ${e[0][1] - e[e.length - 1][1]}`; },
  judge: (line, t) => { const e = Object.entries(t).sort((a: any, b: any) => b[1] - a[1]) as [string, number][]; return line.includes(e[0][0]) && near(line.replace(e[0][0], ""), e[0][1] - e[e.length - 1][1], 0); },
  right: (t) => { const e = Object.entries(t).sort((a: any, b: any) => b[1] - a[1]) as [string, number][]; return `${e[0][0]}; ${e[0][1] - e[e.length - 1][1]}`; }, wrong: (t) => { const e = Object.entries(t).sort((a: any, b: any) => a[1] - b[1]) as [string, number][]; return `${e[0][0]}; ${e[e.length - 1][1] - e[0][1]}`; },
  evidence: [visited("ndbc", /ndbc\.noaa\.gov/i)],
  forbidden: /\.json\b|\/api\/|\.txt\b|\/data\/realtime2|\/data\/latest_obs|\.rss\b|\.xml\b/i,
  workflow: wf("Each buoy has a station page (station_page.php?station=ID); loading those pages is the interface."),
});

// ---------- g27: All-time athletics list, distinct athletes ----------
const athletics = async () => {
  const h = await page("https://www.alltime-athletics.com/m_100ok.htm", 2000);
  const body = dec(h.replace(/<[^>]+>/g, "")); const start = body.indexOf("All-time men's best 100m"); const seg = body.slice(start);
  const end = seg.search(/rolling start|manual timing|indoors|faulty wind/i); const main = end > 200 ? seg.slice(0, end) : seg;
  const names = new Set<string>(); let n = 0;
  for (const line of main.split("\n")) { const m = line.match(/^\s*\d+\s+(\d+\.\d\d)\s+\S+\s+(.+?)\s{2,}([A-Z]{3})\s+\d\d\.\d\d\.\d\d/); if (m && Number(m[1]) <= 9.74) { names.add(m[2].trim()); n++; } }
  return { athletes: names.size, lines: n };
};
add({
  id: "g27", title: "All-time athletics list: distinct sprinters at or under 9.74",
  prompt: "On alltime-athletics.com open the men's 100 m all-time list (\"Men's 100m\"). In the main list at the top of the page, which includes one line per performance (so an athlete can appear on several lines), how many DIFFERENT athletes have a recorded performance of 9.74 seconds or faster? Answer with the number only.",
  compute: athletics, fmt: (t) => `${t.athletes} athletes over ${t.lines} lines`, judge: (line, t) => nearFirst(line, t.athletes, 0),
  right: (t) => String(t.athletes), wrong: (t) => String(t.athletes + 4),
  evidence: [visited("alltime-athletics", /alltime-athletics\.com/i)],
  forbidden: /\.json\b|\/api\//i,
  workflow: wf("The list is one static page; loading it is the interface."),
});

// ---------- g28: PubMed, two years of the same filtered query ----------
const pubmedYear = async (y: number) => {
  const h = await page(`https://pubmed.ncbi.nlm.nih.gov/?term=intermittent+fasting&filter=years.${y}-${y}&filter=pubt.randomizedcontrolledtrial`, 3000);
  const m = h.match(/<span class="value">([\d,]+)/); if (!m) throw new Error("pubmed " + y); return Number(m[1].replace(/,/g, ""));
};
add({
  id: "g28", title: "PubMed: intermittent fasting RCTs, 2023 versus 2015",
  prompt: "On PubMed (pubmed.ncbi.nlm.nih.gov) search for: intermittent fasting. Filter by Article Type = Randomized Controlled Trial, and use the publication date filter to look at a single year. How many results are there for the year 2023, how many for the year 2015, and by how many did 2023 exceed 2015? Answer as `count 2023; count 2015; difference`.",
  compute: async () => { const a = await pubmedYear(2023), b = await pubmedYear(2015); return { a, b, d: a - b }; },
  fmt: (t) => `${t.a}; ${t.b}; ${t.d}`, judge: (line, t) => { const n = numsIn(line); return Math.abs(n[0] - t.a) <= 3 && Math.abs(n[1] - t.b) <= 2 && Math.abs(n[2] - t.d) <= 4; },
  right: (t) => `${t.a}; ${t.b}; ${t.d}`, wrong: (t) => `${t.b}; ${t.a}; ${-t.d}`,
  evidence: [visited("pubmed", /pubmed\.ncbi\.nlm\.nih\.gov/i)],
  forbidden: /eutils|api\.ncbi|\/api\/|format=pubmed|\.json\b/i,
  workflow: wf("PubMed filters live in the URL query; a deep link with them is the filtered search page."),
});

// ---------- g29: Rightmove area, detached minus terraced ----------
const rmTypes = async () => {
  const h = txt(await page("https://www.rightmove.co.uk/house-prices/leeds.html", 2500, true));
  const t = h.match(/Terraced properties sold for an average of £([\d,]+)/)?.[1], d = h.match(/detached properties fetching £([\d,]+)/)?.[1];
  if (!t || !d) throw new Error("rightmove types");
  return { terraced: Number(t.replace(/,/g, "")), detached: Number(d.replace(/,/g, "")), diff: Number(d.replace(/,/g, "")) - Number(t.replace(/,/g, "")) };
};
add({
  id: "g29", title: "Rightmove Leeds: detached versus terraced average gap",
  prompt: "On Rightmove's house prices section (rightmove.co.uk) open the area page for Leeds. The summary at the top gives average prices by property type. How many pounds more is the average detached price than the average terraced price (detached minus terraced)? Answer with the number only (digits, no currency sign).",
  compute: rmTypes, fmt: (t) => `${t.detached}-${t.terraced}=${t.diff}`, judge: (line, t) => nearFirst(line, t.diff, 4000),
  right: (t) => String(t.diff), wrong: (t) => String(t.diff + 80000),
  evidence: [visited("rightmove leeds", /rightmove\.co\.uk\/house-prices/i)],
  forbidden: /\.json\b|\/api\/|_next\/data/i,
  workflow: wf("The area summary is on the area's own page; searching for Leeds or loading the URL both show it."),
});

// ---------- g30: Box Office Mojo domestic 2018, one distributor ----------
const bomDomestic = async () => {
  const h = await page("https://www.boxofficemojo.com/year/2018/", 2000);
  const out: { rank: number; title: string; gross: number; dist: string }[] = [];
  for (const r of rows(h)) { const c = cells(r); if (/^\d+$/.test(c[0] ?? "") && c.length >= 10) out.push({ rank: +c[0], title: c[1], gross: money(c[5]), dist: c[9] }); }
  const top = out.slice(0, 10); const d = top.filter((x) => /Walt Disney/i.test(x.dist));
  return { n: d.length, sum: d.reduce((a, b) => a + b.gross, 0), titles: d.map((x) => x.title) };
};
add({
  id: "g30", title: "Box Office Mojo: Disney titles among the 2018 domestic top 10",
  prompt: "On Box Office Mojo (boxofficemojo.com) open the Domestic yearly chart for 2018. Among the ten releases ranked 1 to 10, how many were distributed by Walt Disney Studios Motion Pictures, and what is the combined value of their \"Gross\" column (the 2018 gross column, not the lifetime total) in dollars? Answer as `count; total dollars` (digits only for the dollars).",
  compute: bomDomestic, fmt: (t) => `${t.n}; ${t.sum}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.n && Math.abs(n[1] - t.sum) <= 1; },
  right: (t) => `${t.n}; ${t.sum}`, wrong: (t) => `${t.n + 1}; ${t.sum}`,
  evidence: [visited("box office mojo", /boxofficemojo\.com/i)],
  forbidden: /\.json\b|\/api\/|imdb\.com\/api/i,
  workflow: wf("The domestic yearly chart is a server-rendered page; loading the 2018 URL is the chart."),
});

// ---------- g31: bustimes.org region page ----------
const busRegion = async () => {
  const h = await page("https://bustimes.org/regions/EA", 1500);
  const ops = new Set([...h.matchAll(/href="\/operators\/([^"]+)"/g)].map((m) => m[1])).size;
  const areas = new Set([...h.matchAll(/href="\/(?:areas|localities)\/([^"]+)"/g)].map((m) => m[1])).size;
  return { ops, areas };
};
add({
  id: "g31", title: "bustimes.org: East Anglia operators and areas",
  prompt: "On bustimes.org (UK bus times) open the East Anglia region page. How many bus operators are listed under \"Operators in East Anglia\", and how many areas are listed under \"Areas in East Anglia\"? Answer as `operators; areas`.",
  compute: busRegion, fmt: (t) => `${t.ops}; ${t.areas}`, judge: (line, t) => { const n = numsIn(line); return Math.abs(n[0] - t.ops) <= 1 && n[1] === t.areas; },
  right: (t) => `${t.ops}; ${t.areas}`, wrong: (t) => `${t.ops + 9}; ${t.areas}`,
  evidence: [visited("bustimes", /bustimes\.org/i)],
  forbidden: /\.json\b|\/api\/|\/vehicles\.json|\/stops\.json/i,
  workflow: wf("The region page is a server-rendered page of the site; browsing from the home page to the region or loading its URL both show the lists."),
});

// ---------- g32: Repology ripgrep versions ----------
const repology = async () => {
  const h = await page("https://repology.org/project/ripgrep/versions", 3000);
  const vs: Record<string, number> = {};
  for (const r of rows(h)) { const c = cells(r); if (c[1] === "ripgrep") vs[c[2]] = (vs[c[2]] ?? 0) + 1; }
  return { c1411: vs["14.1.1"] ?? 0, total: Object.values(vs).reduce((a, b) => a + b, 0) };
};
add({
  id: "g32", title: "Repology: repositories shipping ripgrep 14.1.1",
  prompt: "On repology.org open the page for the project ripgrep and its Versions tab (the table of repositories, package names and versions). Count the table rows whose Package name is exactly \"ripgrep\" and whose Version is exactly 14.1.1. Answer with the number only.",
  compute: repology, fmt: (t) => `${t.c1411} of ${t.total}`, judge: (line, t) => nearFirst(line, t.c1411, 2),
  right: (t) => String(t.c1411), wrong: (t) => String(t.c1411 + 12),
  evidence: [visited("repology", /repology\.org/i)],
  forbidden: /repology\.org\/api|\.json\b|\/api\//i,
  workflow: wf("The versions tab is a page of the site (/project/<name>/versions); loading it is the interface."),
});

// ---------- g33: AFDC state pages, EV chargers per 1,000 EVs ----------
const afdc = async (st: string) => {
  const h = await page(`https://afdc.energy.gov/states/${st}`, 2000);
  let ports = NaN, evs = NaN;
  for (const r of rows(h)) { const c = cells(r); if (/^Electric \(charging ports\)/.test(c[0])) ports = Number(c[1].replace(/,/g, "")); if (/^Electric \(EV\)/.test(c[0])) evs = Number(c[1].replace(/,/g, "")); }
  if (!Number.isFinite(ports) || !Number.isFinite(evs)) throw new Error("afdc " + st);
  return { ports, evs, ratio: (ports / evs) * 1000 };
};
add({
  id: "g33", title: "AFDC: public EV charging ports per 1,000 EVs, California vs Texas",
  prompt: "On the U.S. Department of Energy's Alternative Fuels Data Center (afdc.energy.gov) open the state pages for California and Texas. For each, take the number of PUBLIC \"Electric (charging ports)\" from the stations table and the number of registered \"Electric (EV)\" vehicles (battery electric only) from the registrations table. Compute public charging ports per 1,000 registered EVs for each state. Which state has the higher ratio, and what is that ratio rounded to one decimal? Answer as `State; ratio`.",
  compute: async () => ({ ca: await afdc("ca"), tx: await afdc("tx") }),
  fmt: (t) => `CA ${t.ca.ratio.toFixed(2)} TX ${t.tx.ratio.toFixed(2)}`,
  judge: (line, t) => { const hi = t.ca.ratio >= t.tx.ratio ? ["California", t.ca.ratio] : ["Texas", t.tx.ratio]; return has(line, hi[0] as string) && near(line, hi[1] as number, 0.35); },
  right: (t) => (t.ca.ratio >= t.tx.ratio ? `California; ${t.ca.ratio.toFixed(1)}` : `Texas; ${t.tx.ratio.toFixed(1)}`), wrong: (t) => (t.ca.ratio >= t.tx.ratio ? `Texas; ${t.ca.ratio.toFixed(1)}` : `California; ${t.tx.ratio.toFixed(1)}`),
  evidence: [visited("afdc", /afdc\.energy\.gov/i)],
  forbidden: /developer\.nrel|api\.data\.gov|\.json\b|\/api\/|\.csv\b/i,
  workflow: wf("Each state page (afdc.energy.gov/states/<code>) has the stations and registrations tables; loading the two pages is the interface."),
});

// ---------- g34: countryeconomy.com, Spain + Portugal population ----------
const popCE = async (c: string) => {
  const h = await page(`https://countryeconomy.com/demography/population/${c}`, 2000, true);
  for (const r of rows(h)) { const x = cells(r); if (x[0] === "December 2015" || x[0] === "2015") return { male: Number(x[2].replace(/,/g, "")), female: Number(x[3].replace(/,/g, "")), total: Number(x[4].replace(/,/g, "")) }; }
  throw new Error("ce " + c);
};
add({
  id: "g34", title: "countryeconomy.com: Spain plus Portugal population, December 2015",
  prompt: "On countryeconomy.com open the demography/population tables for Spain and for Portugal. Using the row for December 2015 in each table (Portugal's table may label it simply 2015), what is the combined total population of Spain and Portugal, and how many more women than men does Spain's row show? Answer as `combined population; Spain women minus men` (digits only).",
  compute: async () => { const s = await popCE("spain"), p = await popCE("portugal"); return { s, p, total: s.total + p.total, gap: s.female - s.male }; },
  fmt: (t) => `${t.total}; ${t.gap}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.total && n[1] === t.gap; },
  right: (t) => `${t.total}; ${t.gap}`, wrong: (t) => `${t.total}; ${t.gap + 100000}`,
  evidence: [visited("countryeconomy", /countryeconomy\.com/i)],
  forbidden: /\.json\b|\/api\/|\.csv\b|\.xls/i,
  workflow: wf("Each country's population table is a page of the site; loading the two pages is the interface."),
});

// ---------- g35: FIDE juniors tab ----------
const fideJuniors = async () => {
  const h = await page("https://ratings.fide.com/a_top.php?list=juniors", 2000);
  return rows(h).map((r) => { const m = r.match(/(?:rank_span">)?(\d+)<[\s\S]*?<a [^>]*>([^<]+)<\/a>[\s\S]*?([A-Z]{3})\s*<\/td>[\s\S]*?rating_column>(\d+)<[\s\S]*?bday_column>(\d{4})</); return m ? { name: dec(m[2]).trim(), fed: m[3], rating: +m[4], year: +m[5] } : null; }).filter(Boolean) as { name: string; fed: string; rating: number; year: number }[];
};
add({
  id: "g35", title: "FIDE juniors tab: youngest cohort and its best rating",
  prompt: "On the FIDE world top players page (ratings.fide.com/top_lists.phtml) open the Juniors tab (top juniors, not the open list). Using the B-Year (birth year) column, how many of the listed players were born in 2008 or later, and what is the highest standard rating among those players? Answer as `count; rating`.",
  compute: async () => { const l = await fideJuniors(); const y = l.filter((p) => p.year >= 2008); return { n: y.length, best: Math.max(0, ...y.map((p) => p.rating)), all: l.length }; },
  fmt: (t) => `${t.n}; ${t.best} (of ${t.all})`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.n && n[1] === t.best; },
  right: (t) => `${t.n}; ${t.best}`, wrong: (t) => `${t.n + 4}; ${t.best}`,
  evidence: [visited("fide top lists", /ratings\.fide\.com/i)],
  forbidden: /a_top\.php|\.json\b|\/api\//i,
  workflow: wf("The Juniors list is a tab of the top lists page whose content the page loads itself; the prompt asks to open that tab, so the run must show the tab being operated.", [interacted("tab/control interaction on fide top lists")]),
});

// ---------- g36: Walk Score cities table ----------
const wsCities = async () => {
  const h = await page("https://www.walkscore.com/cities-and-neighborhoods/", 2000);
  const out: { city: string; st: string; bike: number; pop: number }[] = [];
  for (const r of rows(h)) { const c = cells(r); if (c.length >= 6 && /^[A-Z]{2}$/.test(c[1]) && /^[\d.]+$/.test(c[2])) out.push({ city: c[0], st: c[1], bike: Number(c[4]), pop: Number(c[5].replace(/,/g, "")) }); }
  return out;
};
const wsBig = (t: any[]) => [...t.filter((x) => x.pop >= 1_000_000)].sort((a, b) => b.bike - a.bike);
add({
  id: "g36", title: "Walk Score cities table: best Bike Score among million-plus cities",
  prompt: "On walkscore.com open the table of cities (the Cities and Neighborhoods ranking with Walk Score, Transit Score, Bike Score and Population columns). Considering only cities with a population of at least 1,000,000, which city has the highest Bike Score, and what is that Bike Score? Answer as `City; score`.",
  compute: wsCities, fmt: (t) => { const b = wsBig(t); return `${b[0].city}; ${b[0].bike} (of ${b.length} big cities)`; },
  judge: (line, t) => { const b = wsBig(t); return has(line, b[0].city) && near(line, b[0].bike, 0.05); },
  right: (t) => { const b = wsBig(t); return `${b[0].city}; ${b[0].bike}`; }, wrong: (t) => { const b = wsBig(t); return `${b[b.length - 1].city}; ${b[b.length - 1].bike}`; },
  evidence: [visited("walkscore cities", /walkscore\.com/i)],
  forbidden: /\.json\b|\/api\/|api\.walkscore/i,
  workflow: wf("The ranking table is a page of the site; loading it is the interface."),
});

// ---------- g37: Mathematics Genealogy descendants ----------
const mgpDesc = async (id: number) => {
  const h = txt(await page(`https://www.mathgenealogy.org/id.php?id=${id}`, 1200));
  const m = h.match(/has (\d[\d,]*) students? and (\d[\d,]*) descendants?/); if (!m) throw new Error("mgp desc " + id);
  return { students: Number(m[1].replace(/,/g, "")), desc: Number(m[2].replace(/,/g, "")) };
};
add({
  id: "g37", title: "Mathematics Genealogy: descendants of Gauss versus Church",
  prompt: "On the Mathematics Genealogy Project (mathgenealogy.org) open the records of Carl Friedrich Gauß (id 18231) and Alonzo Church (id 8011). Each record states how many students and descendants the person has. Who has more descendants, and by how many (the difference in descendants)? Answer as `Name; difference`.",
  compute: async () => { const g = await mgpDesc(18231), c = await mgpDesc(8011); return { g, c }; },
  fmt: (t) => `${t.g.desc >= t.c.desc ? "Gauss" : "Church"}; ${Math.abs(t.g.desc - t.c.desc)}`,
  judge: (line, t) => { const w = t.g.desc >= t.c.desc ? "Gau" : "Church"; return has(line, w) && near(line, Math.abs(t.g.desc - t.c.desc), 30); },
  right: (t) => `${t.g.desc >= t.c.desc ? "Carl Friedrich Gauß" : "Alonzo Church"}; ${Math.abs(t.g.desc - t.c.desc)}`, wrong: (t) => `${t.g.desc >= t.c.desc ? "Alonzo Church" : "Carl Friedrich Gauß"}; ${Math.abs(t.g.desc - t.c.desc)}`,
  evidence: [visited("mathgenealogy", /mathgenealogy\.org/i)],
  forbidden: /\.json\b|\/api\/|query-prep|\.xml\b/i,
  workflow: wf("Each person is a server-rendered record page; loading the two records is the interface."),
});

// ---------- g38: Bank of Russia, EUR rate move between two dates ----------
const cbrEur = async (d: string) => {
  const h = await page(`https://www.cbr.ru/currency_base/daily/?UniDbQuery.Posted=True&UniDbQuery.To=${d}`, 1500);
  for (const r of rows(h)) { const c = cells(r); if (c[1] === "EUR") return Number(c[4].replace(",", ".")) / Number(c[2]); }
  throw new Error("cbr eur " + d);
};
add({
  id: "g38", title: "Bank of Russia: change in the official EUR rate between two dates",
  prompt: "On the Bank of Russia website (cbr.ru) use the official exchange rates table for a given date (\"Официальные курсы валют на заданную дату\"). Look up the official rate of the euro (EUR) on 1 March 2022 and on 15 March 2022. By how many roubles per euro did the official rate change between those two dates (15 March minus 1 March; give a negative number if it fell)? Answer with the number to two decimals.",
  compute: async () => { const a = await cbrEur("01.03.2022"), b = await cbrEur("15.03.2022"); return { a, b, d: Math.round((b - a) * 10000) / 10000 }; },
  fmt: (t) => `${t.b}-${t.a}=${t.d}`, judge: (line, t) => { const m = line.replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/); return !!m && Math.abs(Number(m[0]) - t.d) <= 0.03; },
  right: (t) => t.d.toFixed(2), wrong: (t) => (t.d + 6).toFixed(2),
  evidence: [visited("cbr.ru", /cbr\.ru/i)],
  forbidden: /cbr\.ru\/(?:scripts|dataservice|api)|\.xml\b|\.json\b|XML_daily/i,
  workflow: wf("The date is a query parameter of the rates page (UniDbQuery.To); loading the two dated URLs is the rates page for those dates."),
});

// ---------- g39: Debian package page, installed size ----------
const debSize = async (suite: string) => {
  const h = txt(await page(`https://packages.debian.org/${suite}/curl`, 2000));
  const m = h.match(/amd64 ([\d.,]+) kB ([\d.,]+) kB/); if (!m) throw new Error("deb size " + suite);
  return Number(m[2].replace(/,/g, ""));
};
add({
  id: "g39", title: "Debian package pages: curl installed size, bookworm versus trixie",
  prompt: "On packages.debian.org open the package page for curl in the bookworm suite and in the trixie suite. In the table \"Download curl\" use the Installed Size shown for the amd64 architecture (in kB) in each suite. How many kB larger is the trixie installed size than the bookworm one (trixie minus bookworm; negative if smaller)? Answer with the number only.",
  compute: async () => { const a = await debSize("bookworm"), b = await debSize("trixie"); return { a, b, d: Math.round((b - a) * 10) / 10 }; },
  fmt: (t) => `${t.b}-${t.a}=${t.d}`, judge: (line, t) => { const m = line.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/); return !!m && Math.abs(Number(m[0]) - t.d) <= 0.11; },
  right: (t) => String(t.d), wrong: (t) => String(t.d + 50),
  evidence: [visited("debian packages", /packages\.debian\.org/i)],
  forbidden: /sources\.debian|api\.ftp-master|\.json\b|\/api\/|snapshot\.debian/i,
  workflow: wf("Each suite's package page is a page of the site (/<suite>/curl); searching or loading those URLs both reach the table."),
});

// ---------- g40: NHS medicines A to Z ----------
const nhsMeds = async () => {
  const h = await page("https://www.nhs.uk/medicines/", 1500);
  const i = h.indexOf('id="p"'); if (i < 0) throw new Error("meds p");
  const nxt = h.indexOf("<h2", i + 10); const seg = h.slice(i, nxt > 0 ? nxt : i + 80000);
  const items = [...seg.matchAll(/<li>\s*<a [^>]*>([\s\S]*?)<\/a>/g)].map((m) => dec(m[1]).replace(/\s+/g, " ").trim());
  return { n: items.length, kids: items.filter((x) => /children|child/i.test(x)).length };
};
add({
  id: "g40", title: "NHS medicines A to Z: entries under P and how many mention children",
  prompt: "On the NHS website (nhs.uk) open the \"Medicines A to Z\" list. Look at the section for the letter P. How many medicine entries are listed under P, and how many of those have a label that mentions \"children\" or \"child\"? Answer as `total; mentioning children`.",
  compute: nhsMeds, fmt: (t) => `${t.n}; ${t.kids}`, judge: (line, t) => { const n = numsIn(line); return n[0] === t.n && n[1] === t.kids; },
  right: (t) => `${t.n}; ${t.kids}`, wrong: (t) => `${t.n - 2}; ${t.kids}`,
  evidence: [visited("nhs medicines", /nhs\.uk\/medicines/i)],
  forbidden: /\.json\b|\/api\/|api\.nhs/i,
  workflow: wf("The medicines A to Z list is one server-rendered page; loading it is the interface."),
});

// ---------- g25: MIT catalog, Institute LAB subjects in Course 6 ----------
const mitLab = async () => {
  const h = txt(await page("https://catalog.mit.edu/subjects/6/", 1500));
  return [...h.matchAll(/units\.\s*Institute LAB/g)].length;
};
add({
  id: "g25", title: "MIT catalog: Course 6 subjects designated Institute LAB",
  prompt: "In the MIT Course Catalog (catalog.mit.edu), open the Electrical Engineering and Computer Science (Course 6) subjects listing. Some subjects carry the designation \"Institute LAB\" right after their units line (for example \"2-4-6 units. Institute LAB\"). How many subjects on that listing carry the Institute LAB designation? Answer with the number only.",
  compute: mitLab, fmt: (t) => String(t), judge: (line, t) => nearFirst(line, t, 0),
  right: (t) => String(t), wrong: (t) => String(t + 5),
  evidence: [visited("mit catalog", /catalog\.mit\.edu/i)],
  forbidden: /\.json\b|\/api\//i,
  workflow: wf("The Course 6 subject listing is one catalog page; loading it or using the catalog's page search both show the designations."),
});
