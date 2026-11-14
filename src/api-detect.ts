// Semantic detector: did the agent go to a site's API through the browser instead of its pages? Works on what BOTH tools expose in the same way:
// the URLs the browser really navigated to (src/nav-recorder.ts) and the code the agent sent (Bash command or MCP `code`, as transcript inputs).
// It is reported SEPARATELY from task-rule violations (row.violations / clean): it never changes success, only describes. Heuristic, URL-shape based.
export type ApiFinding = { kind: "navigated-api-url" | "script-api-call" | "script-fetch"; url: string };

const API_HOST = /^(?:api|apis|rest|graphql|gateway|data-api)[.-]/i;
const API_PATH = /\/(?:api|_api|rest|graphql|wp-json|jsonapi|fdsnws|odata|rpc|ajax|_next\/data)(?:\/|$|\?)|\/v\d+(?:\.\d+)?\/|\.json(?:$|\?)|[?&](?:format|output|f)=(?:json|geojson|csv|xml)\b|\/(?:list|@v\/[^/]*\.info)$/i;
const API_HOSTS = /(?:^|\.)(?:firebaseio\.com|proxy\.golang\.org|registry\.npmjs\.org|static\.crates\.io|algolia\.net|algolianet\.com|raw\.githubusercontent\.com)$/i;
export function looksLikeApi(u: string): boolean {
  let url: URL; try { url = new URL(u, "https://placeholder.invalid"); } catch { return false; }
  if (url.hostname !== "placeholder.invalid" && (API_HOST.test(url.hostname) || API_HOSTS.test(url.hostname))) return true;
  return API_PATH.test(url.pathname + url.search);
}

/** `inputs`: concatenated tool-call inputs of the run; `navigated`: recorded top-level navigations (null = not recorded). */
export function apiAccess(inputs: string, navigated: string[] | null): ApiFinding[] {
  inputs = inputs.replace(/\\"/g, '"');   // MCP inputs are stored JSON-escaped: fetch(\"url\") must read as fetch("url")
  const out: ApiFinding[] = [];
  const seen = new Set<string>(); const add = (kind: ApiFinding["kind"], url: string) => { const k = kind + url; if (!seen.has(k) && out.length < 20) { seen.add(k); out.push({ kind, url: url.slice(0, 160) }); } };
  for (const u of navigated ?? []) if (looksLikeApi(u)) add("navigated-api-url", u);
  // calls made from inside a page script: fetch / XMLHttpRequest.open / axios / $.get(getJSON) with a literal URL
  for (const m of inputs.matchAll(/\bfetch\s*\(\s*(["'`])([^"'`\n]+)\1/g)) { if (looksLikeApi(m[2])) add("script-api-call", m[2]); else add("script-fetch", m[2]); }
  for (const m of inputs.matchAll(/\.open\s*\(\s*(["'`])[A-Z]+\1\s*,\s*(["'`])([^"'`\n]+)\2/g)) { if (looksLikeApi(m[3])) add("script-api-call", m[3]); else add("script-fetch", m[3]); }
  for (const m of inputs.matchAll(/\b(?:axios(?:\.\w+)?|\$\.(?:get|getJSON|ajax|post))\s*\(\s*(["'`])([^"'`\n]+)\1/g)) { if (looksLikeApi(m[2])) add("script-api-call", m[2]); else add("script-fetch", m[2]); }
  // fetch() whose URL is not a literal (built in code): described, not judged
  if (/\bfetch\s*\(\s*[^"'`\s)]/.test(inputs)) add("script-fetch", "(non-literal URL)");
  return out;
}
