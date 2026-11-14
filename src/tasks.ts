import * as fx from "./fixtures.ts";
import { type Evidence, resultShows, inputShows, anyOf, allOf } from "./measure.ts";

export type Task = {
  id: string; suite: "everyday" | "fixtures" | "heldout" | "blind" | "blind2" | "blind3" | "blind4" | "diag-r9" | "diagnostic"; title: string;
  prompt: (base: string) => string;
  /** Computes truth at check time; never visible to the agent. */
  prepare?: () => Promise<any>;                 // called before the run (e.g. HN snapshot)
  /**
   * SCORING CONTRACT (src/scoring.ts): `answer` is the text after the LAST "ANSWER:" marker of the agent's final message, marker removed.
   * The harness itself fails a run whose final message has no marker (unless `markerOptional`), so a checker never sees marker-less text.
   * `ctx.snapshots`, when present, are the stored truth snapshots of the original run: a snapshot-aware checker must use them and not recompute live data.
   */
  check: (answer: string, ctx: { pre?: any; toolText: string; snapshots?: any[] }) => Promise<{ ok: boolean; truth: string; note?: string; state?: any[] }>;
  /** True for checkers that honour ctx.snapshots (see live() in blind/lib.ts); rescoring reports the others as live. */
  snapshotAware?: boolean;
  /** The task accepts a final message without the ANSWER: marker (the last non-empty line is then the answer). Default: a missing marker fails the run. */
  markerOptional?: boolean;
  /** extra violation detector over concatenated tool call inputs */
  forbidden?: RegExp;
  /** Also count a recorded browser navigation to a URL matching `forbidden` as the violation (catches URLs a script built). Default: true for blind suites (their rules name API endpoints), false elsewhere (a click-through may land on the page). */
  forbiddenNav?: boolean;
  /** Requirements over the tool transcript that must hold in addition to the answer check: the answer alone does not pass. */
  evidence?: Evidence[];
  /** Endpoint policy exception (guard/endpoint-policy.md): URLs the task prompt itself allows to be used as data endpoints. None of the blind tasks has one. */
  allowApi?: RegExp;
  /** Workflow rubric for prompts that say to use the site's interface; scored apart from answer correctness (src/workflow.ts). */
  workflow?: Workflow;
};
export type Workflow = {
  /** Does reaching the data through a direct deep link (a URL of the site's own pages, query string included, loaded and read in the browser) satisfy the prompt? */
  deepLink: "satisfies" | "does-not-satisfy";
  /** What the prompt asks for and why a deep link does or does not satisfy it. */
  rubric: string;
  /** Only with deepLink "does-not-satisfy": evidence of the interaction itself. */
  interaction?: Evidence[];
};

