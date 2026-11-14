// Local fixture site for the controlled suite. Served from outside the agent's cwd; the agent only sees URLs.
// Truth values are exported so checkers can compute expectations without the agent seeing them.
const rnd = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const words = "lorem ipsum dolor amet consectetur adipiscing elit sed eiusmod tempor incididunt labore magna aliqua enim minim veniam quis nostrud exercitation ullamco laboris nisi aliquip commodo consequat duis aute irure reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat proident sunt culpa officia deserunt mollit anim laborum".split(" ");
const para = (r: () => number, n: number) => Array.from({ length: n }, () => words[Math.floor(r() * words.length)]).join(" ") + ".";

export function layout(title: string, body: string, opts: { sidebar?: string; script?: string; base?: string } = {}) {
  const r = rnd(title.length * 7919);
  const nav = ["Home", "Products", "Solutions", "Pricing", "Docs", "Blog", "Community", "Careers", "Press", "Support", "Status", "Contact"]
    .map((n) => `<li><a href="/misc/${n.toLowerCase()}">${n}</a></li>`).join("");
  const foot = Array.from({ length: 36 }, (_, i) => `<li><a href="/misc/footer-${i}">${para(r, 2).replace(".", "")}</a></li>`).join("");
  const ads = [1, 2].map((i) => `<aside class="ad" aria-label="Sponsored"><b>Sponsored</b><p>${para(r, 14)}</p><a href="/misc/ad-${i}">Learn more</a> <button onclick="this.parentNode.remove()">Dismiss</button></aside>`).join("");
  const trending = Array.from({ length: 14 }, (_, i) => `<li><a href="/misc/trend-${i}">${para(r, 5)}</a></li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width"></head><body>
<div id="cookie" role="dialog" aria-label="Cookie notice" style="background:#eee;padding:6px">We use cookies to improve your experience. <button onclick="document.getElementById('cookie').remove()">Accept all</button> <a href="/misc/cookies">Preferences</a></div>
<header><a href="/" class="logo">Acme Platform</a><nav aria-label="Main"><ul>${nav}</ul></nav><form action="/misc/search"><input type="search" name="q" placeholder="Site search" aria-label="Site search"><button>Go</button></form></header>
${ads}
<div style="display:flex"><main>${body}</main><div class="side">${opts.sidebar ?? ""}<section><h3>Trending now</h3><ul>${trending}</ul></section></div></div>
<footer><h4>Company</h4><ul>${foot}</ul><p>&copy; 2026 Acme Platform Inc. All rights reserved.</p></footer>
${opts.script ? `<script>${opts.script}</script>` : ""}</body></html>`;
}

// ---------- 1 form ----------
export const FORM_CODE = "SU-PT-PRO-N-4821";
const formPage = () => layout("Create your account", `<h1>Create your account</h1>
<form id="f" novalidate><div id="errs" role="alert"></div>
<label>Full name <input name="name" id="name"></label><br>
<label>Email <input name="email" id="email" type="email"></label><br>
<label>Password <input name="pw" id="pw" type="password"></label><br>
<label>Country <select name="country" id="country"><option value="">Select...</option>${["Spain", "Portugal", "France", "Germany", "Italy", "Ireland", "Poland", "Sweden", "Norway", "Finland", "Greece", "Austria"].map((c) => `<option>${c}</option>`).join("")}</select></label><br>
<fieldset><legend>Plan</legend>${["Free", "Pro", "Team", "Enterprise"].map((p) => `<label><input type="radio" name="plan" value="${p}"> ${p}</label>`).join(" ")}</fieldset>
<label><input type="checkbox" name="news" id="news"> Subscribe to the newsletter</label><br>
<label><input type="checkbox" name="terms" id="terms"> I accept the terms of service</label><br>
<button type="submit">Create account</button></form><div id="done" hidden></div>`, { script: `
let attempts=0;document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();attempts++;const v=id=>document.getElementById(id);const errs=[];
if(!v('name').value.trim())errs.push('Name is required');if(!/@/.test(v('email').value))errs.push('Enter a valid email');
if(!(v('pw').value.length>=10&&/\\d/.test(v('pw').value)&&/[A-Z]/.test(v('pw').value)))errs.push('Password must be at least 10 characters and include a digit and an uppercase letter');
if(!v('country').value)errs.push('Choose a country');if(!document.querySelector('input[name=plan]:checked'))errs.push('Choose a plan');if(!v('terms').checked)errs.push('You must accept the terms');
if(attempts===1&&!errs.length){errs.push('Please review your details and submit again to confirm');}
v('errs').innerHTML=errs.map(x=>'<p style="color:#b00">'+x+'</p>').join('');if(errs.length)return;
const plan=document.querySelector('input[name=plan]:checked').value;const code='SU-'+({Portugal:'PT'}[v('country').value]||'XX')+'-'+plan.toUpperCase()+'-'+(v('news').checked?'N':'X')+'-4821';
v('f').hidden=true;v('done').hidden=false;v('done').innerHTML='<h2>Welcome aboard</h2><p>Your confirmation code is <strong>'+code+'</strong></p>';});` });

// ---------- 2 catalog ----------
const BRANDS = ["Lumio", "Brightly", "Nordlys", "Halo", "Glimmer"];
export const products = (() => {
  const r = rnd(42), kinds = ["Desk lamp", "Floor lamp", "Table lamp", "Pendant light", "Wall sconce", "Night light", "Headphones", "Speaker", "Kettle", "Mug"];
  return Array.from({ length: 80 }, (_, i) => ({ id: i + 1, name: `${BRANDS[Math.floor(r() * 5)]} ${kinds[Math.floor(r() * kinds.length)]} ${100 + i}`, brand: "", price: Math.round((9 + r() * 190) * 100) / 100, stock: r() > 0.35, rating: Math.round((3 + r() * 2) * 10) / 10 }))
    .map((p) => ({ ...p, brand: p.name.split(" ")[0] }));
})();
export const CATALOG_TRUTH = (() => {
  const m = products.filter((p) => /lamp/i.test(p.name) && p.brand === "Lumio" && p.stock).sort((a, b) => a.price - b.price)[0];
  return m ? m.price.toFixed(2) : "";
})();
const catalogPage = () => layout("Shop lighting & home", `<h1>Shop</h1>
<div class="filters"><input id="q" type="search" placeholder="Search products" aria-label="Search products"><button id="sb">Search</button>
<label>Brand <select id="brand"><option value="">All brands</option>${BRANDS.map((b) => `<option>${b}</option>`).join("")}</select></label>
<label><input type="checkbox" id="stock"> In stock only</label>
<label>Sort by <select id="sort"><option value="rel">Relevance</option><option value="pa">Price: low to high</option><option value="pd">Price: high to low</option><option value="rt">Rating</option></select></label></div>
<p id="count"></p><ul id="list"></ul><section id="cart"><h2>Cart</h2><ul id="cartlist"><li>Your cart is empty</li></ul><p>Total: <span id="total">$0.00</span></p></section>`, { script: `
const P=${JSON.stringify(products)};const cart=[];const $=id=>document.getElementById(id);
function render(){let l=P.filter(p=>p.name.toLowerCase().includes($('q').value.toLowerCase().trim()));if($('brand').value)l=l.filter(p=>p.brand===$('brand').value);if($('stock').checked)l=l.filter(p=>p.stock);
const s=$('sort').value;if(s==='pa')l.sort((a,b)=>a.price-b.price);if(s==='pd')l.sort((a,b)=>b.price-a.price);if(s==='rt')l.sort((a,b)=>b.rating-a.rating);
$('count').textContent=l.length+' results';$('list').innerHTML=l.map(p=>'<li><a href="/misc/product-'+p.id+'">'+p.name+'</a> - $'+p.price.toFixed(2)+' - rated '+p.rating+' - '+(p.stock?'In stock':'Out of stock')+' <button data-id="'+p.id+'" '+(p.stock?'':'disabled')+'>Add to cart</button></li>').join('');}
['sb','brand','stock','sort'].forEach(i=>$(i).addEventListener(i==='sb'?'click':'change',render));$('q').addEventListener('keydown',e=>{if(e.key==='Enter')render()});
$('list').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;const p=P.find(x=>x.id==b.dataset.id);cart.push(p);$('cartlist').innerHTML=cart.map(x=>'<li>'+x.name+' - $'+x.price.toFixed(2)+'</li>').join('');$('total').textContent='$'+cart.reduce((a,x)=>a+x.price,0).toFixed(2);});render();` });

// ---------- 3 docs ----------
export const DOCS_TRUTH = "172800";
const docsTree: Record<string, { title: string; body: string; children?: string[] }> = {
  "": { title: "Zephyr Documentation", body: "Welcome. Pick a guide: <a href='/docs/guides'>Guides</a>, <a href='/docs/reference'>Reference</a>, <a href='/docs/changelog'>Changelog</a>.", children: ["guides", "reference", "changelog"] },
  guides: { title: "Guides", body: "<ul><li><a href='/docs/guides/quickstart'>Quickstart</a></li><li><a href='/docs/guides/configuration'>Configuration</a></li><li><a href='/docs/guides/deploy'>Deploying</a></li></ul>" },
  "guides/quickstart": { title: "Quickstart", body: "Install and run. Default port is 8080. Default cache.ttl is 3600." },
  "guides/deploy": { title: "Deploying", body: "Deploy with <code>zephyr deploy</code>. Timeout default: 300 seconds." },
  "guides/configuration": { title: "Configuration", body: "<ul><li><a href='/docs/guides/configuration/network'>Network</a></li><li><a href='/docs/guides/configuration/caching'>Caching</a></li><li><a href='/docs/guides/configuration/logging'>Logging</a></li></ul>" },
  "guides/configuration/network": { title: "Network", body: "<table><tr><td>net.timeout</td><td>30</td></tr><tr><td>net.retries</td><td>3</td></tr></table>" },
  "guides/configuration/logging": { title: "Logging", body: "<table><tr><td>log.level</td><td>info</td></tr></table>" },
  "guides/configuration/caching": { title: "Caching", body: "<table><tr><th>Key</th><th>Default</th></tr><tr><td>cache.enabled</td><td>true</td></tr><tr><td>cache.ttl</td><td>3600</td></tr><tr><td>cache.maxEntries</td><td>10000</td></tr><tr><td>cache.staleIfError</td><td>86400</td></tr><tr><td>cache.staleWhileRevalidate</td><td>172800</td></tr><tr><td>cache.compress</td><td>false</td></tr></table>" },
  reference: { title: "Reference", body: "<a href='/docs/reference/cli'>CLI</a> <a href='/docs/reference/api'>API</a>" },
  "reference/cli": { title: "CLI", body: "Commands: init, dev, deploy. Default cache.staleWhileRevalidate in dev is 0." },
  "reference/api": { title: "API", body: "REST endpoints. Default page size 50." },
  changelog: { title: "Changelog", body: "v3: changed cache.staleWhileRevalidate default from 86400 to a higher value." },
};
function docsPage(path: string) {
  const n = docsTree[path]; if (!n) return null; const r = rnd(path.length + 5);
  const side = `<nav aria-label="Docs"><h3>Docs</h3><ul>${Object.keys(docsTree).filter((k) => k && !k.includes("/")).map((k) => `<li><a href="/docs/${k}">${docsTree[k].title}</a></li>`).join("")}${Array.from({ length: 10 }, (_, i) => `<li><a href="/misc/doc-${i}">${para(r, 3)}</a></li>`).join("")}</ul></nav>`;
  return layout(n.title + " | Zephyr", `<h1>${n.title}</h1><p>${n.body}</p><p>${para(r, 60)}</p><p>${para(r, 60)}</p>`, { sidebar: side });
}

// ---------- 4 table ----------
const regions = ["EMEA", "APAC", "AMER", "LATAM"], depts = ["Sales", "Ops", "Support", "Eng"];
export const rows = (() => { const r = rnd(7); return Array.from({ length: 75 }, (_, i) => ({ id: 1000 + i, name: `Emp ${String.fromCharCode(65 + (i % 26))}${i}`, region: regions[Math.floor(r() * 4)], dept: depts[Math.floor(r() * 4)], revenue: Math.floor(r() * 90000) + 1000 })); })();
export const TABLE_TRUTH = String(rows.filter((x) => x.region === "EMEA").reduce((a, x) => a + x.revenue, 0));
const tablePage = (pg: number) => layout(`Revenue report - page ${pg}`, `<h1>Revenue report</h1><p>Page ${pg} of 3</p><table border=1><thead><tr><th>ID</th><th>Name</th><th>Region</th><th>Department</th><th>Revenue (USD)</th></tr></thead><tbody>${rows.slice((pg - 1) * 25, pg * 25).map((x) => `<tr><td>${x.id}</td><td>${x.name}</td><td>${x.region}</td><td>${x.dept}</td><td>${x.revenue}</td></tr>`).join("")}</tbody></table>
<p>${pg > 1 ? `<a href="/table?page=${pg - 1}">Previous</a> ` : ""}${[1, 2, 3].map((i) => `<a href="/table?page=${i}">${i}</a>`).join(" ")} ${pg < 3 ? `<a href="/table?page=${pg + 1}">Next</a>` : ""}</p>`);

// ---------- 5 login ----------
export const LOGIN_TRUTH = "ACC-90417-QZ";
const loginPage = () => layout("Sign in", `<h1>Sign in</h1><form id="lf"><div id="err" role="alert"></div><label>Email <input id="em" name="email"></label><br><label>Password <input id="pw" type="password" name="password"></label><br><button>Sign in</button></form>`, { script: `
document.getElementById('lf').addEventListener('submit',e=>{e.preventDefault();if(document.getElementById('em').value==='demo@acme.test'&&document.getElementById('pw').value==='Tr0ub4dor&3'){document.cookie='sess=ok; path=/';location.href='/app';}else document.getElementById('err').textContent='Invalid credentials';});` });
const appPage = () => layout("Dashboard", `<h1>Dashboard</h1><p>Welcome back, Demo.</p><ul><li><a href="/app/settings">Settings</a></li><li><a href="/app/billing">Billing</a></li><li><a href="/app/team">Team</a></li></ul>`);
const settingsPage = () => layout("Settings", `<h1>Settings</h1><section><h2>Profile</h2><p>Name: Demo User</p></section><section><h2>Account</h2><p>Account ID: <span id="acc">Loading...</span></p></section>`, { script: `setTimeout(()=>{document.getElementById('acc').textContent='${LOGIN_TRUTH}'},1500);` });

// ---------- 6 longpage ----------
export const LONG_TRUTH = "$4.2M";
const longPage = () => { const r = rnd(99); const secs = Array.from({ length: 70 }, (_, i) => `<section id="s${i}"><h2>${i + 1}. ${para(r, 4).replace(".", "")}</h2><p>${para(r, 120)}</p><p>${para(r, 100)} Budget note ${i}: forecast $${(r() * 9).toFixed(1)}M.</p></section>`).join("");
  return layout("Project Helios: Full Report", `<h1>Project Helios: Full Report</h1>${secs}<h2>Appendices</h2><details><summary>Appendix A: Glossary</summary><p>${para(r, 80)}</p></details><details><summary>Appendix B: Timeline</summary><p>${para(r, 80)} Original budget cap: $3.1M.</p></details><details><summary>Appendix C: Errata</summary><p>${para(r, 30)} Revised budget cap after the March review: ${LONG_TRUTH}.</p></details><details><summary>Appendix D: Contacts</summary><p>${para(r, 40)}</p></details>`); };

// ---------- 7 spa ----------
export const SPA_TRUTH = "$118,400";
const spaPage = () => layout("Portfolio", `<div id="app"></div>`, { script: `
const projects=[{n:'Atlas',b:'$52,000',o:'Mia',s:'Active'},{n:'Orion',b:'${SPA_TRUTH}',o:'Raj',s:'Active'},{n:'Vega',b:'$77,250',o:'Lena',s:'Paused'},{n:'Lyra',b:'$9,900',o:'Tom',s:'Done'}];
const app=document.getElementById('app');
function nav(p){history.pushState({},'',p);route();}
document.addEventListener('click',e=>{const a=e.target.closest('a[data-spa]');if(a){e.preventDefault();nav(a.getAttribute('href'));}});
window.addEventListener('popstate',route);
function modal(p){const m=document.createElement('div');m.setAttribute('role','dialog');m.setAttribute('aria-label',p.n+' details');m.style.cssText='position:fixed;top:10%;left:20%;width:60%;background:#fff;border:2px solid #000;padding:12px;z-index:9';
m.innerHTML='<h2>'+p.n+'</h2><div role="tablist"><button role="tab" data-t="ov" aria-selected="true">Overview</button><button role="tab" data-t="bd" aria-selected="false">Budget</button><button role="tab" data-t="hs" aria-selected="false">History</button></div><div id="tp">Owner: '+p.o+'. Status: '+p.s+'.</div><button data-close>Close</button>';
m.addEventListener('click',e=>{if(e.target.dataset.close!==undefined)m.remove();const t=e.target.dataset.t;if(t){m.querySelectorAll('[role=tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t));m.querySelector('#tp').textContent=t==='ov'?'Owner: '+p.o+'. Status: '+p.s+'.':t==='bd'?'Approved budget: '+p.b+'. Spent to date: $12,300.':'No history yet.';}});document.body.appendChild(m);}
function route(){const p=location.pathname;let h='<h1>Portfolio Manager</h1><nav><a data-spa href="/spa">Overview</a> | <a data-spa href="/spa/projects">Projects</a> | <a data-spa href="/spa/team">Team</a></nav>';
if(p==='/spa/projects')h+='<h2>Projects</h2><table border=1>'+projects.map((x,i)=>'<tr><td>'+x.n+'</td><td>'+x.s+'</td><td><button data-i="'+i+'">View details</button></td></tr>').join('')+'</table>';
else if(p==='/spa/team')h+='<h2>Team</h2><p>Mia, Raj, Lena, Tom</p>';else h+='<h2>Overview</h2><p>4 projects, 2 active. Total budget varies by project; open Projects for details.</p>';
app.innerHTML=h;app.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>modal(projects[b.dataset.i]));}
route();` });


// ---------- h3 booking (date/time form; held-out) ----------
export const BOOKING_TRUTH = "BK-20261224-0815-3-B";
const bookingPage = () => layout("Book a room", `<h1>Book a room</h1><form id="bf" novalidate><div id="errs" role="alert"></div>
<label>Check-in date <input type="date" id="date" name="date"></label><br>
<label>Arrival time <input type="time" id="time" name="time"></label><br>
<label>Guests <select id="guests" name="guests">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label><br>
<label><input type="checkbox" id="bfast" name="breakfast"> Breakfast included</label><br>
<label>Notes <textarea id="notes" name="notes"></textarea></label><br><button type="submit">Reserve</button></form><div id="ok" hidden></div>`, { script: `
document.getElementById('bf').addEventListener('submit',e=>{e.preventDefault();const v=id=>document.getElementById(id);const errs=[];
if(!v('date').value)errs.push('Choose a check-in date');if(!v('time').value)errs.push('Choose an arrival time');
if(v('time').value&&(v('time').value<'06:00'||v('time').value>'23:00'))errs.push('Arrival must be between 06:00 and 23:00');
v('errs').innerHTML=errs.map(x=>'<p style="color:#b00">'+x+'</p>').join('');if(errs.length)return;
const ref='BK-'+v('date').value.replace(/-/g,'')+'-'+v('time').value.replace(':','')+'-'+v('guests').value+'-'+(v('bfast').checked?'B':'N');
v('bf').hidden=true;v('ok').hidden=false;v('ok').innerHTML='<h2>Reservation confirmed</h2><p>Booking reference: <strong>'+ref+'</strong></p>';});` });

export function handle(req: Request): Response {
  const u = new URL(req.url), p = u.pathname.replace(/\/+$/, "");
  const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (p === "/form") return html(formPage());
  if (p === "/booking") return html(bookingPage());
  if (p === "/catalog") return html(catalogPage());
  if (p === "/table") return html(tablePage(Math.min(3, Math.max(1, Number(u.searchParams.get("page")) || 1))));
  if (p === "/login") return html(loginPage());
  if (p === "/app") return html(appPage());
  if (p === "/app/settings") return html(settingsPage());
  if (p.startsWith("/app/")) return html(appPage());
  if (p === "/longpage") return html(longPage());
  if (p === "/spa" || p.startsWith("/spa/")) return html(spaPage());
  if (p === "/docs" || p.startsWith("/docs/")) { const d = docsPage(p.replace(/^\/docs\/?/, "")); if (d) return html(d); }
  if (p === "" ) return html(layout("Acme index", "<h1>Fixtures</h1>"));
  return html(layout("Page", `<h1>${p}</h1><p>Placeholder page.</p>`));
}

if (import.meta.main) {
  const port = Number(process.env.FIXTURE_PORT ?? 4173);
  Bun.serve({ port, hostname: "127.0.0.1", fetch: handle });
  console.log(`fixtures on http://127.0.0.1:${port}`);
}
