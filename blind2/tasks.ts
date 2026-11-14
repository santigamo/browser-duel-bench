// blind2 suite: c1..c20. Real public sites, truth computed live from an authoritative source at prepare and check time.
import { live, visited, getText, getJson, strip, numsIn, datesIn, dayDiff } from "../blind/lib.ts";
import type { Task, Workflow } from "../src/tasks.ts";
import type { Samples } from "../src/scoring.ts";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&amp;/g, "&").replace(/[^a-z0-9.&]+/g, " ").trim();
const nums = (s: string) => numsIn(s.replace(/−/g, "-"));
const near = (line: string, x: number, tol: number) => nums(line).some((n) => Math.abs(n - x) <= tol);
const has = (line: string, name: string, n = 40) => norm(line).includes(norm(name).slice(0, n));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function jsonRetry(url: string, bad?: (j: any) => boolean, init: RequestInit = {}) {
  let e: any;
  for (let i = 0; i < 4; i++) {
    try { const j = await getJson(url, init); if (!bad || !bad(j)) return j; e = new Error("bad payload " + url); } catch (x) { e = x; }
    await sleep(1500 * (i + 1));
  }
  throw e;
}
const FIN = "final answer on the last line as `ANSWER: ...`";
const T = (id: string, title: string, prompt: string, lv: any, evidence: any[], extra: Partial<Task> = {}): Task =>
  ({ id, suite: "blind2", title, prompt: () => `${prompt}\n\nYour ${FIN}`, ...lv, evidence, ...extra }) as Task;

// ---- c1 meal database: alphabetically last seafood meal, ingredient count
const c1 = live(async () => {
  const l = (await jsonRetry("https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood")).meals as any[];
  const last = [...l].sort((a, b) => a.strMeal.toLowerCase().localeCompare(b.strMeal.toLowerCase())).pop();
  const m = (await jsonRetry("https://www.themealdb.com/api/json/v1/1/lookup.php?i=" + last.idMeal)).meals[0];
  let n = 0; for (let i = 1; i <= 20; i++) if ((m["strIngredient" + i] ?? "").trim()) n++;
  return { name: last.strMeal as string, n, total: l.length };
}, (t) => `${t.name} | ${t.n}`, (line, t) => has(line, t.name, 14) && nums(line.replace(t.name, "")).includes(t.n));

// ---- c2 gutenberg: top Dickens in 30-day list, release date
const c2 = live(async () => {
  const h = await getText("https://www.gutenberg.org/browse/scores/top");
  const sec = h.slice(h.indexOf('id="books-last30"')); const ol = sec.slice(0, sec.indexOf("</ol>"));
  const items = [...ol.matchAll(/<li><a href="\/ebooks\/(\d+)">(.*?) \((\d+)\)<\/a>/g)].map((m) => ({ id: m[1], text: strip(m[2]) }));
  const idx = items.findIndex((x) => /by Charles Dickens$/.test(x.text));
  if (idx < 0) throw new Error("no Dickens in top list");
  const title = items[idx].text.replace(/ by Charles Dickens$/, "");
  const page = strip(await getText("https://www.gutenberg.org/ebooks/" + items[idx].id));
  const date = datesIn(page.slice(page.indexOf("Release Date")).slice(0, 60))[0];
  if (!date) throw new Error("no release date");
  return { rank: idx + 1, title, date };
}, (t) => `${t.title} | ${t.rank} | ${t.date}`, (line, t) => has(line, t.title.split(/[;:]/)[0], 25) && datesIn(line).includes(t.date) && nums(line.replace(/\d{4}-\d\d-\d\d/g, "")).includes(t.rank));

// ---- c3 open library: edition count
const c3 = live(async () => {
  const j = await jsonRetry("https://openlibrary.org/search.json?q=title%3Akindred+author%3Abutler&fields=key,title,edition_count,first_publish_year,author_name&limit=10");
  const d = j.docs.find((x: any) => x.title === "Kindred" && x.first_publish_year === 1979);
  if (!d) throw new Error("work not found");
  return d.edition_count as number;
}, (n) => String(n), (line, n) => near(line, n, 2));

