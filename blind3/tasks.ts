// blind3 (d1..d40): everyday web tasks that need the sites' own pages in a browser. Truth is recomputed live (plain requests, spaced per host, short cache) at prepare AND check time.
// Contract: see guard/prereg-r9.md and guard/endpoint-policy.md. Every task has host-level `visited` evidence, a per-site `forbidden` pattern for the site's data endpoints
// (also applied to recorded navigations) and a `workflow` rubric.
import { live, visited, strip, numsIn, answerLine, anyOf, inputShows, type Evidence } from "../blind/lib.ts";
import type { Task } from "../src/tasks.ts";

// ---------------------------------------------------------------- fetch helpers (polite: one request per host every GAP ms, 150 s cache)
const CH = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const GAP = 3000;
const chains = new Map<string, Promise<unknown>>();
const lastHit = new Map<string, number>();
const cache = new Map<string, { t: number; v: string }>();
async function get(url: string, headers: Record<string, string> = {}): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 150_000) return hit.v;
  const host = new URL(url).host;
  const run = async () => {
    let err: any;
    for (let i = 0; i < 3; i++) {
      const wait = (lastHit.get(host) ?? 0) + GAP * (i + 1) - Date.now();
      if (wait > 0) await Bun.sleep(wait);
      lastHit.set(host, Date.now());
      try {
        const r = await fetch(url, { redirect: "follow", headers: { "user-agent": CH, "accept-language": "en-US,en;q=0.9", ...headers }, signal: AbortSignal.timeout(40_000) });
        if (r.ok) { const v = await r.text(); cache.set(url, { t: Date.now(), v }); return v; }
        err = new Error(`${url} -> HTTP ${r.status}`);
      } catch (e) { err = e; }
    }
    throw err;
  };
  const prev = chains.get(host) ?? Promise.resolve();
  const p = prev.then(run, run);
  chains.set(host, p.catch(() => {}));
  return p;
}
const getJ = async (url: string, headers: Record<string, string> = {}) => JSON.parse(await get(url, { accept: "application/json", ...headers }));

const nrm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.%]+/g, " ").trim();
const inc = (line: string, s: string) => nrm(line).includes(nrm(s));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const anyNear = (line: string, v: number, tol: number) => numsIn(line).some((n) => near(n, v, tol));
const rowsOf = (h: string): string[][] => [...h.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])));
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ASK = (fmt: string) => `Give your final answer on the last line as \`ANSWER: ${fmt}\``;
const INTERACT: Evidence = anyOf("form interaction", inputShows("fill/select/click", /(fill|type|select|click|press|check|choose|dispatchEvent|\.value\s*=|option)/i));

type Spec = { id: string; title: string; prompt: string; host: RegExp; forbidden: RegExp; wf: string; deep?: "satisfies" | "does-not-satisfy"; chk: ReturnType<typeof live> };
const mk = (s: Spec): Task => ({
  id: s.id, suite: "blind3", title: s.title, prompt: () => s.prompt,
  prepare: s.chk.prepare, check: s.chk.check, snapshotAware: true,
  forbidden: s.forbidden, forbiddenNav: true,
  evidence: [visited(`visited ${s.host.source}`, s.host)],
  workflow: { deepLink: s.deep ?? "satisfies", rubric: s.wf, ...((s.deep ?? "satisfies") === "does-not-satisfy" ? { interaction: [INTERACT] } : {}) },
});

// ---------------------------------------------------------------- d1 adafruit: sum of three product prices
const AF = [3400, 2000, 1438];
const d1 = live(async () => {
  const out: number[] = [];
  for (const id of AF) { const h = await get(`https://www.adafruit.com/product/${id}`); const m = h.match(/itemprop="price"\s+content="([\d.]+)"/); if (!m) throw new Error("adafruit price " + id); out.push(+m[1]); }
  return out;
}, (t) => `prices ${t.join("+")}=${t.reduce((a, b) => a + b, 0).toFixed(2)}`, (l, t) => anyNear(l, t.reduce((a, b) => a + b, 0), 0.011));

// ---------------------------------------------------------------- d2 / d36 standard ebooks
const seTitles = (h: string) => [...h.matchAll(/property="schema:name">([^<]*)/g)].map((m) => strip(m[1])).filter((_, i) => i % 2 === 0);
const inOrder = (line: string, titles: string[]) => { let p = -1; const n = nrm(line); for (const t of titles) { const i = n.indexOf(nrm(t), p + 1); if (i < 0) return false; p = i; } return true; };
const d2 = live(async () => seTitles(await get("https://standardebooks.org/ebooks?query=dickens&sort=length&per-page=12")).slice(0, 3),
  (t) => t.join(" | "), (l, t) => inOrder(l, t));
const d36 = live(async () => seTitles(await get("https://standardebooks.org/ebooks?tags%5B%5D=mystery&sort=reading-ease&per-page=12&page=2"))[2],
  (t) => String(t), (l, t) => inc(l, t));

// ---------------------------------------------------------------- d3 / d35 airnav
async function airnav(icao: string) {
  const h = strip(await get(`https://www.airnav.com/airport/${icao}`));
  const rw = [...h.matchAll(/Dimensions: (\d+) x \d+ ft/g)].map((m) => +m[1]);
  const el = h.match(/Elevation: ([\d.]+) ft\. \/ [\d.]+ m/);
  if (!rw.length || !el) throw new Error("airnav parse " + icao);
  return { icao, longest: Math.max(...rw), elev: +el[1] };
}
const d3 = live(async () => { const o = []; for (const k of ["KBOI", "KGEG", "KPDX", "KSEA"]) o.push(await airnav(k)); return o; },
  (t) => t.map((x) => `${x.icao}=${x.longest}`).join(" "),
  (l, t) => { const b = [...t].sort((a, b) => b.longest - a.longest)[0]; return inc(l, b.icao) && anyNear(l, b.longest, 1); });
const d35 = live(async () => { const o = []; for (const k of ["KASE", "KLXV", "KJAC", "KTEX"]) o.push(await airnav(k)); return o; },
  (t) => t.map((x) => `${x.icao}=${x.elev}`).join(" "),
  (l, t) => { const b = [...t].sort((a, b) => b.elev - a.elev)[0]; return inc(l, b.icao) && anyNear(l, b.elev, 1.5); });

// ---------------------------------------------------------------- d4 BART fare
// BART's published public demo key (from the BART API documentation), kept as the fallback so the r9 result stays reproducible. Set BART_API_KEY to use your own.
const BART_KEY = process.env.BART_API_KEY ?? "MW9S-E7SL-26DU-VV8V";
const d4 = live(async () => {
  const j = await getJ(`https://api.bart.gov/api/sched.aspx?cmd=fare&orig=DUBL&dest=SFIA&date=today&key=${BART_KEY}&json=y`);
  const f: any[] = [].concat(j.root.fares.fare);
  const pick = (c: string) => +f.find((x) => x["@class"] === c)["@amount"];
  return { clipper: pick("clipper"), senior: pick("rtcclipper") };
}, (t) => `clipper=${t.clipper} senior=${t.senior}`, (l, t) => anyNear(l, t.clipper, 0.005) && anyNear(l, t.senior, 0.005));

// ---------------------------------------------------------------- d5 FAA registry
const FAA = ["N172SP", "N100", "N77"];
async function faa(n: string) {
  const s = strip(await get(`https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${n}`));
  const y = s.match(/MFR Year (\d{4})/);
  return y ? { n, year: +y[1] } : null;
}
const d5 = live(async () => { const o = []; for (const n of FAA) { const r = await faa(n); if (r) o.push(r); } if (o.length < 3) throw new Error("faa too few"); return o.slice(0, 3); },
  (t) => t.map((x) => `${x.n}:${x.year}`).join(" "),
  (l, t) => { const b = [...t].sort((a, c) => a.year - c.year)[0]; return inc(l, b.n) && anyNear(l, b.year, 0); });