/** Generic: the run typed a query into something search-like (or the results show a search-results URL). */
export const siteSearchUsed = (): Evidence => anyOf("site search used",
  allOf("typed into a search control", inputShows("entered text", /\b(fill|type|keyboard)\b/i), inputShows("search-like target", /search|\bq\b/i)),
  resultShows("search results url", /\/search\?[^\s"']*\bq=/i));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.:@]+/g, " ").trim();
const digits = (s: string) => s.replace(/[,$\s]/g, "");
const has = (a: string, t: string) => norm(a).includes(norm(t));
const UA = { "user-agent": "Mozilla/5.0 (bench checker)" };

async function ghStars(): Promise<number> {
  const r = await fetch("https://api.github.com/repos/vercel-labs/agent-browser", { headers: UA });
  if (r.ok) return (await r.json()).stargazers_count;
  const p = Bun.spawnSync(["gh", "api", "repos/vercel-labs/agent-browser", "--jq", ".stargazers_count"]);
  return Number(p.stdout.toString().trim());
}
async function hnTop(n = 2): Promise<{ title: string; by: string; id: number }[]> {
  const ids: number[] = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")).json();
  return Promise.all(ids.slice(0, n).map(async (id) => { const it = await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json(); return { title: it.title, by: it.by, id }; }));
}
async function travelCheapest() {
  const html = await (await fetch("https://books.toscrape.com/catalogue/category/books/travel_2/index.html", { headers: UA })).text();
  const items = [...html.matchAll(/<h3><a [^>]*title="([^"]+)"[\s\S]*?class="price_color">[^\d]*([\d.]+)</g)].map((m) => ({ title: m[1].replace(/&#39;/g, "'").replace(/&amp;/g, "&"), price: Number(m[2]) }));
  items.sort((a, b) => a.price - b.price);
  return items[0];
}

async function booksCategory(slug: string) {
  const base = `https://books.toscrape.com/catalogue/category/books/${slug}/`;
  const items: { title: string; rating: string; href: string; price: number }[] = [];
  for (let url = base + "index.html"; url; ) {
    const html = await (await fetch(url, { headers: UA })).text();
    for (const m of html.matchAll(/<article class="product_pod">[\s\S]*?star-rating (\w+)[\s\S]*?<h3><a href="([^"]+)" title="([^"]+)"[\s\S]*?price_color">[^\d]*([\d.]+)</g))
      items.push({ rating: m[1], href: new URL(m[2], url).toString(), title: m[3], price: Number(m[4]) });
    const next = html.match(/<li class="next"><a href="([^"]+)"/)?.[1];
    url = next ? new URL(next, url).toString() : "";
  }
  return items;
}
async function laptops() {
  const out: { title: string; price: number }[] = [];
  for (let pg = 1; pg < 10; pg++) {
    const html = await (await fetch(`https://webscraper.io/test-sites/e-commerce/static/computers/laptops?page=${pg}`, { headers: UA })).text();
    const found = [...html.split('class="card thumbnail"').slice(1).map((blk) => blk.match(/price[^>]*>\$([\d.]+)</) && blk.match(/class="title"[^>]*title="([^"]+)"/) ? [null, blk.match(/class="title"[^>]*title="([^"]+)"/)![1], blk.match(/price[^>]*>\$([\d.]+)</)![1]] : null).filter(Boolean) as any[]];
    if (!found.length) break;
    for (const m of found) out.push({ title: m[1], price: Number(m[2]) });
  }
  return out;
}

export const tasks: Task[] = [
  // ---------------- diagnostic (never part of `all`, never in a benchmark) ----------------
  // Checks the restricted ab-cli shell from the agent's side: select with --tasks z-probe-shell on an ab-cli variant.
  { id: "z-probe-shell", suite: "diagnostic", title: "restricted shell probe",
    prompt: () => `Environment check, no browsing task. In the shell, run these three commands one by one and report what happened: (1) \`agent-browser run - <<'JS'\nreturn 6 * 7;\nJS\` (2) \`curl --version\` (3) \`python3 -c "print(1)"\`. Reply with \`ANSWER: run=<ok|fail>; curl=<ok|fail>; python3=<ok|fail>\` where ok means the command executed and fail means it could not be run.`,
    check: async (a) => ({ ok: /run\s*=\s*ok/i.test(a) && /curl\s*=\s*fail/i.test(a) && /python3\s*=\s*fail/i.test(a), truth: "run=ok; curl=fail; python3=fail" }) },

  // ---------------- everyday (live) ----------------
  { id: "e1", suite: "everyday", title: "search: DDG -> GitHub stars",
    prompt: () => `On DuckDuckGo (duckduckgo.com or html.duckduckgo.com), search for "agent-browser vercel-labs github", open the GitHub result for the repository, and report the repo's current star count rounded to the nearest thousand (for example "12k").`,
    check: async (a) => { const s = await ghStars(); const vals = [...a.matchAll(/(\d[\d,]*\.?\d*)\s*(k|thousand)?/gi)].map((m) => { let v = Number(m[1].replace(/,/g, "")); if (m[2]) v *= 1000; return v; });
      return { ok: vals.some((v) => Math.abs(v - s) <= 1000), truth: String(s) }; } },
  { id: "e2", suite: "everyday", title: "shopping: cheapest Travel book",
    prompt: () => `On https://books.toscrape.com, open the "Travel" category, find the cheapest book and report its title and price.`,
    check: async (a) => { const c = await travelCheapest(); const ok = a.replace(/[,]/g, "").includes(c.price.toFixed(2)) && norm(a).includes(norm(c.title).slice(0, 15)); return { ok, truth: `${c.title} £${c.price.toFixed(2)}` }; } },
  { id: "e3", suite: "everyday", title: "form: httpbin pizza order",
    prompt: () => `On https://httpbin.org/forms/post fill the form: customer name "Ana Test", telephone "600111222", e-mail "ana@example.com", size Medium, toppings bacon and onion, delivery time 19:30, comments "sin prisa". Submit it, then report the "custname" and "delivery" values echoed back by the server.`,
    check: async (a) => ({ ok: has(a, "Ana Test") && a.includes("19:30"), truth: "custname=Ana Test, delivery=19:30" }),
    // the answer only repeats prompt values; passing needs the server's echo of the submitted form in a tool result
    evidence: [resultShows("form submitted: server echoed custname", /"custname":\s*"Ana Test"/), resultShows("form submitted: echoed custtel", /"custtel":\s*"600111222"/), resultShows("form submitted: echoed custemail", /"custemail":\s*"ana@example\.com"/),
      resultShows("form submitted: echoed delivery", /"delivery":\s*"19:30"/), resultShows("form submitted: echoed comments", /"comments":\s*"sin prisa"/), resultShows("form submitted: echoed size", /"size":\s*"medium"/), resultShows("form submitted: echoed toppings", /"topping":\s*\[[^\]]*"bacon"[^\]]*"onion"|"topping":\s*\[[^\]]*"onion"[^\]]*"bacon"/)] },
  { id: "e4", suite: "everyday", title: "docs: MDN Array.at out of range",
    prompt: () => `Starting from https://developer.mozilla.org/en-US/ and using the site's search (do not type the final page URL directly), find what Array.prototype.at() returns when the index is out of range. Report the returned value.`,
    forbidden: /Array\/at\b/,
    check: async (a) => ({ ok: /\bundefined\b/i.test(a), truth: "undefined" }),
    // "undefined" is guessable: passing needs the site search used and the reference page actually read
    evidence: [siteSearchUsed(), resultShows("reference page for Array.prototype.at read", /Array\.prototype\.at|Array\/at\b/)] },
  { id: "e5", suite: "everyday", title: "news: HN #1 story + submitter",
    prompt: () => `On https://news.ycombinator.com, open the comments page of the current #1 story and report the story title and the username that submitted it.`,
    prepare: () => hnTop(2),
    check: async (a, { pre }) => { const cands = [...(pre ?? []), ...(await hnTop(2))]; const hit = cands.find((c) => norm(a).includes(norm(c.title).slice(0, 25)) && norm(a).includes(norm(c.by))); return { ok: !!hit, truth: cands.map((c) => `${c.title} by ${c.by}`).join(" | ") }; } },

  // ---------------- fixtures (local, controlled) ----------------
  { id: "f1", suite: "fixtures", title: "form + validation",
    prompt: (b) => `Go to ${b}/form and create an account: full name "Mara Quint", email "mara@example.com", country Portugal, plan Pro, subscribe to the newsletter, accept the terms, and use any password that satisfies the form's rules. Submit and report the confirmation code shown.`,
    check: async (a) => ({ ok: a.includes(fx.FORM_CODE), truth: fx.FORM_CODE }) },
  { id: "f2", suite: "fixtures", title: "catalog filter/sort/cart",
    prompt: (b) => `Go to ${b}/catalog. Search for "lamp", filter to brand Lumio and in-stock items only, sort by price low to high, add the cheapest matching item to the cart, and report the cart total.`,
    check: async (a) => ({ ok: a.includes(fx.CATALOG_TRUTH), truth: "$" + fx.CATALOG_TRUTH }) },
  { id: "f3", suite: "fixtures", title: "docs 3 clicks deep",
    prompt: (b) => `Go to ${b}/docs (Zephyr documentation). Find the default value of the configuration key cache.staleWhileRevalidate and report it.`,
    check: async (a) => ({ ok: digits(a).includes(fx.DOCS_TRUTH), truth: fx.DOCS_TRUTH }) },
  { id: "f4", suite: "fixtures", title: "paginated table sum",
    prompt: (b) => `Go to ${b}/table (revenue report, 3 pages). Compute the total Revenue (USD) of all rows whose Region is EMEA, across all 3 pages, and report the number.`,
    check: async (a) => ({ ok: digits(a).includes(fx.TABLE_TRUTH), truth: fx.TABLE_TRUTH }) },
  { id: "f5", suite: "fixtures", title: "login + delayed render",
    prompt: (b) => `Go to ${b}/login and sign in with email demo@acme.test and password Tr0ub4dor&3. Then open Settings and report the Account ID.`,
    check: async (a) => ({ ok: a.includes(fx.LOGIN_TRUTH), truth: fx.LOGIN_TRUTH }) },
  { id: "f6", suite: "fixtures", title: "long page + collapsed details",
    prompt: (b) => `Go to ${b}/longpage (Project Helios report). Find the revised budget cap stated after the March review and report it.`,
    check: async (a) => ({ ok: /\$?\s*4\.2\s*(m\b|million)/i.test(a) && !/3\.1/.test(a), truth: fx.LONG_TRUTH }) },
  { id: "f7", suite: "fixtures", title: "SPA modal + tabs",
    prompt: (b) => `Go to ${b}/spa (Portfolio Manager). Open the details of the project "Orion", go to its Budget tab, and report the approved budget.`,
    check: async (a) => ({ ok: digits(a).includes(digits(fx.SPA_TRUTH)), truth: fx.SPA_TRUTH }) },

  // ---------------- held-out (never tuned on; generic everyday patterns) ----------------
  { id: "h1", suite: "heldout", title: "pagination: count rated books",
    prompt: () => `On https://books.toscrape.com, in the "Mystery" category, count how many books have a rating of Three stars. Go through all pages of the category. Report the number.`,
    check: async (a) => { const n = (await booksCategory("mystery_3")).filter((b) => b.rating === "Three").length; return { ok: new RegExp(`\\b${n}\\b`).test(a), truth: String(n) }; } },
  { id: "h2", suite: "heldout", title: "conditional: stock decides which UPC",
    prompt: () => `On https://books.toscrape.com, open the "Poetry" category and look at its first book. If that book has more than 10 copies in stock, report its UPC; otherwise report the UPC of the second book in the category.`,
    check: async (a) => { const items = await booksCategory("poetry_23"); const info = async (u: string) => { const h = await (await fetch(u, { headers: UA })).text(); return { upc: h.match(/UPC<\/th>\s*<td>([^<]+)</)?.[1] ?? "", stock: Number(h.match(/In stock \((\d+) available\)/)?.[1] ?? 0) }; };
      const first = await info(items[0].href); const pick = first.stock > 10 ? first : await info(items[1].href); return { ok: a.includes(pick.upc) && !!pick.upc, truth: pick.upc + ` (first stock ${first.stock})` }; } },
  { id: "h3", suite: "heldout", title: "date/time form",
    prompt: (b) => `Go to ${b}/booking and book a room: check-in date 2026-12-24, arrival time 08:15, 3 guests, breakfast included, note "late checkout". Submit it and report the booking reference shown.`,
    check: async (a) => ({ ok: a.includes(fx.BOOKING_TRUTH), truth: fx.BOOKING_TRUTH }) },
  { id: "h4", suite: "heldout", title: "browse+filter on another real site",
    prompt: () => `On https://webscraper.io/test-sites/e-commerce/static, open Computers > Laptops and find the cheapest laptop whose title contains "Lenovo" (check all pages of the listing). Report its title and price.`,
    check: async (a) => { const l = (await laptops()).filter((x) => /lenovo/i.test(x.title)).sort((x, y) => x.price - y.price)[0]; return { ok: !!l && a.includes(l.price.toFixed(2)) && norm(a).includes(norm(l.title).slice(0, 12)), truth: l ? `${l.title} $${l.price}` : "none found" }; } },

  // ---- h5-h10: written by guard/heldout-tasks.md before the skill rewrite; never tuned on ----
  { id: "h5", suite: "heldout", title: "docs: What's New 3.12 PEPs",
    prompt: () => `On docs.python.org, open the 'What's New' document for Python 3.12. Find the section about the per-interpreter GIL and report the PEP number it refers to, and the PEP number of the section about the new type-parameter syntax for generic classes and functions. Reply with \`ANSWER: <gil-pep>, <type-param-pep>\`.`,
    check: async (a) => ({ ok: /684[\s\S]*695/.test(a), truth: "684, 695" }) },
  { id: "h6b", suite: "heldout", title: "form: demoqa text box",
    prompt: () => `Open https://demoqa.com/text-box. Fill Full Name 'Grace Hopper', Email 'grace@example.org', Current Address '1 Navy Way', Permanent Address '2 Harbor Rd', and submit. The page then shows the submitted values below the form. Report the Name and Email lines exactly as shown. Reply with \`ANSWER: <name line> | <email line>\`.`,
    check: async (a) => ({ ok: /Grace Hopper/i.test(a) && /grace@example\.org/i.test(a), truth: "Name:Grace Hopper | Email:grace@example.org" }) },
  { id: "h7", suite: "heldout", title: "search+compare: Dune years",
    prompt: () => `Using the search on openlibrary.org, find the works 'Dune' and 'Dune Messiah' by Frank Herbert. Report the first publish year of each and which came first. Reply with \`ANSWER: Dune=<year>; Dune Messiah=<year>; first=<title>\`.`,
    check: async (a) => ({ ok: /Dune\s*=\s*1965[\s\S]*Messiah\s*=\s*1969[\s\S]*first\s*=\s*Dune\b(?!\s*Messiah)/i.test(a), truth: "Dune=1965; Dune Messiah=1969; first=Dune" }) },
  { id: "h8", suite: "heldout", title: "pagination: quotes.toscrape",
    prompt: () => `On https://quotes.toscrape.com, starting from the home page, follow the Next button. On page 3, report the author of the first quote and the total number of quotes on page 3. Then report how many of the quotes on pages 1-3 combined are by Albert Einstein. Reply with \`ANSWER: <author>; <count on page 3>; <einstein count>\`.`,
    check: async (a) => { const pages: string[][] = []; for (const n of [1, 2, 3]) { const h = await (await fetch(`https://quotes.toscrape.com/page/${n}/`, { headers: UA })).text(); pages.push([...h.matchAll(/<small class="author"[^>]*>([^<]+)</g)].map((m) => m[1])); }
      const first = pages[2][0], c3 = pages[2].length, ein = pages.flat().filter((x) => x === "Albert Einstein").length;
      const parts = a.split(";").map((x) => x.trim()); const ok = parts.length >= 3 && norm(parts[0]).includes(norm(first)) && new RegExp(`\\b${c3}\\b`).test(parts[1]) && new RegExp(`\\b${ein}\\b`).test(parts[2]);
      return { ok, truth: `${first}; ${c3}; ${ein}` }; } },
  { id: "h9", suite: "heldout", title: "conditional: dynamic controls",
    prompt: () => `Open https://the-internet.herokuapp.com/dynamic_controls. If the checkbox in the first section is present, remove it with the button and wait until it is gone; if it is not present, add it back. Then enable the text input in the second section, wait until it is enabled, type 'done' into it. Report both status messages that appeared and the input's final value. Reply with \`ANSWER: <message1> | <message2> | <value>\`.`,
    check: async (a) => ({ ok: /it'?s gone/i.test(a) && /it'?s enabled/i.test(a) && /\bdone\b/i.test(a), truth: "It's gone! | It's enabled! | done" }) },
  { id: "h10", suite: "heldout", title: "toggle: TodoMVC filter",
    prompt: () => `Open the TodoMVC React example at https://todomvc.com/examples/react/dist/. Add three todos: 'alpha', 'beta', 'gamma'. Mark 'beta' as completed. Switch the filter to 'Active'. Report the visible todo titles and the 'items left' counter text. Reply with \`ANSWER: <titles comma-separated>; <counter text>\`.`,
    check: async (a) => { const [titles = "", counter = ""] = a.split(";"); return { ok: /alpha/i.test(titles) && /gamma/i.test(titles) && !/beta/i.test(titles) && /2 items? left/i.test(counter + a), truth: "alpha, gamma; 2 items left" }; } },
];