// ---- c4 usgs: largest quake in 30 days
const c4 = live(async () => {
  const s = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const j = await jsonRetry(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${s}&orderby=magnitude&limit=1`);
  const f = j.features[0].properties;
  return { mag: f.mag as number, place: f.place as string };
}, (t) => `M${t.mag} ${t.place}`, (line, t) => {
  const region = t.place.includes(",") ? t.place.split(",").pop()!.trim() : t.place.replace(/^.* of /, "");
  return near(line, t.mag, 0.051) && has(line, region, 20);
});

// ---- c5 tfl: tube lines with good service
const c5 = live(async () => {
  const j = await jsonRetry("https://api.tfl.gov.uk/Line/Mode/tube/Status");
  return j.filter((l: any) => l.lineStatuses.every((s: any) => s.statusSeverity === 10)).length as number;
}, (n) => String(n), (line, n) => { const x = nums(line); return x.length === 1 && Math.abs(x[0] - n) <= 1; });

// ---- c6 tvmaze: seasons and latest aired episode
const c6 = live(async () => {
  const show = await jsonRetry("https://api.tvmaze.com/singlesearch/shows?q=slow%20horses");
  const eps = (await jsonRetry(`https://api.tvmaze.com/shows/${show.id}/episodes`)) as any[];
  const seasons = Math.max(...eps.map((e) => e.season));
  const now = Date.now(), today = new Date().toISOString().slice(0, 10);
  const aired = eps.filter((e) => e.airstamp && Date.parse(e.airstamp) <= now).sort((a, b) => Date.parse(a.airstamp) - Date.parse(b.airstamp));
  const titles = new Set<string>();
  if (aired.length) titles.add(aired[aired.length - 1].name);
  const upToToday = eps.filter((e) => e.airdate && e.airdate <= today).sort((a, b) => (a.airdate + a.number).localeCompare(b.airdate + b.number));
  if (upToToday.length) titles.add(upToToday[upToToday.length - 1].name);
  return { seasons, titles: [...titles] };
}, (t) => `${t.seasons} | ${t.titles.join(" / ")}`, (line, t) => nums(line.replace(/[^\n]*/, (m) => m)).includes(t.seasons) && t.titles.some((x) => has(line, x, 30)));

// ---- c7 open food facts: sugars compare
const C7 = ["3017620422003", "8000500310427", "5449000000996"];
const c7 = live(async () => {
  const out: Record<string, number> = {};
  for (const c of C7) { const j = await jsonRetry(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=nutriments`); out[c] = j.product.nutriments.sugars_100g; }
  const top = Object.entries(out).sort((a, b) => b[1] - a[1])[0][0], low = Object.entries(out).sort((a, b) => a[1] - b[1])[0][0];
  return { top, diff: +(out[top] - out[low]).toFixed(2), out };
}, (t) => `${t.top} | ${t.diff}`, (line, t) => line.includes(t.top) && near(line.replace(/\d{13}/g, ""), t.diff, 0.6));

// ---- c8 medlineplus: ferritin female range
const c8 = live(async () => {
  const p = strip(await getText("https://medlineplus.gov/ency/article/003490.htm"));
  const m = p.match(/Female:\s*([\d.]+)\s*to\s*([\d.]+)/);
  if (!m) throw new Error("range not found");
  return [Number(m[1]), Number(m[2])] as [number, number];
}, (r) => r.join("-"), (line, r) => { const x = nums(line.replace(/(\d)-(\d)/g, "$1 $2")); return x.includes(r[0]) && x.includes(r[1]); });

// ---- c9 world bank: highest internet use among four countries
const c9 = live(async () => {
  const j = await jsonRetry("https://api.worldbank.org/v2/country/BR;ID;NG;PH/indicator/IT.NET.USER.ZS?format=json&mrnev=1");
  const rows = j[1].filter((r: any) => r.value != null).map((r: any) => ({ c: r.country.value as string, v: r.value as number }));
  if (rows.length < 4) throw new Error("missing data");
  rows.sort((a: any, b: any) => b.v - a.v);
  return rows[0] as { c: string; v: number };
}, (t) => `${t.c} ${t.v.toFixed(1)}`, (line, t) => has(line, t.c) && near(line, t.v, 1.5));

// ---- c10 federal register: filtered count
const c10 = live(async () => {
  const u = "https://www.federalregister.gov/api/v1/documents.json?conditions[agencies][]=environmental-protection-agency&conditions[type][]=RULE&conditions[publication_date][gte]=2026-10-01&conditions[publication_date][lte]=2026-10-31&per_page=1";
  return (await jsonRetry(u)).count as number;
}, (n) => String(n), (line, n) => { const x = nums(line); return x.length === 1 && x[0] === n; });

// ---- c11 ecb: cross rate NOK -> THB
const c11 = live(async () => {
  const x = await getText("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
  const r = (c: string) => Number(x.match(new RegExp(`currency='${c}' rate='([\\d.]+)'`))![1]);
  return +(2000 / r("NOK") * r("THB")).toFixed(2);
}, (v) => String(v), (line, v) => near(line, v, v * 0.006));

// ---- c12 national weather service: first weekday-named daytime high
const c12 = live(async () => {
  const pt = await jsonRetry("https://api.weather.gov/points/61.2181,-149.9003", undefined, { headers: { accept: "application/geo+json" } });
  const f = await jsonRetry(pt.properties.forecast, undefined, { headers: { accept: "application/geo+json" } });
  const p = f.properties.periods.find((x: any) => x.isDaytime && /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(x.name));
  return { name: p.name as string, t: p.temperature as number };
}, (t) => `${t.name} ${t.t}F`, (line, t) => near(line, t.t, 4));

// ---- c13 nps: sum of private vehicle fees
const c13 = live(async () => {
  let sum = 0;
  for (const p of ["yose", "arch", "zion", "grca"]) {
    const m = strip(await getText(`https://www.nps.gov/${p}/planyourvisit/fees.htm`)).match(/Private Vehicle \$([\d.]+)/);
    if (!m) throw new Error("fee not found " + p);
    sum += Number(m[1]);
  }
  return sum;
}, (n) => String(n), (line, n) => nums(line).includes(n));

// ---- c14 wikipedia categories: most pages directly in category
const c14 = live(async () => {
  const names = ["Denmark", "Latvia", "Iceland", "Estonia"];
  const j = await jsonRetry("https://en.wikipedia.org/w/api.php?action=query&prop=categoryinfo&format=json&titles=" + names.map((n) => "Category:Lighthouses_in_" + n).join("|"));
  const rows = Object.values(j.query.pages).map((p: any) => ({ c: p.title.replace("Category:Lighthouses in ", "") as string, n: p.categoryinfo.pages as number })).sort((a, b) => b.n - a.n);
  return rows[0];
}, (t) => `${t.c} ${t.n}`, (line, t) => has(line, t.c) && near(line, t.n, 1));

// ---- c15 world cube association: competitions in a country and year
const c15 = live(async () => {
  const j = await jsonRetry("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=PT&start=2025-01-01&end=2025-12-31&per_page=100");
  return j.filter((c: any) => !c.cancelled_at).length as number;
}, (n) => String(n), (line, n) => { const x = nums(line); return x.length === 1 && Math.abs(x[0] - n) <= 2; });

// ---- c16 numbeo: rent ratio across four cities
const c16 = live(async () => {
  const rows: { c: string; v: number; cur: string }[] = [];
  for (const c of ["Lisbon", "Prague", "Vienna", "Warsaw"]) {
    const t = strip(await getText("https://www.numbeo.com/cost-of-living/in/" + c + "?displayCurrency=EUR")).replace(/&#\d+;|&nbsp;/g, " ");
    const m = t.match(/1 Bedroom Apartment in City Centre\s*([^\d\s]{0,3})\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z]{0,3})/);
    if (!m) throw new Error("rent not found " + c);
    rows.push({ c, v: Number(m[2].replace(/,/g, "")), cur: m[1] + m[3] });
    await sleep(700);
  }
  if (new Set(rows.map((r) => r.cur)).size > 1) throw new Error("mixed currencies");
  rows.sort((a, b) => a.v - b.v);
  return { low: rows[0].c, ratio: +(rows[3].v / rows[0].v).toFixed(2) };
}, (t) => `${t.low} ${t.ratio}`, (line, t) => has(line, t.low) && near(line, t.ratio, 0.1));

// ---- c17 nobel: chemistry 2010-2019 laureates and women
const c17 = live(async () => {
  const j = await jsonRetry("https://api.nobelprize.org/2.1/laureates?nobelPrizeCategory=che&nobelPrizeYear=2010&yearTo=2019&limit=100");
  const l = j.laureates as any[];
  return { n: l.length, w: l.filter((x) => x.gender === "female").length };
}, (t) => `${t.n}, ${t.w}`, (line, t) => { const x = nums(line); return x.length === 2 && x[0] === t.n && x[1] === t.w; });

// ---- c18 goodreads choice awards: category with most votes
const c18 = live(async () => {
  const rows: { c: string; v: number }[] = [];
  for (const [c, s] of [["Mystery & Thriller", "mystery-thriller"], ["Romance", "romance"], ["Horror", "horror"]]) {
    const t = strip(await getText(`https://www.goodreads.com/choiceawards/readers-favorite-${s}-books-2024`));
    const m = t.match(/([\d,]+)\s*votes total/);
    if (!m) throw new Error("votes not found " + s);
    rows.push({ c, v: Number(m[1].replace(/,/g, "")) });
  }
  return rows.sort((a, b) => b.v - a.v)[0];
}, (t) => `${t.c} ${t.v}`, (line, t) => has(line, t.c.split(" ")[0], 8) && nums(line).includes(t.v));

// ---- c19 noaa tides: higher high tide time on a date
const c19 = live(async () => {
  const j = await jsonRetry("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=blind2&begin_date=20261215&end_date=20261215&datum=MLLW&station=9447130&time_zone=lst_ldt&units=english&interval=hilo&format=json", (x) => !x.predictions);
  const h = j.predictions.filter((p: any) => p.type === "H" || p.type === "HH").sort((a: any, b: any) => Number(b.v) - Number(a.v))[0];
  return { time: h.t.slice(11, 16) as string, ft: Number(h.v) };
}, (t) => `${t.time} ${t.ft}ft`, (line, t) => {
  const m = line.match(/\b(\d{1,2}):(\d\d)\b/); if (!m) return false;
  const mins = Number(m[1]) * 60 + Number(m[2]), tm = Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3));
  return Math.abs(mins - tm) <= 10 && near(line.replace(m[0], ""), t.ft, 0.15);
});