// ---------------------------------------------------------------- d6 HKO 9-day forecast, second day
const d6 = live(async () => { const j = await getJ("https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=en"); const d = j.weatherForecast[1]; return { date: d.forecastDate, max: d.forecastMaxtemp.value, min: d.forecastMintemp.value }; },
  (t) => `${t.date} max=${t.max} min=${t.min}`, (l, t) => { const n = numsIn(l); return n.some((x) => near(x, t.max, 0.5)) && n.some((x) => near(x, t.min, 0.5)); });

// ---------------------------------------------------------------- d7 Treasury par yields
const d7 = live(async () => {
  const h = await get("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202610");
  const rs = rowsOf(h); const head = rs[0].map((x) => x.toLowerCase());
  const i2 = head.indexOf("2 yr"), i10 = head.indexOf("10 yr"); const row = rs.find((r) => r[0] === "10/14/2026");
  if (i2 < 0 || i10 < 0 || !row) throw new Error("treasury parse");
  return { y2: +row[i2], y10: +row[i10] };
}, (t) => `2y=${t.y2} 10y=${t.y10}`, (l, t) => anyNear(l, t.y2, 0.005) && anyNear(l, t.y10, 0.005));

// ---------------------------------------------------------------- d8 EIA weekly gasoline
async function eia(code: string) {
  const h = await get(`https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_${code}_w.htm`);
  const dates = [...h.matchAll(/<th class="Series5">(\d\d\/\d\d\/\d\d)<\/th>/g)].map((m) => m[1]);
  const at = h.indexOf('class="DataStub1">Regular<');
  const vals = at < 0 ? [] : [...h.slice(at, at + 3000).matchAll(/class="(?:DataB|Current2|DataA)">(\d+\.\d{3})</g)].map((m) => +m[1]).slice(0, dates.length);
  const i = dates.indexOf("10/26/26");
  if (i < 0 || !vals.length || vals.length !== dates.length) throw new Error("eia parse " + code);
  return vals[i];
}
const d8 = live(async () => ({ ca: await eia("sca"), wa: await eia("swa") }), (t) => `CA=${t.ca} WA=${t.wa}`,
  (l, t) => { const h = /higher\W+(ca|california|wa|washington)\b/i.exec(l)?.[1]?.toLowerCase().slice(0, 2); return anyNear(l, t.ca, 0.0006) && anyNear(l, t.wa, 0.0006) && h === (t.ca > t.wa ? "ca" : "wa"); });

// ---------------------------------------------------------------- d9 BOE sumario
const d9 = live(async () => {
  const h = await get("https://www.boe.es/boe/dias/2026/11/12/");
  const parts = h.split(/<h3 /).slice(1); const cnt = (pre: string) => { const p = parts.find((x) => strip("<h3 " + x.split("</h3>")[0]).startsWith(pre)); return p ? (p.match(/<li class="dispo"/g) ?? []).length : -1; };
  const a = cnt("I. Disposiciones generales"), b = cnt("III. Otras disposiciones"); if (a < 0 || b < 0) throw new Error("boe parse"); return { a, b };
}, (t) => `I=${t.a} III=${t.b}`, (l, t) => { const n = numsIn(l.replace(/\bIII\b|\bI\b/g, " ")); return n.includes(t.a) && n.includes(t.b); });

// ---------------------------------------------------------------- d10 ONS CPI
const d10 = live(async () => {
  const s = strip(await get("https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/mm23"));
  const v = [...s.matchAll(/\b(2024) (JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) (-?\d+\.\d)\b/g)].map((m) => ({ m: MON.indexOf(m[2].toLowerCase()) + 1, v: +m[3] }));
  if (v.length !== 12) throw new Error("ons parse " + v.length);
  const lo = Math.min(...v.map((x) => x.v)); return { months: v.filter((x) => x.v === lo).map((x) => x.m), lo };
}, (t) => `months ${t.months} value ${t.lo}`, (l, t) => anyNear(l, t.lo, 0.01) && t.months.some((m) => { const n = nrm(l); return n.includes(MON[m - 1]) || new RegExp(`2024\\W+0?${m}\\b`).test(l); }));

// ---------------------------------------------------------------- d11 gov.uk bank holidays 2027
const d11 = live(async () => {
  const j = await getJ("https://www.gov.uk/bank-holidays.json"); const c = (k: string) => j[k].events.filter((e: any) => e.date.startsWith("2027")).length;
  return { ew: c("england-and-wales"), sc: c("scotland"), ni: c("northern-ireland") };
}, (t) => `ew=${t.ew} sc=${t.sc} ni=${t.ni}`, (l, t) => { const n = numsIn(l); return n.includes(t.ew) && n.includes(t.sc) && n.includes(t.ni); });

// ---------------------------------------------------------------- d12 FDIC institutions per state
async function fdic(st: string) { const j = await getJ(`https://banks.data.fdic.gov/api/institutions?filters=${encodeURIComponent(`STNAME:"${st}" AND ACTIVE:1`)}&limit=1&fields=NAME`); return j.meta.total as number; }
const d12 = live(async () => ({ vt: await fdic("Vermont"), nh: await fdic("New Hampshire"), me: await fdic("Maine") }), (t) => `VT=${t.vt} NH=${t.nh} ME=${t.me}`,
  (l, t) => { const n = numsIn(l); return [t.vt, t.nh, t.me].every((v) => n.some((x) => near(x, v, 1))); });

// ---------------------------------------------------------------- d13 Freddie Mac PMMS
const d13 = live(async () => {
  const rows = (await get("https://www.freddiemac.com/pmms/docs/PMMS_history.csv")).trim().split("\n"); const last = rows[rows.length - 1].split(",");
  return { date: last[0], r30: +last[1], r15: +last[3] };
}, (t) => `${t.date} 30y=${t.r30} 15y=${t.r15}`, (l, t) => anyNear(l, t.r30, 0.005) && anyNear(l, t.r15, 0.005));

// ---------------------------------------------------------------- d14 ClinicalTrials.gov
const ct = async (st: string) => (await getJ(`https://clinicaltrials.gov/api/v2/studies?query.cond=gout&filter.overallStatus=${st}&countTotal=true&pageSize=1`)).totalCount as number;
const d14 = live(async () => ({ rec: await ct("RECRUITING"), nyr: await ct("NOT_YET_RECRUITING") }), (t) => `rec=${t.rec} nyr=${t.nyr}`,
  (l, t) => { const n = numsIn(l); return n.some((x) => near(x, t.rec, 3)) && n.some((x) => near(x, t.nyr, 2)); });

// ---------------------------------------------------------------- d15 DailyMed
const d15 = live(async () => { const s = strip(await get("https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=tizanidine")); const m = s.match(/\(([\d,]+) results?\)/); if (!m) throw new Error("dailymed parse"); return +m[1].replace(/,/g, ""); },
  (t) => String(t), (l, t) => numsIn(l).some((x) => near(x, t, Math.max(4, t * 0.03))));

// ---------------------------------------------------------------- d16 NPI registry
const d16 = live(async () => { const j = await getJ("https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=Mayo%20Clinic*&city=Rochester&state=MN&enumeration_type=NPI-2&limit=200"); if (typeof j.result_count !== "number") throw new Error("npi parse"); return j.result_count as number; },
  (t) => String(t), (l, t) => numsIn(l).some((x) => near(x, t, 2)));

