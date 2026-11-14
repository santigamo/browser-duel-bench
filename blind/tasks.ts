// Blind suite b1..b20: everyday web tasks on real public sites, truth computed live at prepare/check time
// from each site's authoritative data (API / fetch+parse inside the checker). The agent never sees the checker.
import type { Task, Workflow } from "../src/tasks.ts";
import { live, getText, getJson, ghJson, strip, datesIn, dayDiff, numsIn, today, visited, resultShows, type Evidence } from "./lib.ts";
import { allOf, anyOf, inputShows } from "../src/measure.ts";

const END = (fmt: string) => `\n\nWhen you are done, give the final answer on the last line as \`ANSWER: ${fmt}\``;
const has = (line: string, token: string) => new RegExp(`(?<![\\w.])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w]|\\.\\d)`, "i").test(line);
const dateNear = (line: string, iso: string, tol = 1) => datesIn(line).some((d) => dayDiff(d, iso) <= tol);

type Spec = {
  id: string; title: string; prompt: string; fmt: string;
  impl: ReturnType<typeof live<any>>;
  forbidden?: RegExp; evidence?: Evidence[];
  /** validate.ts only: a correct and a plausible wrong answer line derived from the computed truth */
  right: (t: any) => string; wrong: (t: any) => string;
};
const specs: Spec[] = [];
const add = (s: Spec) => specs.push(s);