// ---- c20 bbc sport: premier league table 5th to 10th
const c20 = live(async () => {
  const h = await getText("https://www.bbc.com/sport/football/premier-league/table");
  const rows = [...h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1])));
  const tab = rows.filter((r) => r.length >= 9 && /^\d+\D/.test(r[0])).map((r) => { const m = r[0].match(/^(\d+)(.*)$/)!; return { pos: Number(m[1]), team: m[2].trim().replace(/&amp;/g, "&"), gd: Number(r[7].replace(/[\u2212\u2013]/g, "-")), pts: Number(r[8]) }; });
  if (tab.length < 10) throw new Error("table not parsed " + rows.length);
  const best = tab.filter((r) => r.pos >= 5 && r.pos <= 10).sort((a, b) => b.gd - a.gd || a.pos - b.pos)[0];
  return { team: best.team, pts: best.pts };
}, (t) => `${t.team} ${t.pts}`, (line, t) => has(line, t.team.split(" ")[0], 12) && nums(line).includes(t.pts));

const ev = (name: string, re: RegExp) => visited(name, re);
export const blind2: Task[] = [
  T("c1", "meal db category", "On the recipe website TheMealDB, browse the Seafood category. Find the meal whose name comes last in alphabetical order, open its page and count how many ingredients it lists. Give the meal name and that number, separated by ' | '.", c1, [ev("themealdb", /themealdb\.com/i)]),
  T("c2", "gutenberg top list", "On Project Gutenberg's Top 100 page, in the list of most downloaded EBooks over the last 30 days, find the highest-ranked book written by Charles Dickens. Open that book's own page. Give its title, its rank in that list, and its release date as YYYY-MM-DD, separated by ' | '.", c2, [ev("gutenberg", /gutenberg\.org/i), ev("gutenberg-book", /gutenberg\.org\/ebooks\/\d+/i)]),
  T("c3", "open library editions", "On Open Library, find the novel 'Kindred' by Octavia E. Butler (first published 1979, not the 2017 book with the same title) and open the work page. How many editions does the site report for this work? Give a single number.", c3, [ev("openlibrary", /openlibrary\.org/i)]),
  T("c4", "largest recent quake", "Using the US Geological Survey earthquake website, find the largest earthquake worldwide over the past 30 days. Give its magnitude and the place text as listed, separated by ' | '.", c4, [ev("usgs", /earthquake\.usgs\.gov/i)]),
  T("c5", "tube status", "On Transport for London's website, open the status updates for the London Underground. Counting only the Underground lines (not DLR, Overground, Elizabeth line or trams), how many lines currently show plain 'Good service'? Give a single number.", c5, [ev("tfl", /tfl\.gov\.uk/i)]),
  T("c6", "tv show episodes", "On TVmaze, find the series 'Slow Horses'. How many seasons does the site list for it, and what is the title of the most recent episode that has already aired (not one scheduled for the future)? Give the season count and the episode title, separated by ' | '.", c6, [ev("tvmaze", /tvmaze\.com/i)]),
  T("c7", "food sugar compare", "On Open Food Facts, open the product pages for barcodes 3017620422003, 8000500310427 and 5449000000996. Which product has the most sugars per 100 g, and how many grams more sugars per 100 g does it have than the product with the least? Give the barcode and the difference in grams, separated by ' | '.", c7, [ev("off-1", /3017620422003/), ev("off-2", /8000500310427/), ev("off-3", /5449000000996/)]),
  T("c8", "lab test range", "On MedlinePlus (the US National Library of Medicine health site), find the medical encyclopedia article on the ferritin blood test. What is the normal ferritin range for females, in ng/mL? Give it as 'low-high'.", c8, [ev("medlineplus", /medlineplus\.gov/i)]),
  T("c9", "internet use", "On the World Bank Open Data website, look at the indicator 'Individuals using the Internet (% of population)' for Brazil, Indonesia, Nigeria and the Philippines, using the most recent year available for each. Which of the four has the highest value, and what is it (one decimal)? Give the country and the value, separated by ' | '.", c9, [ev("worldbank", /worldbank\.org/i)]),
  T("c10", "federal rules count", "On the Federal Register website, search documents with these filters: agency Environmental Protection Agency, document type Rule, publication date from 2026-10-01 to 2026-10-31. How many documents match? Give a single number.", c10, [ev("federalregister", /federalregister\.gov/i)]),
  T("c11", "currency cross rate", "Using the European Central Bank's euro foreign exchange reference rates page (the latest published rates), work out how many Thai baht 2000 Norwegian krone buy, going through the euro. Round to 2 decimals. Give a single number.", c11, [ev("ecb", /ecb\.europa\.eu/i)]),
  T("c12", "anchorage forecast", "On the US National Weather Service website (weather.gov), look up the forecast for Anchorage, Alaska. Find the first daytime period named after a weekday (like 'Monday', not 'Today' or 'This Afternoon'). What high temperature in degrees Fahrenheit does it forecast? Give a single number.", c12, [ev("weather.gov", /weather\.gov/i)]),
  T("c13", "park fees total", "On the National Park Service website, look at the entrance fees pages for Yosemite, Arches, Zion and Grand Canyon national parks. Add up the 'Private Vehicle' entrance fee of the four parks. Give the total in US dollars as a single number.", c13, [ev("nps-yose", /nps\.gov\/yose/i), ev("nps-arch", /nps\.gov\/arch/i), ev("nps-zion", /nps\.gov\/zion/i), ev("nps-grca", /nps\.gov\/grca/i)]),
  T("c14", "category sizes", "On English Wikipedia, look at these four categories: 'Lighthouses in Denmark', 'Lighthouses in Latvia', 'Lighthouses in Iceland' and 'Lighthouses in Estonia'. Count only the pages listed directly in each category (not subcategories or files). Which country's category has the most pages, and how many? Give the country and the number, separated by ' | '.", c14, [ev("wikipedia", /wikipedia\.org/i)]),
  T("c15", "cubing competitions", "On the World Cube Association website, open the competitions list, filter by region Portugal and show the past competitions of the year 2025. How many competitions are listed? Give a single number.", c15, [ev("wca", /worldcubeassociation\.org/i)]),
  T("c16", "rent ratio", "On Numbeo, compare the cost of living in Lisbon, Prague, Vienna and Warsaw. Show prices in euros (EUR) and look at the price of a 1 Bedroom Apartment in City Centre (monthly rent) in each. Which city is the cheapest, and how many times higher is the most expensive city's rent than the cheapest city's (2 decimals)? Give the city and the ratio, separated by ' | '.", c16, [ev("numbeo-lisbon", /numbeo\.com.*lisbon/i), ev("numbeo-prague", /numbeo\.com.*prague/i), ev("numbeo-vienna", /numbeo\.com.*vienna/i), ev("numbeo-warsaw", /numbeo\.com.*warsaw/i)]),
  T("c17", "nobel chemistry", "On the Nobel Prize website, list the Chemistry laureates for the years 2010 to 2019 inclusive. How many individual laureates are there, and how many of them are women? Give the two numbers separated by a comma, total first.", c17, [ev("nobelprize", /nobelprize\.org/i)]),
  T("c18", "choice awards votes", "On Goodreads, in the Goodreads Choice Awards 2024, look at the categories Mystery & Thriller, Romance and Horror. Which category received the most total votes, and how many? Give the category and the vote count, separated by ' | '.", c18, [ev("goodreads", /goodreads\.com\/choiceawards/i)]),
  T("c19", "seattle high tide", "On NOAA's Tides & Currents website, find the tide predictions for Seattle, Washington (Puget Sound, station 9447130) for 15 December 2026, in feet relative to MLLW and local time. Of the high tides that day, which is the higher one? Give its local clock time in 24-hour HH:MM and its height in feet, separated by ' | '.", c19, [ev("noaa-tides", /tidesandcurrents\.noaa\.gov/i)]),
  T("c20", "league table", "On the BBC Sport Premier League table, look at the clubs ranked 5th to 10th inclusive. Which of them has the best goal difference, and how many points does it have? Give the club name and its points, separated by ' | '.", c20, [ev("bbc-table", /bbc\.(com|co\.uk)\/sport/i)]),
];