// ---------------------------------------------------------------- d17 NHTSA recalls
const nh = async (mk: string, md: string, y: number) => { const j = await getJ(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${mk}&model=${md}&modelYear=${y}`); if (typeof j.Count !== "number") throw new Error("nhtsa parse"); return j.Count as number; };
const d17 = live(async () => ({ a: await nh("honda", "odyssey", 2018), b: await nh("ford", "f-150", 2015) }), (t) => `odyssey2018=${t.a} f150_2015=${t.b}`,
  (l, t) => { const n = numsIn(l); return n.some((x) => near(x, t.a, 1)) && n.some((x) => near(x, t.b, 1)); });

// ---------------------------------------------------------------- d18 fueleconomy.gov
const fe = async (id: number) => { const j = await getJ(`https://www.fueleconomy.gov/ws/rest/vehicle/${id}`); return { mpg: +j.comb08, cost: +j.fuelCost08 }; };
const d18 = live(async () => ({ prius: await fe(47243), camry: await fe(47092) }), (t) => `prius ${t.prius.mpg}/${t.prius.cost} camry ${t.camry.mpg}/${t.camry.cost}`,
  (l, t) => anyNear(l, t.prius.mpg, 0) && anyNear(l, t.prius.cost, 0) && anyNear(l, t.camry.mpg, 0) && anyNear(l, t.camry.cost, 0));

// ---------------------------------------------------------------- d19 Olympedia
const d19 = live(async () => {
  const rs = rowsOf(await get("https://www.olympedia.org/countries/ISL")).filter((r) => /^\d{4} (Summer|Winter) Olympics$/.test(r[0]));
  const ed = rs.map((r) => { const n = r.filter((c) => /^\d+$/.test(c)); return { year: +r[0].slice(0, 4), season: r[0].split(" ")[1], total: +n[n.length - 1] }; });
  if (ed.length < 20) throw new Error("olympedia parse " + ed.length);
  const mx = Math.max(...ed.map((e) => e.total)); return { best: ed.filter((e) => e.total === mx), mx };
}, (t) => `${t.best.map((b) => b.year + " " + b.season).join("/")} ${t.mx}`, (l, t) => anyNear(l, t.mx, 0) && t.best.some((b) => l.includes(String(b.year))));

// ---------------------------------------------------------------- d20 / d40 Formula 1
const d20 = live(async () => { const r = rowsOf(await get("https://www.formula1.com/en/results/2014/team")).find((x) => x[0] === "5"); if (!r) throw new Error("f1 team parse"); return { team: r[1], pts: +r[r.length - 1] }; },
  (t) => `${t.team} ${t.pts}`, (l, t) => anyNear(l, t.pts, 0) && inc(l, t.team.split(" ")[0]));
const d40 = live(async () => { const r = rowsOf(await get("https://www.formula1.com/en/results/2021/drivers")).find((x) => x[0] === "11"); if (!r) throw new Error("f1 driver parse"); const nm = r[1].replace(/[A-Z]{3}$/, "").trim(); return { name: nm, pts: +r[r.length - 1] }; },
  (t) => `${t.name} ${t.pts}`, (l, t) => anyNear(l, t.pts, 0) && inc(l, t.name.split(" ").slice(-1)[0]));

// ---------------------------------------------------------------- d21 Lichess leaderboard
const d21 = live(async () => {
  const h = await get("https://lichess.org/player"); const sec = h.split('<section class="user-top">').find((s) => s.includes('href="/player/top/classical"'))?.split("</section>")[0];
  if (!sec) throw new Error("lichess parse"); const li = sec.split("<li>").slice(1);
  const first = li[0].match(/href="\/@\/([^"]+)"/)![1]; return { first, titled: li.filter((x) => x.includes('class="utitle"')).length, n: li.length };
}, (t) => `${t.first} titled=${t.titled}/${t.n}`, (l, t) => inc(l, t.first) && numsIn(l).includes(t.titled));

// ---------------------------------------------------------------- d22 MLB 2026 final standings
const d22 = live(async () => {
  const j = await getJ("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason");
  const lead = j.records.map((r: any) => r.teamRecords.find((t: any) => String(t.divisionRank) === "1")).filter(Boolean).map((t: any) => ({ team: t.team.name as string, w: t.wins as number }));
  if (lead.length !== 6) throw new Error("mlb parse " + lead.length); const mx = Math.max(...lead.map((x: any) => x.w)); return { best: lead.filter((x: any) => x.w === mx), mx };
}, (t) => `${t.best.map((b: any) => b.team).join("/")} ${t.mx}`, (l, t) => anyNear(l, t.mx, 0) && t.best.some((b: any) => inc(l, b.team.split(" ").slice(-1)[0])));

// ---------------------------------------------------------------- d23 Giallozafferano
const GZ = ["Tiramisu", "Panna-cotta", "Risotto-alla-milanese", "Gnocchi-di-patate"];
const iso = (d: string) => { const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/); return m ? +(m[1] ?? 0) * 60 + +(m[2] ?? 0) : NaN; };
const d23 = live(async () => {
  const o: { name: string; cook: number }[] = [];
  for (const s of GZ) {
    const h = await get(`https://ricette.giallozafferano.it/${s}.html`);
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const d = JSON.parse(m[1]); for (const x of Array.isArray(d) ? d : [d]) if (x?.["@type"] === "Recipe") o.push({ name: x.name, cook: iso(x.cookTime) }); } catch {} }
  }
  if (o.length !== 4 || o.some((x) => isNaN(x.cook))) throw new Error("giallo parse"); return o;
}, (t) => t.map((x) => `${x.name}:${x.cook}`).join(" "), (l, t) => { const b = [...t].sort((a, c) => c.cook - a.cook)[0]; return inc(l, b.name.split(" ")[0]) && anyNear(l, b.cook, 0); });

// ---------------------------------------------------------------- d24 arXiv advanced search count
const d24 = live(async () => {
  const s = strip(await get("https://arxiv.org/search/advanced?advanced=&terms-0-operator=AND&terms-0-term=graph+neural&terms-0-field=title&classification-computer_science=y&classification-include_cross_list=include&date-filter_by=date_range&date-from_date=2021-01-01&date-to_date=2021-06-30&date-date_type=submitted_date&abstracts=show&size=50&order="));
  const m = s.match(/of ([\d,]+) results/); if (!m) throw new Error("arxiv parse"); return +m[1].replace(/,/g, "");
}, (t) => String(t), (l, t) => numsIn(l).some((x) => near(x, t, Math.max(3, t * 0.01))));

// ---------------------------------------------------------------- d25 x-rates historical
const d25 = live(async () => {
  const s = strip(await get("https://www.x-rates.com/historical/?from=USD&amount=1&date=2026-10-14"));
  const g = (n: string) => { const m = s.match(new RegExp(n + " ([\\d.]+) [\\d.]+")); if (!m) throw new Error("xrates " + n); return +m[1]; };
  return { chf: g("Swiss Franc"), inr: g("Indian Rupee") };
}, (t) => `chf=${t.chf} inr=${t.inr}`, (l, t) => anyNear(l, t.chf, t.chf * 0.004) && anyNear(l, t.inr, t.inr * 0.004));

// ---------------------------------------------------------------- d26 CNB kurzovni listek
const d26 = live(async () => {
  const txt = await get("https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=14.10.2026");
  const g = (c: string) => { const r = txt.split("\n").map((x) => x.split("|")).find((x) => x[3] === c); if (!r) throw new Error("cnb " + c); return +r[4].replace(",", "."); };
  return { jpy: g("JPY"), chf: g("CHF") };
}, (t) => `jpy100=${t.jpy} chf=${t.chf}`, (l, t) => { const n = numsIn(l.replace(/(\d),(\d)/g, "$1.$2")); return n.some((x) => near(x, t.jpy, 0.006)) && n.some((x) => near(x, t.chf, 0.006)); });