// ---- b1: version history list, count by year (historic, stable: past-year tags do not change) ----
add({
  id: "b1", title: "version history count for one year", fmt: "<integer>",
  prompt: `On pkg.go.dev, open the Versions tab of the Go module \`github.com/rs/zerolog\`. How many versions of it were published during calendar year 2021? Count every version listed with a 2021 date, pre-releases included.`,
  impl: live(async () => {
    const m = "github.com/rs/zerolog";
    const vs = (await getText(`https://proxy.golang.org/${m}/@v/list`)).split(/\s+/).filter(Boolean);
    const ts = await Promise.all(vs.map(async (v) => (await getJson(`https://proxy.golang.org/${m}/@v/${v}.info`)).Time as string));
    return { n: ts.filter((t) => t.startsWith("2021")).length };
  }, (t) => String(t.n), (l, t) => numsIn(l)[0] === t.n),
  forbidden: /proxy\.golang\.org/i, evidence: [visited("pkg.go.dev", /pkg\.go\.dev/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n + 3),
});

// ---- b2: conditional on today's date ----
add({
  id: "b2", title: "earliest still-future end of support", fmt: "<release cycle> <YYYY-MM-DD>",
  prompt: `On endoflife.date, open the page for Python. Among the Python release cycles whose end of security support is still in the future as of today, which one ends first? Give the cycle (like 3.x) and that end date. Use the website, not its API.`,
  impl: live(async () => {
    const d = await getJson("https://endoflife.date/api/python.json"); const td = today();
    const c = d.filter((x: any) => typeof x.eol === "string" && x.eol > td).sort((a: any, b: any) => (a.eol < b.eol ? -1 : 1))[0];
    return { cycle: c.cycle as string, eol: c.eol as string };
  }, (t) => `${t.cycle} ${t.eol}`, (l, t) => has(l, t.cycle) && dateNear(l, t.eol, 0)),
  forbidden: /endoflife\.date\/api/i, evidence: [visited("eol site", /endoflife\.date/i)],
  right: (t) => `${t.cycle} ${t.eol}`, wrong: (t) => `3.9 ${t.eol}`,
});

// ---- b3: compare two items on separate pages ----
add({
  id: "b3", title: "compare dependency counts", fmt: "<formula> <difference>",
  prompt: `On formulae.brew.sh, open the pages of the formulae \`ffmpeg\` and \`git\`. For each, count the runtime dependencies listed under "Depends on" (do not count the build-only ones listed separately). Which formula has more runtime dependencies, and by how many? Use the website, not its API.`,
  impl: live(async () => {
    const [a, b] = await Promise.all(["ffmpeg", "git"].map((f) => getJson(`https://formulae.brew.sh/api/formula/${f}.json`)));
    const ca = a.dependencies.length, cb = b.dependencies.length;
    return { win: ca >= cb ? "ffmpeg" : "git", lose: ca >= cb ? "git" : "ffmpeg", diff: Math.abs(ca - cb), ca, cb };
  }, (t) => `${t.win} +${t.diff} (${t.ca} vs ${t.cb})`, (l, t) => has(l, t.win) && !has(l, t.lose) && numsIn(l).includes(t.diff)),
  forbidden: /formulae\.brew\.sh\/api/i, // the formula pages may be opened in a loop (page.goto("https://formulae.brew.sh/formula/"+f)): the literal URL never appears in the inputs. Recorded navigations are
  // the primary evidence (visited() includes them); when none were recorded, a templated/concatenated formula URL plus both pages' text in the results counts.
  evidence: [anyOf("brew formula pages", visited("brew formula pages: literal", /formulae\.brew\.sh\/formula\/(ffmpeg|git)/i),
    allOf("formula pages opened in a loop", inputShows("templated formula URL", /formulae\.brew\.sh\/formula\/(\$\{|["'`]\s*\+)/), resultShows("ffmpeg page read", /ffmpeg/i), resultShows("git page read", /\bgit\b/i)))],
  right: (t) => `${t.win} ${t.diff}`, wrong: (t) => `${t.lose} ${t.diff}`,
});

// ---- b4: use the site's package search, then the detail page ----
add({
  id: "b4", title: "package search then detail", fmt: "<version> <installed size number as displayed>",
  prompt: `On archlinux.org, use the Packages section's search to find the official package named \`ripgrep\` for the x86_64 architecture. Open its package page and report its version (without the pkgrel suffix) and its installed size, as the number displayed on that page.`,
  impl: live(async () => {
    const d = await getJson("https://archlinux.org/packages/extra/x86_64/ripgrep/json/");
    return { ver: d.pkgver as string, mib: d.installed_size / 1048576, mb: d.installed_size / 1e6 };
  }, (t) => `${t.ver} ${t.mib.toFixed(1)} (MiB)`, (l, t) => {
    if (!has(l, t.ver)) return false;
    const rest = l.replace(t.ver, " ");
    return numsIn(rest).some((n) => Math.abs(n - t.mib) <= 0.11 || Math.abs(n - t.mb) <= 0.11);
  }),
  forbidden: /archlinux\.org\/packages\/[^\s"']*\/json/i, evidence: [visited("arch packages", /archlinux\.org\/packages/i)],
  right: (t) => `${t.ver} ${t.mib.toFixed(1)}`, wrong: (t) => `${t.ver} ${(t.mib + 1.5).toFixed(1)}`,
});

// ---- b5: client-rendered search UI with filters (historic window, stable) ----
add({
  id: "b5", title: "search with type and date filters", fmt: "<integer>",
  prompt: `On hn.algolia.com, search for \`sqlite\`, restrict the results to Stories, and set a custom date range from 2019-01-01 to 2019-12-31. How many results does the site report? Use the site's interface, not its API.`,
  impl: live(async () => {
    const a = Date.UTC(2019, 0, 1) / 1000, b = Date.UTC(2020, 0, 1) / 1000;
    const d = await getJson(`https://hn.algolia.com/api/v1/search?query=sqlite&tags=story&numericFilters=${encodeURIComponent(`created_at_i>=${a},created_at_i<${b}`)}&hitsPerPage=1`);
    return { n: d.nbHits as number };
  }, (t) => `${t.n} (+-3)`, (l, t) => { const n = numsIn(l)[0]; return n != null && Math.abs(n - t.n) <= 3; }),
  forbidden: /hn\.algolia\.com\/api|algolia\.net/i, evidence: [visited("algolia ui", /hn\.algolia\.com/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n + 40),
});

// ---- b6: pagination in a releases list ----
add({
  id: "b6", title: "second most recent release", fmt: "<tag> <YYYY-MM-DD>",
  prompt: `On GitHub, open the releases page of the repository \`casey/just\`. What is the tag of the second most recent release (the one published just before the latest), and on what date was it published? Use github.com pages, not the REST API.`,
  impl: live(async () => {
    let lst: { tag: string; date: string }[];
    try {
      const x = await getText("https://github.com/casey/just/releases.atom", {}, 4);
      const e = [...x.matchAll(/<entry>[\s\S]*?<\/entry>/g)].map((m) => m[0]);
      lst = e.map((s) => ({ tag: decodeURIComponent(s.match(/releases\/tag\/([^"]+)"/)![1]), date: s.match(/<updated>(\d{4}-\d{2}-\d{2})/)![1] }));
    } catch {
      const r = await ghJson("https://api.github.com/repos/casey/just/releases?per_page=10");
      lst = r.filter((x: any) => !x.draft && !x.prerelease).map((x: any) => ({ tag: x.tag_name, date: x.published_at.slice(0, 10) }));
    }
    lst.sort((a, b) => (a.date < b.date ? 1 : -1));
    return lst[1];
  }, (t) => `${t.tag} ${t.date}`, (l, t) => has(l, t.tag) && dateNear(l, t.date, 1)),
  forbidden: /api\.github\.com/i, evidence: [visited("repo releases", /github\.com\/casey\/just/i)],
  right: (t) => `${t.tag} ${t.date}`, wrong: (t) => `${t.tag}.1 ${t.date}`,
});

// ---- b7: issue search with label + date filter (historic, stable) ----
add({
  id: "b7", title: "issue search with label and date", fmt: "<integer>",
  prompt: `On GitHub, in the repository \`sharkdp/bat\`, how many issues (not pull requests; open and closed together) carrying the label \`bug\` were created during calendar year 2023? Use github.com's issue search in the web interface, not the REST API.`,
  impl: live(async () => {
    const d = await ghJson(`https://api.github.com/search/issues?q=${encodeURIComponent("repo:sharkdp/bat is:issue label:bug created:2023-01-01..2023-12-31")}&per_page=1`);
    return { n: d.total_count as number };
  }, (t) => String(t.n), (l, t) => numsIn(l)[0] === t.n),
  forbidden: /api\.github\.com/i, evidence: [visited("repo issues", /github\.com\/sharkdp\/bat/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n + 5),
});

// ---- b8: multi-field search form (historic window) ----
add({
  id: "b8", title: "earthquake catalog search form", fmt: "<integer>",
  prompt: `Using the earthquake catalog search form on earthquake.usgs.gov (the website's search page, not the raw web-service URLs), count the earthquakes worldwide with magnitude 5.5 or greater from 2022-06-01 through 2022-08-31 inclusive (UTC). How many are there?`,
  impl: live(async () => {
    const n = Number((await getText("https://earthquake.usgs.gov/fdsnws/event/1/count?starttime=2022-06-01T00:00:00&endtime=2022-09-01T00:00:00&minmagnitude=5.5")).trim());
    return { n };
  }, (t) => `${t.n} (+-2)`, (l, t) => { const n = numsIn(l)[0]; return n != null && Math.abs(n - t.n) <= 2; }),
  forbidden: /fdsnws/i, evidence: [visited("usgs site", /earthquake\.usgs\.gov/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n + 25),
});

// ---- b9: find a work, read a count on its page ----
add({
  id: "b9", title: "find work, read edition count", fmt: "<integer>",
  prompt: `On openlibrary.org, find the work "The Dispossessed" by Ursula K. Le Guin (the novel itself, not a collection containing it). How many editions does Open Library list for that work? Use the website pages, not its JSON endpoints.`,
  impl: live(async () => {
    const d = await getJson("https://openlibrary.org/search.json?title=the+dispossessed&author=le+guin&fields=key,title,edition_count");
    const w = d.docs.find((x: any) => x.title.toLowerCase() === "the dispossessed");
    return { n: w.edition_count as number, key: w.key as string };
  }, (t) => `${t.n} (+-2)`, (l, t) => { const n = numsIn(l)[0]; return n != null && Math.abs(n - t.n) <= 2; }),
  forbidden: /openlibrary\.org\/[^\s"']*\.json|search\.json/i, evidence: [visited("openlibrary", /openlibrary\.org/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n + 20),
});

// ---- b10: two lookups, then arithmetic (historic, stable) ----
add({
  id: "b10", title: "cross rate from two reference rates", fmt: "<number with 4 decimals>",
  prompt: `Using the European Central Bank's published euro foreign exchange reference rates for 14 September 2023 (the USD and CHF rates quoted against the euro), compute how many US dollars one Swiss franc was worth (USD per 1 CHF). Round to 4 decimals.`,
  impl: live(async () => {
    const r = async (c: string) => Number((await getText(`https://data-api.ecb.europa.eu/service/data/EXR/D.${c}.EUR.SP00.A?startPeriod=2023-09-14&endPeriod=2023-09-14&format=csvdata`)).trim().split("\n")[1].split(",")[7]);
    const usd = await r("USD"), chf = await r("CHF");
    return { usd, chf, x: usd / chf };
  }, (t) => `${t.x.toFixed(4)} (usd ${t.usd}, chf ${t.chf})`, (l, t) => numsIn(l).some((n) => Math.abs(n - t.x) <= 0.001)),
  evidence: [visited("ecb site", /ecb\.europa\.eu/i)],
  right: (t) => t.x.toFixed(4), wrong: (t) => (1 / t.x).toFixed(4),
});

// ---- b11: faceted search form (historic window) ----
add({
  id: "b11", title: "faceted document search", fmt: "<integer>",
  prompt: `On federalregister.gov, use the document search with filters to find how many documents of type "Proposed Rule" were published by the Environmental Protection Agency between 2023-03-01 and 2023-03-31. Use the website's search, not its API.`,
  impl: live(async () => {
    const d = await getJson("https://www.federalregister.gov/api/v1/documents.json?per_page=1&conditions[type][]=PRORULE&conditions[agencies][]=environmental-protection-agency&conditions[publication_date][gte]=2023-03-01&conditions[publication_date][lte]=2023-03-31");
    return { n: d.count as number };
  }, (t) => String(t.n), (l, t) => numsIn(l)[0] === t.n),
  forbidden: /federalregister\.gov\/api/i, evidence: [visited("federalregister", /federalregister\.gov/i)],
  right: (t) => String(t.n), wrong: (t) => String(t.n - 4),
});

// ---- b12: client-rendered pages, four items, rank then read a field ----
add({
  id: "b12", title: "rank four crates by downloads", fmt: "<crate> <version>",
  prompt: `On crates.io, look at these four Rust crates: \`oorandom\`, \`fastrand\`, \`nanorand\` and \`tinyrand\`. Rank them by all-time downloads. Which crate has the third-highest all-time download count, and what is its latest version number?`,
  impl: live(async () => {
    const cs = await Promise.all(["oorandom", "fastrand", "nanorand", "tinyrand"].map((c) => getJson(`https://crates.io/api/v1/crates/${c}`).then((d) => d.crate)));
    cs.sort((a: any, b: any) => b.downloads - a.downloads);
    const c = cs[2]; return { name: c.id as string, vers: [c.newest_version, c.max_version, c.max_stable_version, c.default_version].filter(Boolean) as string[], order: cs.map((x: any) => x.id).join(">") };
  }, (t) => `${t.name} ${t.vers[0]} (order ${t.order})`, (l, t) => has(l, t.name) && t.vers.some((v: string) => has(l, v))),
  forbidden: /crates\.io\/api|static\.crates\.io/i, evidence: [visited("crates.io", /crates\.io/i)],
  right: (t) => `${t.name} ${t.vers[0]}`, wrong: (t) => `${t.name} 9.9.9`,
});

// ---- b13: table with date logic ----
add({
  id: "b13", title: "table filter by projected EOL", fmt: "<version> <integer>",
  prompt: `On kernel.org, open the Releases page (kernel.org/category/releases.html) and look at the table of longterm kernels. Among those whose projected EOL falls in 2027, which has the most recent release date? Also, how many longterm kernel lines in that table have a projected EOL in 2028? Give the version and the count.`,
  impl: live(async () => {
    const h = await getText("https://www.kernel.org/category/releases.html");
    const seg = h.slice(h.indexOf("Projected EOL"));
    const rows = [...seg.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => strip(m[0])).map((s) => s.match(/^(\d+\.\d+)\s.*?(\d{4}-\d{2}-\d{2})\s+[A-Za-z]{3,9},? (\d{4})/)).filter(Boolean) as RegExpMatchArray[];
    const r = rows.map((m) => ({ v: m[1], rel: m[2], eolY: m[3] }));
    const y27 = r.filter((x) => x.eolY === "2027").sort((a, b) => (a.rel < b.rel ? 1 : -1))[0];
    return { v: y27.v as string, n28: r.filter((x) => x.eolY === "2028").length, rows: r.length };
  }, (t) => `${t.v} ${t.n28} (${t.rows} rows)`, (l, t) => has(l, t.v) && numsIn(l.replace(t.v, " ")).includes(t.n28)),
  evidence: [visited("kernel.org", /kernel\.org/i)],
  right: (t) => `${t.v} ${t.n28}`, wrong: (t) => `${t.v} ${t.n28 + 2}`,
});

// ---- b14: fill and submit a demo form, read the echo ----
const FORM_BODY = "custname=Ada+Quill&custtel=555-0142&custemail=ada%40example.org&size=large&topping=bacon&topping=onion&delivery=18%3A45&comments=ring+twice";
add({
  id: "b14", title: "fill and submit a demo order form", fmt: "<Content-Length value>",
  prompt: `Open https://httpbin.org/forms/post (a demo order form that only echoes what it receives) and fill it in with: customer name "Ada Quill", telephone "555-0142", e-mail "ada@example.org", size Large, toppings Bacon and Onion only, preferred delivery time 18:45, delivery instructions "ring twice". Submit it with the form's own button. In the response page the server echoes the request; report the value of the Content-Length header it shows.`,
  impl: live(async () => ({ len: new TextEncoder().encode(FORM_BODY).length }),
    (t) => `${t.len} (or ${t.len + 3} if time sent with seconds)`, (l, t) => { const n = numsIn(l)[0]; return n === t.len || n === t.len + 3; }),
  forbidden: /httpbin\.org\/post/i,
  evidence: [allOf("server echoed the submitted fields", resultShows("echo tel", /custtel\W{1,6}555-0142/), resultShows("echo time", /delivery\W{1,6}18:45/), resultShows("echo note", /comments\W{1,6}ring twice/))],
  right: (t) => String(t.len), wrong: (t) => String(t.len - 7),
});

// ---- b15: client-side table with search / paging (static data) ----
add({
  id: "b15", title: "table filter and sum", fmt: "<integer dollars>",
  prompt: `On datatables.net, open the "Zero configuration" basic initialisation example. The table there lists employees across several pages. What is the combined salary, in dollars, of all employees whose office is London?`,
  impl: live(async () => {
    const h = await getText("https://datatables.net/examples/basic_init/zero_configuration.html");
    const body = h.slice(h.indexOf("<tbody>"), h.indexOf("</tbody>"));
    const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1])));
    const sel = rows.filter((r) => r[2] === "London");
    return { sum: sel.reduce((s, r) => s + Number(r[5].replace(/[^\d]/g, "")), 0), n: sel.length, total: rows.length };
  }, (t) => `${t.sum} (${t.n} of ${t.total} rows)`, (l, t) => numsIn(l)[0] === t.sum),
  evidence: [visited("datatables", /datatables\.net/i)],
  right: (t) => `$${t.sum.toLocaleString("en-US")}`, wrong: (t) => String(t.sum + 1000),
});

// ---- b16: search, several detail pages, tab content, compare ----
add({
  id: "b16", title: "search, open editions, compare release dates", fmt: "<ebook number> <YYYY-MM-DD>",
  prompt: `On gutenberg.org, search for "flatland". Several ebooks are titled "Flatland: A Romance of Many Dimensions". Among those, find the one with the earliest Release Date in its bibliographic record. Give its ebook number and that release date (as YYYY-MM-DD).`,
  impl: live(async () => {
    const s = await getText("https://www.gutenberg.org/ebooks/search/?query=flatland");
    const items = [...s.matchAll(/<li class="booklink">[\s\S]*?<\/li>/g)].map((m) => m[0]).filter((x) => /Flatland: A Romance of Many Dimensions/.test(x));
    const ids = [...new Set(items.map((x) => x.match(/\/ebooks\/(\d+)/)![1]))];
    const rec = await Promise.all(ids.map(async (id) => ({ id, date: datesIn(strip(await getText(`https://www.gutenberg.org/ebooks/${id}`)).match(/Release Date ([A-Za-z]+ \d+, \d{4})/)![1])[0] })));
    rec.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { id: rec[0].id, date: rec[0].date, n: rec.length };
  }, (t) => `${t.id} ${t.date} (of ${t.n})`, (l, t) => has(l, t.id) && dateNear(l, t.date, 0)),
  evidence: [visited("gutenberg", /gutenberg\.org/i), resultShows("saw a release date", /Release\s*Date/i)],
  right: (t) => `${t.id} ${t.date}`, wrong: (t) => `201 1995-01-01`,
});

// ---- b17: conditional on version series (historic, stable) ----
add({
  id: "b17", title: "latest stable in an old series", fmt: "<version> <YYYY-MM-DD>",
  prompt: `On rubygems.org, open the versions list of the gem \`sinatra\`. What is the latest non-prerelease version in the 2.x series (version number starting with 2.), and on what date was it released? Use the website, not its API.`,
  impl: live(async () => {
    const d = await getJson("https://rubygems.org/api/v1/versions/sinatra.json");
    const c = d.filter((x: any) => /^2\./.test(x.number) && !x.prerelease).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))[0];
    return { v: c.number as string, date: c.created_at.slice(0, 10) as string };
  }, (t) => `${t.v} ${t.date}`, (l, t) => has(l, t.v) && dateNear(l, t.date, 1)),
  forbidden: /rubygems\.org\/api/i, evidence: [visited("rubygems", /rubygems\.org\/gems\/sinatra/i)],
  right: (t) => `${t.v} ${t.date}`, wrong: (t) => `2.0.0 ${t.date}`,
});

// ---- b18: two country lookups on a client-rendered portal, difference ----
add({
  id: "b18", title: "compare two countries on a data portal", fmt: "<number with 1 decimal>",
  prompt: `On data.worldbank.org, find the indicator "Individuals using the Internet (% of population)". Using its 2022 values, how many percentage points higher (or lower, give a negative number) is Uruguay than Paraguay? Round to 1 decimal. Use the website, not the API.`,
  impl: live(async () => {
    const v = async (c: string) => (await getJson(`https://api.worldbank.org/v2/country/${c}/indicator/IT.NET.USER.ZS?format=json&date=2022`))[1][0].value as number;
    const u = await v("URY"), p = await v("PRY"); return { u, p, d: u - p };
  }, (t) => `${t.d.toFixed(1)} (URY ${t.u.toFixed(2)}, PRY ${t.p.toFixed(2)}; +-0.3)`, (l, t) => numsIn(l).some((n) => Math.abs(n - t.d) <= 0.3)),
  forbidden: /api\.worldbank\.org/i, evidence: [visited("worldbank", /worldbank\.org/i)],
  right: (t) => t.d.toFixed(1), wrong: (t) => (-t.d).toFixed(1),
});

// ---- b19: client-rendered library page, exact opaque value (stable: published file hash) ----
add({
  id: "b19", title: "library file integrity hash", fmt: "<full sha512-... integrity string>",
  prompt: `On cdnjs.com, open the library page for Bootstrap, select version 5.3.0, and find the SRI (Subresource Integrity) hash that cdnjs lists for the file \`css/bootstrap.min.css\`. Report the full integrity string. Use the website, not its API.`,
  impl: live(async () => ({ sri: (await getJson("https://api.cdnjs.com/libraries/bootstrap/5.3.0?fields=sri")).sri["css/bootstrap.min.css"] as string }),
    (t) => t.sri, (l, t) => l.replace(/\s/g, "").includes(t.sri)),
  forbidden: /api\.cdnjs\.com/i, evidence: [visited("cdnjs", /cdnjs\.com/i)],
  right: (t) => t.sri, wrong: (t) => t.sri.slice(0, -6) + "AAAA==",
});

// ---- b20: table with status condition, then a detail ----
add({
  id: "b20", title: "status-conditioned table lookup", fmt: "<codename> <version>",
  prompt: `On nodejs.org, open the page listing previous Node.js releases (About > Previous Releases). Look only at release lines whose Status is currently "LTS" (not Maintenance, Current or EOL). Among those, take the one that was first released earliest. Give its codename and the latest version number of that line.`,
  impl: live(async () => {
    const h = await getText("https://nodejs.org/en/about/previous-releases");
    const rows = [...h.matchAll(/<tr data-label="(v[\d.]+)">([\s\S]*?)<\/tr>/g)].map((m) => ({ v: m[1], code: strip(m[2].match(/Codename">([^<]*)</)![1]), first: m[2].match(/First released"><time dateTime="([\d-]+)/)![1], status: strip(m[2].match(/Status">([\s\S]*?)<\/td>/)![1]) }));
    const l = rows.filter((r) => r.status === "LTS").sort((a, b) => (a.first < b.first ? -1 : 1))[0];
    return { code: l.code as string, v: l.v as string };
  }, (t) => `${t.code} ${t.v}`, (l, t) => has(l, t.code) && has(l.replace(/\bv(?=\d)/gi, ""), t.v.replace(/^v/, ""))),
  forbidden: /dist\/index\.json/i, evidence: [visited("nodejs.org", /nodejs\.org/i)],
  right: (t) => `${t.code} ${t.v}`, wrong: (t) => `${t.code} v0.0.1`,
});

// ---- Endpoint policy and workflow rubrics (guard/endpoint-policy.md), the same rule for every task here and in blind2/tasks.ts ----
// Site pages and on-site deep links are allowed; JSON/API data endpoints are forbidden unless the prompt allows them (none does). `forbidden` above names
// each site's own data endpoints where the prompt did; this table adds the ones the prompt did not spell out, so b10 and b13 follow the same rule as b2 or b11.
const ECB_DATA = /data-api\.ecb\.europa\.eu|sdw-wsrest\.ecb\.europa\.eu|\/service\/data\//i;
const GUTENBERG_DATA = /gutenberg\.org\/ebooks\/(?:\d+\.(?:rdf|opds)|search\.opds)|gutenberg\.org\/cache\/epub\/[^\s"']*\.rdf|gutendex\.com/i;
const EXTRA_FORBIDDEN: Record<string, RegExp> = {
  b9: /openlibrary\.org\/api\//i,
  b10: ECB_DATA,
  b13: /kernel\.org\/releases\.json/i,
  b16: GUTENBERG_DATA,
  b20: /nodejs\.org\/(?:dist|download\/release)\/index\.(?:json|tab)/i,
};
const union = (...r: (RegExp | undefined)[]) => { const l = r.filter((x): x is RegExp => !!x); return l.length ? new RegExp(l.map((x) => x.source).join("|"), "i") : undefined; };
const FORM_USED = inputShows("filled or clicked the form controls", /\b(fill|type|check|click|select(?:Option)?|press|setValue)\b|\.value\s*=/i);
const DEEP_OK = (what: string): Workflow => ({ deepLink: "satisfies", rubric: `${what} A URL of the site's own pages (query string included) that renders the result in the browser satisfies this; the site's API or data endpoints do not.` });
const WORKFLOW: Record<string, Workflow> = {
  b1: DEEP_OK("Prompt: open the Versions tab on pkg.go.dev."),
  b2: DEEP_OK("Prompt: use the website, not its API."),
  b3: DEEP_OK("Prompt: open the two formula pages; use the website, not its API."),
  b4: DEEP_OK("Prompt: use the Packages search, then the package page. Going straight to the package page URL skips the search step but reads the same rendered page; the search step is not what is measured (judged)."),
  b5: DEEP_OK("Prompt: use the site's interface, not its API. The Algolia UI keeps query, type and date range in its URL, so a deep link is the interface, clicking through is not required (judged: b5 clicking through vs deep link)."),
  b6: DEEP_OK("Prompt: use github.com pages, not the REST API."),
  b7: DEEP_OK("Prompt: use github.com's issue search in the web interface; a search URL with the query is that interface."),
  b8: { deepLink: "does-not-satisfy", rubric: "Prompt: use the catalog search form, not the raw web-service URLs. The form has no URL state, so reaching the count requires operating it; a request to the web service (fdsnws) is the thing excluded.", interaction: [FORM_USED] },
  b9: DEEP_OK("Prompt: use the website pages, not its JSON endpoints."),
  b11: DEEP_OK("Prompt: use the website's search, not its API; the search page URL with filters in its query string is the website's search (same rule as blind2 c10)."),
  b14: { deepLink: "does-not-satisfy", rubric: "Prompt: fill the form and submit it with the form's own button. The deliverable is the interaction; a direct request to the echo endpoint does not satisfy it.", interaction: [FORM_USED] },
  b16: DEEP_OK("Prompt: search on gutenberg.org, then open the ebook pages."),
  b17: DEEP_OK("Prompt: use the website, not its API."),
  b18: DEEP_OK("Prompt: use the website, not the API."),
  b19: DEEP_OK("Prompt: use the website, not its API; the library page URL with the version in its path is the site."),
  b20: DEEP_OK("Prompt: open the previous releases page on nodejs.org."),
};
export const blind: Task[] = specs.map((s) => ({
  id: s.id, suite: "blind" as const, title: s.title,
  prompt: () => s.prompt + END(s.fmt),
  prepare: s.impl.prepare, check: s.impl.check, snapshotAware: s.impl.snapshotAware, forbidden: union(s.forbidden, EXTRA_FORBIDDEN[s.id]), evidence: s.evidence, workflow: WORKFLOW[s.id],
}));
/** validate.ts only */
export const blindSamples: Record<string, { right: (t: any) => string; wrong: (t: any) => string }> = Object.fromEntries(specs.map((s) => [s.id, { right: s.right, wrong: s.wrong }]));