// ---- Endpoint policy and workflow rubrics (guard/endpoint-policy.md): the same rule as blind/tasks.ts ----
// Site pages and on-site deep links are allowed; JSON/API data endpoints are forbidden unless the prompt allows them (none does). Before this table c10 had no
// rule at all while b11 (same site, same filters) forbade federalregister.gov/api, and the c-tasks let every run read the checker's own API.
const OL = /openlibrary\.org\/(?:api\/|[^\s"']*\.json)/i;
const GUTENBERG_DATA = /gutenberg\.org\/ebooks\/(?:\d+\.(?:rdf|opds)|search\.opds)|gutenberg\.org\/cache\/epub\/[^\s"']*\.rdf|gutendex\.com/i;
const FORBIDDEN: Record<string, RegExp> = {
  c1: /themealdb\.com\/api\//i,
  c2: GUTENBERG_DATA,
  c3: OL,
  c4: /earthquake\.usgs\.gov\/fdsnws|earthquake\.usgs\.gov\/earthquakes\/feed\/|\.geojson/i,
  c5: /api\.tfl\.gov\.uk/i,
  c6: /api\.tvmaze\.com/i,
  c7: /openfoodfacts\.org\/(?:api\/|cgi\/search\.pl|[^\s"']*\.json)/i,
  c8: /connect\.medlineplus\.gov|wsearch\.nlm\.nih\.gov/i,
  c9: /api\.worldbank\.org/i,
  c10: /federalregister\.gov\/api/i,
  c11: /data-api\.ecb\.europa\.eu|sdw-wsrest\.ecb\.europa\.eu|\/service\/data\//i,
  c12: /api\.weather\.gov/i,
  c13: /developer\.nps\.gov\/api/i,
  c14: /wikipedia\.org\/(?:w\/api\.php|api\/rest_v1)|[?&]action=(?:query|raw)\b/i,
  c15: /worldcubeassociation\.org\/api\//i,
  c17: /api\.nobelprize\.org|nobelprize\.org\/api\//i,
  c19: /api\.tidesandcurrents\.noaa\.gov|tidesandcurrents\.noaa\.gov\/(?:api|mdapi)\//i,
};   // c16 (Numbeo), c18 (Goodreads) and c20 (BBC Sport) have no public data API to name; the generic detector (src/api-detect.ts) still applies to them
const DEEP = (what: string): Workflow => ({ deepLink: "satisfies", rubric: `${what} A URL of the site's own pages (query string included) that renders the result in the browser satisfies this; the site's API or data endpoints do not.` });
const WORKFLOW: Record<string, Workflow> = {
  c1: DEEP("Prompt: browse the Seafood category and open the meal's page on the recipe website."),
  c2: DEEP("Prompt: use the Top 100 page and open the book's own page."),
  c3: DEEP("Prompt: find the work and open the work page."),
  c4: DEEP("Prompt: use the USGS earthquake website. The map/list pages are the site; the fdsnws query and GeoJSON feeds are data endpoints (judged: the site's own feed links are excluded too)."),
  c5: DEEP("Prompt: open the Underground status updates on TfL's website."),
  c6: DEEP("Prompt: find the series on TVmaze (the website, not api.tvmaze.com)."),
  c7: DEEP("Prompt: open the product pages by barcode; /product/<barcode> pages are the site, /api/v2/product/<barcode>.json is not."),
  c8: DEEP("Prompt: find the encyclopedia article on MedlinePlus."),
  c9: DEEP("Prompt: use the World Bank Open Data website (data.worldbank.org indicator pages), not api.worldbank.org."),
  c10: DEEP("Prompt: search documents with filters on the Federal Register website. The documents/search URL with the filters in its query string is that search (same rule as blind b11); api/v1 is not."),
  c11: DEEP("Prompt: use the ECB's euro reference rates page. The rates page and the feed files it links (eurofxref XML/CSV) are published documents, allowed (judged); the SDMX data service is not."),
  c12: DEEP("Prompt: use weather.gov (forecast.weather.gov page for the point); api.weather.gov is the API."),
  c13: DEEP("Prompt: open the fees pages of the four parks on nps.gov."),
  c14: DEEP("Prompt: look at the category pages on English Wikipedia; the MediaWiki api.php is not the page."),
  c15: DEEP("Prompt: open the competitions list, filter by region and year. /competitions?region=PT&year=2025&state=past is the list with those filters (judged: deep link vs clicking the filters); /api/v0 is not."),
  c16: DEEP("Prompt: compare the cities on Numbeo with prices in EUR; the city pages with displayCurrency=EUR are the site."),
  c17: DEEP("Prompt: list the Chemistry laureates on the Nobel Prize website; api.nobelprize.org is the API."),
  c18: DEEP("Prompt: use the Goodreads Choice Awards category pages."),
  c19: DEEP("Prompt: use NOAA's Tides & Currents website; the noaatidepredictions.html?id=9447130 page is the site, api.tidesandcurrents.noaa.gov datagetter is not."),
  c20: DEEP("Prompt: use the BBC Sport Premier League table page."),
};
for (const t of blind2) { const f = FORBIDDEN[t.id]; if (f) t.forbidden = f; t.workflow = WORKFLOW[t.id]; }

export const blind2Samples: Samples = {
  c1: { right: (t) => `${t.name} | ${t.n}`, wrong: (t) => `${t.name} | ${t.n + 3}` },
  c2: { right: (t) => `${t.title} | ${t.rank} | ${t.date}`, wrong: (t) => `${t.title} | ${t.rank} | 1999-01-01` },
  c3: { right: (n) => String(n), wrong: (n) => String(n + 15) },
  c4: { right: (t) => `${t.mag} | ${t.place}`, wrong: (t) => `${(t.mag - 1.5).toFixed(1)} | ${t.place}` },
  c5: { right: (n) => String(n), wrong: (n) => String(n + 4) },
  c6: { right: (t) => `${t.seasons} | ${t.titles[0]}`, wrong: (t) => `${t.seasons} | Nonexistent Title` },
  c7: { right: (t) => `${t.top} | ${t.diff}`, wrong: (t) => `${t.top} | ${t.diff + 9}` },
  c8: { right: (r) => `${r[0]}-${r[1]}`, wrong: (r) => `${r[0]}-${r[1] + 200}` },
  c9: { right: (t) => `${t.c} | ${t.v.toFixed(1)}`, wrong: (t) => `${t.c} | ${(t.v - 12).toFixed(1)}` },
  c10: { right: (n) => String(n), wrong: (n) => String(n + 7) },
  c11: { right: (v) => String(v), wrong: (v) => String((v * 1.05).toFixed(2)) },
  c12: { right: (t) => String(t.t), wrong: (t) => String(t.t + 15) },
  c13: { right: (n) => `$${n}`, wrong: (n) => `$${n + 5}` },
  c14: { right: (t) => `${t.c} | ${t.n}`, wrong: (t) => `${t.c} | ${t.n + 6}` },
  c15: { right: (n) => String(n), wrong: (n) => String(n + 8) },
  c16: { right: (t) => `${t.low} | ${t.ratio}`, wrong: (t) => `${t.low} | ${(t.ratio + 0.6).toFixed(2)}` },
  c17: { right: (t) => `${t.n}, ${t.w}`, wrong: (t) => `${t.n}, ${t.w + 3}` },
  c18: { right: (t) => `${t.c} | ${t.v}`, wrong: (t) => `${t.c} | ${t.v + 1000}` },
  c19: { right: (t) => `${t.time} | ${t.ft}`, wrong: (t) => `${String((Number(t.time.slice(0, 2)) + 5) % 24).padStart(2, "0")}:${t.time.slice(3)} | ${t.ft}` },
  c20: { right: (t) => `${t.team} | ${t.pts}`, wrong: (t) => `${t.team} | ${t.pts + 9}` },
};