// ---------------------------------------------------------------- d27 GeoNames
const d27 = live(async () => {
  const h = strip(await get("https://www.geonames.org/search.html?q=springfield&country=US&featureClass=P"));
  const p = [...h.matchAll(/pop\. ([\d,]+)/g)].map((m) => +m[1].replace(/,/g, "")); if (p.length < 5) throw new Error("geonames parse"); return Math.max(...p);
}, (t) => String(t), (l, t) => numsIn(l).includes(t));

// ---------------------------------------------------------------- d28 Worldometers
const d28 = live(async () => {
  const h = await get("https://www.worldometers.info/world-population/population-by-country/"); const rs = rowsOf(h).filter((r) => r.length >= 10);
  const head = rs[0]; const fi = head.findIndex((c) => /fert/i.test(c)); if (fi < 0) throw new Error("worldometers head");
  const top = rs.slice(1, 11).map((r) => ({ c: r[1], f: +r[fi] })); if (top.some((x) => isNaN(x.f))) throw new Error("worldometers nan");
  const mx = Math.max(...top.map((x) => x.f)); return { best: top.filter((x) => x.f === mx), mx };
}, (t) => `${t.best.map((b) => b.c).join("/")} ${t.mx}`, (l, t) => anyNear(l, t.mx, 0.001) && t.best.some((b) => inc(l, b.c)));

// ---------------------------------------------------------------- d29 TreasuryDirect I bonds
const d29 = live(async () => {
  const s = strip(await get("https://www.treasurydirect.gov/savings-bonds/i-bonds/i-bonds-interest-rates/"));
  const c = s.match(/composite rate for I bonds issued from (\w+ \d{4}) to (\w+ \d{4}) is ([\d.]+)%/), f = s.match(/Fixed rate ([\d.]+)%/); if (!c || !f) throw new Error("tdirect parse");
  return { from: c[1], to: c[2], comp: +c[3], fixed: +f[1] };
}, (t) => `${t.from}-${t.to} fixed=${t.fixed} comp=${t.comp}`, (l, t) => anyNear(l, t.fixed, 0.005) && anyNear(l, t.comp, 0.005));

// ---------------------------------------------------------------- d30 itch.io top rated puzzle, 30th
const d30 = live(async () => {
  const h = await get("https://itch.io/games/top-rated/tag-puzzle"); const t = [...h.matchAll(/class="title game_link"[^>]*>([^<]*)</g)].map((m) => strip(m[1]));
  if (t.length < 33) throw new Error("itch parse " + t.length); return t.slice(27, 32);
}, (t) => t.join(" | "), (l, t) => t.slice(1, 4).some((x) => inc(l, x)));

// ---------------------------------------------------------------- d31 Paris open data themes
const d31 = live(async () => {
  const j = await getJ("https://opendata.paris.fr/api/explore/v2.1/catalog/facets?facet=theme&limit=1"); const f: { name: string; count: number }[] = j.facets[0].facets;
  const top = [...f].sort((a, b) => b.count - a.count)[0]; return { top: top.name, topCount: top.count, env: f.find((x) => /^Environnement$/.test(x.name))!.count };
}, (t) => `${t.top}=${t.topCount} env=${t.env}`, (l, t) => inc(l, t.top.split(" ")[0]) && numsIn(l).some((x) => near(x, t.topCount, 3)) && numsIn(l).some((x) => near(x, t.env, 2)));

// ---------------------------------------------------------------- d32 Inside Airbnb compile dates
const IAB = ["Barcelona, Catalonia, Spain", "Lisbon, Lisbon, Portugal", "Madrid, Comunidad de Madrid, Spain", "Athens, Attica, Greece"];
const d32 = live(async () => {
  const s = strip(await get("http://insideairbnb.com/get-the-data/")); const MN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const o = IAB.map((c) => { const i = s.indexOf(c); const m = i < 0 ? null : s.slice(i + c.length, i + c.length + 40).match(/(\d{1,2}) (\w+), (\d{4})/); return m ? { city: c.split(",")[0], d: `${m[3]}-${String(MN.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` } : null; });
  if (o.some((x) => !x)) throw new Error("iab parse"); const mx = (o as any[]).map((x) => x.d).sort().pop(); return { all: o as { city: string; d: string }[], mx };
}, (t) => t.all.map((x) => `${x.city}:${x.d}`).join(" "), (l, t) => t.all.filter((x) => x.d === t.mx).some((x) => inc(l, x.city)));

// ---------------------------------------------------------------- d33 OfficeHolidays
const oh = async (c: string) => rowsOf(await get(`https://www.officeholidays.com/countries/${c}/2027`)).filter((r) => r[3] === "National Holiday").length;
const d33 = live(async () => ({ jp: await oh("japan"), kr: await oh("south-korea"), th: await oh("thailand") }), (t) => `jp=${t.jp} kr=${t.kr} th=${t.th}`,
  (l, t) => { const n = numsIn(l); return [t.jp, t.kr, t.th].every((v) => n.includes(v)); });

// ---------------------------------------------------------------- d34 Scryfall
const sc = async (q: string) => { const j = await getJ(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`, { "user-agent": "browser-duel-blind-checker/1.0", accept: "application/json" }); return j.total_cards as number; };
const d34 = live(async () => ({ myth: await sc("set:mh2 r:mythic"), red: await sc("set:mh2 r:mythic c:r") }), (t) => `mythic=${t.myth} red=${t.red}`,
  (l, t) => { const n = numsIn(l); return n.includes(t.myth) && n.includes(t.red); });

// ---------------------------------------------------------------- d37 SMHI Stockholm tomorrow max
const d37 = live(async () => {
  const j = await getJ("https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.07/lat/59.33/data.json");
  const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm" }).format(new Date(ms)); const tm = day(Date.now() + 86400e3);
  const v = j.timeSeries.filter((x: any) => day(Date.parse(x.time)) === tm).map((x: any) => x.data.air_temperature as number); if (v.length < 6) throw new Error("smhi parse");
  return { day: tm, max: Math.max(...v) };
}, (t) => `${t.day} max=${t.max}`, (l, t) => anyNear(l, t.max, 3));

// ---------------------------------------------------------------- d38 / d39 Our World in Data
async function owid(slug: string, codes: string[]) {
  const csv = (await get(`https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=filtered&useColumnShortNames=true&country=${codes.join("~")}`)).trim().split("\n").slice(1).map((r) => r.split(","));
  const latest = new Map<string, { y: number; v: number }>();
  for (const r of csv) { const c = r[1], y = +r[2], v = +r[3]; if (codes.includes(c) && !isNaN(v) && (!latest.has(c) || latest.get(c)!.y < y)) latest.set(c, { y, v }); }
  if (latest.size !== codes.length) throw new Error("owid parse " + slug);
  return codes.map((c) => ({ c, ...latest.get(c)! }));
}
const NAME: Record<string, string> = { ESP: "Spain", DEU: "Germany", ITA: "Italy", POL: "Poland", CHL: "Chile", MEX: "Mexico", PER: "Peru", COL: "Colombia" };
const owidJudge = (l: string, t: any[]) => { const b = [...t].sort((a, c) => c.v - a.v)[0]; return inc(l, NAME[b.c]) && anyNear(l, b.v, 0.35); };
const d38 = live(() => owid("share-electricity-solar", ["ESP", "DEU", "ITA", "POL"]), (t) => t.map((x) => `${x.c}:${x.y}:${x.v}`).join(" "), owidJudge);
const d39 = live(() => owid("share-of-individuals-using-the-internet", ["CHL", "MEX", "PER", "COL"]), (t) => t.map((x) => `${x.c}:${x.y}:${x.v}`).join(" "), owidJudge);

// ---------------------------------------------------------------- task table
const specs: Spec[] = [
  { id: "d1", title: "Adafruit: price total of three listed products", host: /adafruit\.com/i, forbidden: /adafruit\.com\/(api|json|ajax)\//i, chk: d1,
    prompt: `Use adafruit.com. Open the product pages of Adafruit product IDs 3400, 2000 and 1438 and read the current price shown for each. Add the three prices together (USD). Answer with the total to two decimals, for example 12.34.\n${ASK("<total>")}`,
    wf: "Reading three product pages on adafruit.com; a direct /product/<id> link is the site's own page and is fine." },
  { id: "d2", title: "Standard Ebooks: shortest Dickens ebooks", host: /standardebooks\.org/i, forbidden: /standardebooks\.org\/(feeds|opds|api)\b|\.(atom|opds)\b/i, chk: d2,
    prompt: `On standardebooks.org, search the ebook catalogue for "dickens" and sort the results by "Length (short → long)". List the titles of the first three results in that order, separated by " | ".\n${ASK("<title 1> | <title 2> | <title 3>")}`,
    wf: "Search + sort state lives in the query string (query, sort); a deep link to that listing is the site's own listing page." },
  { id: "d3", title: "AirNav: longest runway among four airports", host: /airnav\.com/i, forbidden: /airnav\.com\/(api|json)/i, chk: d3,
    prompt: `On airnav.com, look up the airports KBOI, KGEG, KPDX and KSEA. For each one find its longest runway (length in feet). Which of the four has the longest runway, and how long is it?\n${ASK("<ICAO code>, <feet>")}`,
    wf: "Four airport pages on airnav.com; /airport/<ICAO> links are the site's pages." },
  { id: "d4", title: "BART: fares from the fare calculator", host: /bart\.gov/i, forbidden: /api\.bart\.gov|bart\.gov\/api\//i, chk: d4, deep: "does-not-satisfy",
    prompt: `Use the fare calculator on bart.gov. Choose Dublin/Pleasanton as the origin station and San Francisco Int'l Airport (SFO) as the destination. Report the Clipper fare and the Senior/Disabled Clipper fare shown for that trip, in US dollars.\n${ASK("clipper=$<x.xx>; senior=$<y.yy>")}`,
    wf: "The prompt asks to operate the fare calculator form; the selection is not in the URL, so interaction with the form is required in addition to avoiding the BART web service." },
  { id: "d5", title: "FAA registry: oldest aircraft by manufacture year", host: /registry\.faa\.gov/i, forbidden: /registry\.faa\.gov[^\s"']*\/api\/|\.zip\b/i, chk: d5,
    prompt: `Use the FAA Aircraft Registry N-Number inquiry (registry.faa.gov). Look up the aircraft N172SP, N100 and N77 and read each "MFR Year". Which of the three was manufactured earliest, and in what year?\n${ASK("<N-number>, <year>")}`,
    wf: "The N-number inquiry result page has a query-string URL; loading it directly is the site's own result page." },
  { id: "d6", title: "Hong Kong Observatory: second day of the 9-day forecast", host: /hko\.gov\.hk/i, forbidden: /data\.weather\.gov\.hk|weatherAPI/i, chk: d6,
    prompt: `On the Hong Kong Observatory website (hko.gov.hk, English pages), open the 9-day weather forecast. For the second day in the list, read the forecast maximum and minimum temperature in degrees Celsius.\n${ASK("max=<N>; min=<N>")}`,
    wf: "The 9-day forecast is a client-rendered page on hko.gov.hk; opening that page is the interface." },
  { id: "d7", title: "US Treasury: par yields on a given day", host: /treasury\.gov/i, forbidden: /fiscaldata\.treasury\.gov|\/odata\/|format=(xml|json)/i, chk: d7,
    prompt: `On home.treasury.gov, open "Daily Treasury Par Yield Curve Rates" (the Interest Rate Statistics data on the Resource Center). Find the row for 10/14/2026 and read the 2 Yr and the 10 Yr yields (percent).\n${ASK("2y=<x.xx>; 10y=<y.yy>")}`,
    wf: "The rates table is a page with a month selector in the URL; the page for October 2026 is the site's own page." },
  { id: "d8", title: "EIA: weekly retail gasoline price, two states", host: /eia\.gov/i, forbidden: /api\.eia\.gov|eia\.gov\/opendata|\.(xls|xlsx|csv)\b/i, chk: d8,
    prompt: `On eia.gov, open the "Weekly Retail Gasoline and Diesel Prices" table (Petroleum & Other Liquids, gasoline prices). For the week of 10/26/26, read the price of "Regular" gasoline for the area California and for the area Washington (dollars per gallon, as shown, 3 decimals). State which of the two is higher.\n${ASK("CA=<x.xxx>; WA=<y.yyy>; higher=<CA or WA>")}`,
    wf: "Area selection is a dropdown that navigates to a per-area table page; the per-area page is the site's page." },
  { id: "d9", title: "BOE (Spanish gazette): items per section on one day", host: /boe\.es/i, forbidden: /boe\.es\/datosabiertos|\.xml\b/i, chk: d9,
    prompt: `En boe.es, abre el sumario del BOE del día 12 de noviembre de 2026. Cuenta cuántas disposiciones aparecen en la sección "I. Disposiciones generales" y cuántas en "III. Otras disposiciones" (cada entrada con su enlace al PDF cuenta como una).\n${ASK("I=<n>; III=<m>")}`,
    wf: "The day summary is a dated page on boe.es; the dated URL is the site's own page." },
  { id: "d10", title: "ONS: lowest UK CPI annual rate in 2024", host: /ons\.gov\.uk/i, forbidden: /api\.beta\.ons|ons\.gov\.uk\/[^\s"']*\/data(?:[?#"'\s]|$)|generator\?/i, chk: d10,
    prompt: `On ons.gov.uk, find the time series "CPI ANNUAL RATE 00: ALL ITEMS 2015=100" (series ID D7G7). In its monthly values, in which month of 2024 was the rate lowest, and what was it (percent, one decimal)?\n${ASK("<Month YYYY>, <x.x>")}`,
    wf: "The time series page lists monthly values; finding it by search or by a direct page link is fine, but not its /data JSON." },
  { id: "d11", title: "GOV.UK: 2027 bank holidays by nation", host: /gov\.uk/i, forbidden: /gov\.uk\/bank-holidays\.json|api\.gov\.uk/i, chk: d11,
    prompt: `On gov.uk, open the UK bank holidays page. In the year 2027, how many bank holidays are listed for England and Wales, for Scotland, and for Northern Ireland? (Count every dated entry for 2027, including substitute days.)\n${ASK("ew=<n>; scotland=<n>; ni=<n>")}`,
    wf: "The page has one tab per nation; reading each tab is the interface." },
  { id: "d12", title: "FDIC BankFind: active institutions in three states", host: /fdic\.gov/i, forbidden: /banks\.data\.fdic\.gov\/api/i, chk: d12, deep: "does-not-satisfy",
    prompt: `Use the FDIC BankFind Suite (banks.data.fdic.gov/bankfind-suite/bankfind, the "Find institutions" search). With only the filter State = (headquarters state) and status Active, how many FDIC-insured institutions are listed for Vermont, for New Hampshire and for Maine?\n${ASK("VT=<n>; NH=<n>; ME=<n>")}`,
    wf: "BankFind is a client-rendered app whose filters are set by clicking; interaction is required and its data API is excluded." },
  { id: "d13", title: "Freddie Mac PMMS: latest weekly mortgage rates", host: /freddiemac\.com/i, forbidden: /api\.freddiemac|fred\.stlouisfed|api\.stlouisfed/i, chk: d13,
    prompt: `On freddiemac.com, open the Primary Mortgage Market Survey (PMMS) page. Read the most recent weekly average for the 30-year fixed-rate mortgage and for the 15-year fixed-rate mortgage (percent).\n${ASK("30y=<x.xx>; 15y=<y.yy>")}`,
    wf: "The PMMS page shows the latest weekly rates; reading it is the interface." },
  { id: "d14", title: "ClinicalTrials.gov: gout studies by status", host: /clinicaltrials\.gov/i, forbidden: /clinicaltrials\.gov\/api\//i, chk: d14,
    prompt: `On clinicaltrials.gov, search by Condition/disease "gout". With the Status filter set to Recruiting, how many studies does the site report? Then change the status filter to Not yet recruiting only and report that count too.\n${ASK("recruiting=<n>; not_yet=<m>")}`,
    wf: "The search state is in the URL (cond, aggFilters); a deep link to the search results page is the site's search." },
  { id: "d15", title: "DailyMed: label search result count", host: /dailymed\.nlm\.nih\.gov/i, forbidden: /dailymed\.nlm\.nih\.gov\/dailymed\/services\/|\.(json|xml)\b/i, chk: d15,
    prompt: `On DailyMed (dailymed.nlm.nih.gov), search all drug labels for "tizanidine". How many results does the search report?\n${ASK("<n>")}`,
    wf: "Search state is in the URL query string; a deep link to the results page is the site's search." },
  { id: "d16", title: "NPI Registry: Mayo Clinic organizations in Rochester", host: /npiregistry\.cms\.hhs\.gov/i, forbidden: /npiregistry\.cms\.hhs\.gov\/api\//i, chk: d16, deep: "does-not-satisfy",
    prompt: `Use the NPPES NPI Registry search (npiregistry.cms.hhs.gov). Search for Organizations (NPI-2) with organization name "Mayo Clinic*" located in city Rochester, state MN. How many results does the registry report?\n${ASK("<n>")}`,
    wf: "The registry search is a client-rendered form; the form must be operated and the registry API is excluded." },
  { id: "d17", title: "NHTSA: recall counts for two vehicles", host: /nhtsa\.gov/i, forbidden: /api\.nhtsa\.gov/i, chk: d17, deep: "does-not-satisfy",
    prompt: `On nhtsa.gov, use the Recalls lookup by vehicle (Year, Make, Model). How many recalls does the site list for a 2018 Honda Odyssey, and how many for a 2015 Ford F-150?\n${ASK("odyssey=<n>; f150=<m>")}`,
    wf: "The vehicle lookup is a client-rendered form with dropdowns; interaction is required and the NHTSA API is excluded." },
  { id: "d18", title: "fueleconomy.gov: compare two hybrids", host: /fueleconomy\.gov/i, forbidden: /fueleconomy\.gov\/ws\//i, chk: d18, deep: "does-not-satisfy",
    prompt: `On fueleconomy.gov, use "Find a Car" (year, make, model menus) and compare the 2024 Toyota Prius (2.0 L) with the 2024 Toyota Camry Hybrid LE. For each, read the combined MPG and the annual fuel cost (dollars).\n${ASK("prius=<mpg>/$<cost>; camry=<mpg>/$<cost>")}`,
    wf: "Vehicles are chosen through year/make/model menus; interaction is expected, and the fueleconomy web service is excluded." },
  { id: "d19", title: "Olympedia: Iceland's biggest Games", host: /olympedia\.org/i, forbidden: /olympedia\.org\/[^\s"']*\.(json|csv)/i, chk: d19,
    prompt: `On olympedia.org, open the country page for Iceland (ISL). In the table of participations by edition (Olympic Games only, Summer and Winter), in which Games did Iceland have the largest number of competitors in total, and how many?\n${ASK("<year>, <total>")}`,
    wf: "The country page lists participations by edition; opening it is the interface." },
  { id: "d20", title: "Formula 1: constructors' standings 2014", host: /formula1\.com/i, forbidden: /api\.formula1\.com|ergast|jolpi/i, chk: d20,
    prompt: `On formula1.com, open the results archive for the 2014 season and its Constructors' standings. Which team finished 5th, and how many points did it score?\n${ASK("<team name>, <points>")}`,
    wf: "The standings page for a season is a normal page (results/2014/team); the season selector navigates to it." },
  { id: "d21", title: "Lichess: classical leaderboard", host: /lichess\.org/i, forbidden: /lichess\.org\/api\//i, chk: d21,
    prompt: `On lichess.org, open the Leaderboard (Players). In the Classical top 10, what is the username of the number 1 player, and how many of the ten players carry a chess title (GM, IM, FM, etc.) in front of their name?\n${ASK("<username>, <n titled>")}`,
    wf: "The leaderboard is a normal page; reading the Classical list is the interface." },
  { id: "d22", title: "MLB: best division winner of the 2026 season", host: /mlb\.com/i, forbidden: /statsapi\.mlb\.com|bdfed\.stitch\.mlbinfra\.com/i, chk: d22,
    prompt: `On mlb.com, open the Standings for the 2026 regular season (final standings, by division). Among the six division leaders (the team ranked first in each of the AL East, AL Central, AL West, NL East, NL Central, NL West), which won the most games, and how many?\n${ASK("<team>, <wins>")}`,
    wf: "Standings are client-rendered and the season and view are chosen in the page; the MLB stats API is excluded." },
  { id: "d23", title: "GialloZafferano: longest cooking time among four recipes", host: /giallozafferano\.it/i, forbidden: /giallozafferano\.it\/[^\s"']*\.json/i, chk: d23,
    prompt: `On giallozafferano.it, find the recipes "Tiramisù", "Panna cotta", "Risotto alla milanese" and "Gnocchi di patate". For each, read the cooking time ("Cottura") shown. Which of the four has the longest cooking time, and how many minutes is it?\n${ASK("<recipe name>, <minutes>")}`,
    wf: "Four recipe pages found with the site search or direct recipe URLs on the same site." },
  { id: "d24", title: "arXiv: advanced search count over a date range", host: /arxiv\.org/i, forbidden: /export\.arxiv\.org|arxiv\.org\/(api|oai)/i, chk: d24, deep: "does-not-satisfy",
    prompt: `On arxiv.org, use the Advanced Search form. Search the Title field for "graph neural", restrict to the subject Computer Science (include cross-list), and use a date range from 2021-01-01 to 2021-06-30 with the default date type (Submission date, most recent). How many results does arXiv report?\n${ASK("<n>")}`,
    wf: "The prompt asks to fill the Advanced Search form; interaction with the form is expected (the exact query string is otherwise a deep link)." },
  { id: "d25", title: "X-Rates: historical exchange rates", host: /x-rates\.com/i, forbidden: /x-rates\.com\/(api|ajax)\//i, chk: d25,
    prompt: `On x-rates.com, open the Historical Rates Table for the US Dollar for 2026-10-14. How many Swiss Francs and how many Indian Rupees does 1 US Dollar buy that day?\n${ASK("chf=<x.xxxx>; inr=<y.yy>")}`,
    wf: "The historical table takes a date; the page for that date is the site's own page." },
  { id: "d26", title: "CNB (Czech): daily exchange rate list", host: /cnb\.cz/i, forbidden: /cnb\.cz\/cnbapi\/|\.(json|xml)\b/i, chk: d26,
    prompt: `Na webu cnb.cz otevři kurzovní lístek ČNB (kurzy devizového trhu - středový kurz) pro den 14.10.2026. Zjisti kurz za 100 japonských jenů (JPY) a za 1 švýcarský frank (CHF) v korunách.\n${ASK("JPY100=<x,xxx>; CHF=<y,yyy>")}`,
    wf: "The daily rate list takes a date; opening it for that date is the interface." },
  { id: "d27", title: "GeoNames: most populous place called Springfield", host: /geonames\.org/i, forbidden: /api\.geonames\.org|searchJSON|geonames\.org\/export/i, chk: d27,
    prompt: `On geonames.org, search for "springfield", limit the country to United States and the feature class to "city, village,..." (class P). Among the places listed on the first results page (the first 50), what is the highest population shown ("pop.")? Answer with the number only.\n${ASK("<population>")}`,
    wf: "Query parameters (q, country, featureClass) are the site's own search page; a deep link is fine." },
  { id: "d28", title: "Worldometers: fertility rate among the ten largest countries", host: /worldometers\.info/i, forbidden: /worldometers\.info\/[^\s"']*\.json|worldometers\.info\/api/i, chk: d28,
    prompt: `On worldometers.info, open "Population by Country". Looking only at the ten countries with the largest population in that table, which one has the highest fertility rate ("Fert. Rate"), and what is the rate?\n${ASK("<country>, <rate>")}`,
    wf: "The table page is read directly." },
  { id: "d29", title: "TreasuryDirect: current I bond rates", host: /treasurydirect\.gov/i, forbidden: /treasurydirect\.gov\/(TA_WS|api|webapis)/i, chk: d29,
    prompt: `On treasurydirect.gov, open the page of I bond interest rates. For the most recently announced rate period (bonds issued from the latest May/November announcement), what are the fixed rate and the composite rate, in percent?\n${ASK("fixed=<x.xx>; composite=<y.yy>")}`,
    wf: "A single informational page is read." },
  { id: "d30", title: "itch.io: 30th top-rated puzzle game", host: /itch\.io/i, forbidden: /itch\.io\/api\//i, chk: d30,
    prompt: `On itch.io, browse games with the tag "puzzle" sorted by "Top rated" (https://itch.io/games/top-rated/tag-puzzle). The list loads more entries as you scroll. What is the title of the 30th game in the list?\n${ASK("<title>")}`,
    wf: "The sorted/tag list is a normal itch.io page whose later entries load on scroll or page; no data endpoint is needed." },
  { id: "d31", title: "Paris Open Data: datasets per theme", host: /opendata\.paris\.fr/i, forbidden: /opendata\.paris\.fr\/api\//i, chk: d31,
    prompt: `Sur le portail opendata.paris.fr, ouvre le catalogue des jeux de données et utilise le filtre « Thème ». Quel thème contient le plus de jeux de données (donne son nom et son nombre), et combien de jeux de données le thème « Environnement » contient-il ?\n${ASK("<thème>=<n>; Environnement=<m>")}`,
    wf: "The catalogue is client-rendered with a theme facet; reading the facet counts in the page is the interface." },
  { id: "d32", title: "Inside Airbnb: most recent data compile", host: /insideairbnb\.com/i, forbidden: /insideairbnb\.com\/api\//i, chk: d32,
    prompt: `On insideairbnb.com, open "Get the Data". Among Barcelona (Spain), Lisbon (Portugal), Madrid (Spain) and Athens (Greece), which city's data was compiled most recently (the date shown next to the city name), and on what date?\n${ASK("<city>, <YYYY-MM-DD>")}`,
    wf: "The data page lists cities with compile dates; reading it is the interface." },
  { id: "d33", title: "OfficeHolidays: national holidays in 2027, three countries", host: /officeholidays\.com/i, forbidden: /officeholidays\.com\/api\//i, chk: d33,
    prompt: `On officeholidays.com, open the 2027 public holiday lists for Japan, South Korea and Thailand. For each country count the entries whose Type is "National Holiday".\n${ASK("japan=<n>; south-korea=<n>; thailand=<n>")}`,
    wf: "Three country/year pages on officeholidays.com; direct URLs are the site's own pages." },
  { id: "d34", title: "Scryfall: Modern Horizons 2 mythics", host: /scryfall\.com/i, forbidden: /api\.scryfall\.com/i, chk: d34,
    prompt: `On scryfall.com, search for cards from the set Modern Horizons 2 (set code MH2) with rarity mythic. How many cards does Scryfall report? Then narrow it to red cards (color: red) and report that count too.\n${ASK("mythic=<n>; red=<m>")}`,
    wf: "Scryfall search state is in the URL (q=...); a deep link to the search results is the site's search page." },
  { id: "d35", title: "AirNav: highest field elevation", host: /airnav\.com/i, forbidden: /airnav\.com\/(api|json)/i, chk: d35,
    prompt: `On airnav.com, look up the airports KASE, KLXV, KJAC and KTEX. Which one has the highest field elevation, and what is that elevation in feet (as shown, rounded to the nearest foot)?\n${ASK("<ICAO code>, <feet>")}`,
    wf: "Four airport pages on airnav.com; /airport/<ICAO> links are the site's pages." },
  { id: "d36", title: "Standard Ebooks: 15th easiest mystery", host: /standardebooks\.org/i, forbidden: /standardebooks\.org\/(feeds|opds|api)\b|\.(atom|opds)\b/i, chk: d36,
    prompt: `On standardebooks.org, browse the "Mystery" subject, sort by "Reading ease (easy → hard)", with the default of 12 ebooks per page. What is the title of the 15th ebook in that listing (the third one on page 2)?\n${ASK("<title>")}`,
    wf: "Filter, sort and page live in the query string; the listing page is the site's own." },
  { id: "d37", title: "SMHI: tomorrow's high in Stockholm", host: /smhi\.se/i, forbidden: /opendata-download|smhi\.se\/api\//i, chk: d37,
    prompt: `On smhi.se (the Swedish Meteorological and Hydrological Institute), open the weather forecast for Stockholm. What is the highest temperature forecast for tomorrow (local date), in degrees Celsius? Round to a whole degree if the site shows decimals.\n${ASK("<N>")}`,
    wf: "The location forecast page is client-rendered; reading it is the interface." },
  { id: "d38", title: "Our World in Data: solar share of electricity", host: /ourworldindata\.org/i, forbidden: /ourworldindata\.org\/[^\s"']*(\.csv|\.json|\/api\/)/i, chk: d38,
    prompt: `On ourworldindata.org, open the chart "Share of electricity generated by solar". Select Spain, Germany, Italy and Poland and, for the latest year available, find which of the four has the highest share, and what the share is (percent, one decimal).\n${ASK("<country>, <x.x>")}`,
    wf: "The grapher chart is client-rendered; selecting countries and reading values is the interface; CSV/JSON downloads are excluded." },
  { id: "d39", title: "Our World in Data: internet users", host: /ourworldindata\.org/i, forbidden: /ourworldindata\.org\/[^\s"']*(\.csv|\.json|\/api\/)/i, chk: d39,
    prompt: `On ourworldindata.org, open the chart "Share of the population using the Internet" (share of individuals using the internet). Select Chile, Mexico, Peru and Colombia and, for the latest year available, find which of the four has the highest share, and the value (percent, one decimal).\n${ASK("<country>, <x.x>")}`,
    wf: "The grapher chart is client-rendered; selecting countries and reading values is the interface; CSV/JSON downloads are excluded." },
  { id: "d40", title: "Formula 1: 11th in the 2021 drivers' standings", host: /formula1\.com/i, forbidden: /api\.formula1\.com|ergast|jolpi/i, chk: d40,
    prompt: `On formula1.com, open the results archive for the 2021 season and its Drivers' standings. Which driver finished 11th, and how many points did they score?\n${ASK("<driver name>, <points>")}`,
    wf: "The standings page for a season is a normal page (results/2021/drivers); the season selector navigates to it." },
];
export const blind3: Task[] = specs.map(mk);

// ---------------------------------------------------------------- samples: one right and one wrong final answer per task (t = the truth snapshot from prepare)
const S = (right: (t: any) => string, wrong: (t: any) => string) => ({ right, wrong });
const sum = (t: number[]) => t.reduce((a, b) => a + b, 0);
export const blind3Samples: Record<string, { right: (t: any) => string; wrong: (t: any) => string }> = {
  d1: S((t) => sum(t).toFixed(2), (t) => (sum(t) + 12.5).toFixed(2)),
  d2: S((t) => t.join(" | "), (t) => [...t].reverse().join(" | ")),
  d3: S((t) => { const b = [...t].sort((a: any, c: any) => c.longest - a.longest)[0]; return `${b.icao}, ${b.longest}`; }, (t) => { const b = [...t].sort((a: any, c: any) => a.longest - c.longest)[0]; return `${b.icao}, ${b.longest}`; }),
  d4: S((t) => `clipper=$${t.clipper.toFixed(2)}; senior=$${t.senior.toFixed(2)}`, (t) => `clipper=$${(t.clipper + 1.5).toFixed(2)}; senior=$${(t.senior + 1.5).toFixed(2)}`),
  d5: S((t) => { const b = [...t].sort((a: any, c: any) => a.year - c.year)[0]; return `${b.n}, ${b.year}`; }, (t) => { const b = [...t].sort((a: any, c: any) => c.year - a.year)[0]; return `${b.n}, ${b.year}`; }),
  d6: S((t) => `max=${t.max}; min=${t.min}`, (t) => `max=${t.max + 7}; min=${t.min + 7}`),
  d7: S((t) => `2y=${t.y2.toFixed(2)}; 10y=${t.y10.toFixed(2)}`, (t) => `2y=${(t.y2 + 0.4).toFixed(2)}; 10y=${(t.y10 + 0.4).toFixed(2)}`),
  d8: S((t) => `CA=${t.ca.toFixed(3)}; WA=${t.wa.toFixed(3)}; higher=${t.ca > t.wa ? "CA" : "WA"}`, (t) => `CA=${(t.ca + 0.2).toFixed(3)}; WA=${t.wa.toFixed(3)}; higher=${t.ca > t.wa ? "WA" : "CA"}`),
  d9: S((t) => `I=${t.a}; III=${t.b}`, (t) => `I=${t.a + 5}; III=${t.b + 5}`),
  d10: S((t) => `${["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][t.months[0]]} 2024, ${t.lo.toFixed(1)}`, (t) => `${t.months[0] === 1 ? "February" : "January"} 2024, ${(t.lo + 1).toFixed(1)}`),
  d11: S((t) => `ew=${t.ew}; scotland=${t.sc}; ni=${t.ni}`, (t) => `ew=${t.ew + 3}; scotland=${t.sc + 3}; ni=${t.ni + 3}`),
  d12: S((t) => `VT=${t.vt}; NH=${t.nh}; ME=${t.me}`, (t) => `VT=${t.vt + 9}; NH=${t.nh + 9}; ME=${t.me + 9}`),
  d13: S((t) => `30y=${t.r30.toFixed(2)}; 15y=${t.r15.toFixed(2)}`, (t) => `30y=${(t.r30 + 0.5).toFixed(2)}; 15y=${(t.r15 + 0.5).toFixed(2)}`),
  d14: S((t) => `recruiting=${t.rec}; not_yet=${t.nyr}`, (t) => `recruiting=${t.rec + 30}; not_yet=${t.nyr + 30}`),
  d15: S((t) => String(t), (t) => String(Math.round(t * 2 + 50))),
  d16: S((t) => String(t), (t) => String(t + 20)),
  d17: S((t) => `odyssey=${t.a}; f150=${t.b}`, (t) => `odyssey=${t.a + 9}; f150=${t.b + 9}`),
  d18: S((t) => `prius=${t.prius.mpg}/$${t.prius.cost}; camry=${t.camry.mpg}/$${t.camry.cost}`, (t) => `prius=${t.prius.mpg + 9}/$${t.prius.cost + 300}; camry=${t.camry.mpg + 9}/$${t.camry.cost + 300}`),
  d19: S((t) => `${t.best[0].year}, ${t.mx}`, (t) => `${t.best[0].year + 4}, ${t.mx + 17}`),
  d20: S((t) => `${t.team}, ${t.pts}`, (t) => `${t.team}, ${t.pts + 41}`),
  d21: S((t) => `${t.first}, ${t.titled}`, (t) => `${t.first}, ${t.titled === 0 ? 7 : t.titled - 1}`),
  d22: S((t) => `${t.best[0].team}, ${t.mx}`, (t) => `${t.best[0].team}, ${t.mx - 9}`),
  d23: S((t) => { const b = [...t].sort((a: any, c: any) => c.cook - a.cook)[0]; return `${b.name}, ${b.cook}`; }, (t) => { const b = [...t].sort((a: any, c: any) => a.cook - c.cook)[0]; return `${b.name}, ${b.cook}`; }),
  d24: S((t) => String(t), (t) => String(t + 400)),
  d25: S((t) => `chf=${t.chf}; inr=${t.inr}`, (t) => `chf=${t.chf * 1.2}; inr=${t.inr * 1.2}`),
  d26: S((t) => `JPY100=${String(t.jpy).replace(".", ",")}; CHF=${String(t.chf).replace(".", ",")}`, (t) => `JPY100=${(t.jpy + 3).toFixed(3)}; CHF=${(t.chf + 3).toFixed(3)}`),
  d27: S((t) => String(t), (t) => String(Math.round(t / 2))),
  d28: S((t) => `${t.best[0].c}, ${t.mx}`, (t) => `${t.best[0].c}, ${(t.mx + 1.5).toFixed(2)}`),
  d29: S((t) => `fixed=${t.fixed.toFixed(2)}; composite=${t.comp.toFixed(2)}`, (t) => `fixed=${(t.fixed + 1).toFixed(2)}; composite=${(t.comp + 1).toFixed(2)}`),
  d30: S((t) => t[2], (t) => t[0] === t[2] ? "Tetris" : "Tetris Unknown Edition"),
  d31: S((t) => `${t.top}=${t.topCount}; Environnement=${t.env}`, (t) => `${t.top}=${t.topCount + 40}; Environnement=${t.env + 40}`),
  d32: S((t) => { const w = t.all.find((x: any) => x.d === t.mx); return `${w.city}, ${w.d}`; }, (t) => { const w = t.all.find((x: any) => x.d !== t.mx); return `${w.city}, ${w.d}`; }),
  d33: S((t) => `japan=${t.jp}; south-korea=${t.kr}; thailand=${t.th}`, (t) => `japan=${t.jp + 4}; south-korea=${t.kr + 4}; thailand=${t.th + 4}`),
  d34: S((t) => `mythic=${t.myth}; red=${t.red}`, (t) => `mythic=${t.myth + 31}; red=${t.red + 31}`),
  d35: S((t) => { const b = [...t].sort((a: any, c: any) => c.elev - a.elev)[0]; return `${b.icao}, ${Math.round(b.elev)}`; }, (t) => { const b = [...t].sort((a: any, c: any) => a.elev - c.elev)[0]; return `${b.icao}, ${Math.round(b.elev)}`; }),
  d36: S((t) => t, (t) => "The Hound of the Baskervilles Revisited"),
  d37: S((t) => String(Math.round(t.max)), (t) => String(Math.round(t.max) + 9)),
  d38: S((t) => { const b = [...t].sort((a: any, c: any) => c.v - a.v)[0]; return `${NAME[b.c]}, ${b.v.toFixed(1)}`; }, (t) => { const b = [...t].sort((a: any, c: any) => a.v - c.v)[0]; return `${NAME[b.c]}, ${b.v.toFixed(1)}`; }),
  d39: S((t) => { const b = [...t].sort((a: any, c: any) => c.v - a.v)[0]; return `${NAME[b.c]}, ${b.v.toFixed(1)}`; }, (t) => { const b = [...t].sort((a: any, c: any) => a.v - c.v)[0]; return `${NAME[b.c]}, ${b.v.toFixed(1)}`; }),
  d40: S((t) => `${t.name}, ${t.pts}`, (t) => `${t.name}, ${t.pts + 33}`),
};
void answerLine;
