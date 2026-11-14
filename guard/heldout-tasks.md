# Held-out everyday tasks h5-h10

## Ordering (honest record)

These six specs were written as the **very first action** of the skill-rewrite session
(2026-11-08), before reading bench/src/tasks.ts, any transcript, runs.jsonl, browse's
instructions or agent-browser's current texts. So they are not shaped by the failure
modes seen in transcripts nor by the wording of the new instructions. The one check made
afterwards was a site/answer overlap check against tasks.ts (result recorded at the bottom);
the specs themselves were not edited after that.

They are the final judge of whether the instruction change generalizes. Do not tune
instructions against them; run them only after the texts are frozen.

## Conventions

- Real public sites, no login, no API keys.
- Each task gives: prompt shown to the agent, pattern, and a checker. Checkers run on the
  agent's final answer text (case-insensitive) unless they say "live ground truth", in which
  case the checker fetches the source page itself (plain HTTP GET, no browser) at check time
  so that content drift does not produce false failures.
- Answer format requested from the agent: a single final line `ANSWER: ...`.

---

## h5 — multi-page reading (docs)

- Pattern: navigate an index, open a linked page, read a specific section.
- Prompt: "On docs.python.org, open the 'What's New' document for Python 3.12. Find the
  section about the per-interpreter GIL and report the PEP number it refers to, and the PEP
  number of the section about the new type-parameter syntax for generic classes and functions.
  Reply with `ANSWER: <gil-pep>, <type-param-pep>`."
- Checker: answer line contains `684` and `695`, in that order.

## h6 — form fill and submit

- Pattern: text inputs, radio, checkboxes, textarea, submit, read result page.
- Prompt: "Go to https://httpbin.org/forms/post. Fill the pizza order form: customer name
  'Ada Lovelace', telephone '555-0100', email 'ada@example.com', size Medium, toppings Bacon
  and Onion, delivery instructions 'ring twice'. Submit it. The result page echoes the
  submitted form as JSON. Reply with `ANSWER: <size value>; <toppings values comma-separated>; <custname value>`."
- Checker: answer line contains `medium`, `bacon`, `onion`, `Ada Lovelace`; does not contain
  `cheese` or `mushroom`.

## h7 — search + compare

- Pattern: use a site's search box twice (or search once and open two results), compare a field.
- Prompt: "Using the search on openlibrary.org, find the works 'Dune' and 'Dune Messiah' by
  Frank Herbert. Report the first publish year of each and which came first.
  Reply with `ANSWER: Dune=<year>; Dune Messiah=<year>; first=<title>`."
- Checker: contains `1965` associated with Dune, `1969` associated with Dune Messiah, and
  `first=Dune` (not `first=Dune Messiah`). Regex: `Dune=1965.*Messiah=1969.*first=Dune\b(?! Messiah)`.

## h8 — pagination

- Pattern: follow "next" links across pages and aggregate.
- Prompt: "On https://quotes.toscrape.com, starting from the home page, follow the Next
  button. On page 3, report the author of the first quote and the total number of quotes on
  page 3. Then report how many of the quotes on pages 1-3 combined are by Albert Einstein.
  Reply with `ANSWER: <author>; <count on page 3>; <einstein count>`."
- Checker: live ground truth. Fetch `https://quotes.toscrape.com/page/1/`..`/page/3/`, parse
  `.quote .author`, compute the three values, compare (author exact string match ignoring
  case; counts exact).

## h9 — conditional action on dynamic page

- Pattern: inspect state, branch, wait for async result.
- Prompt: "Open https://the-internet.herokuapp.com/dynamic_controls. If the checkbox in the
  first section is present, remove it with the button and wait until it is gone; if it is not
  present, add it back. Then enable the text input in the second section, wait until it is
  enabled, type 'done' into it. Report both status messages that appeared and the input's
  final value. Reply with `ANSWER: <message1> | <message2> | <value>`."
- Checker: contains `It's gone!` (the checkbox starts present on a fresh load), `It's enabled!`
  and `done`.

## h10 — toggle / settings state

- Pattern: create items, toggle state, switch a filter, read a counter.
- Prompt: "Open the TodoMVC React example at https://todomvc.com/examples/react/dist/. Add
  three todos: 'alpha', 'beta', 'gamma'. Mark 'beta' as completed. Switch the filter to
  'Active'. Report the visible todo titles and the 'items left' counter text.
  Reply with `ANSWER: <titles comma-separated>; <counter text>`."
- Checker: contains `alpha` and `gamma`, does not list `beta` among the titles, and contains
  `2 items left`.

---

## Overlap check against bench/src/tasks.ts (done after writing the specs above)

Result, recorded after reading tasks.ts (the specs above are left exactly as first written):

- **h6 collides with e3**: same site and same form (httpbin pizza order), only the field
  values differ. e3 is in the tuning set, so h6 is NOT held out. Treat h6 as invalid and run
  **h6b** instead (written after the collision was found; by then the current agent-browser stub
  and run.ts had been read, but no transcript or runs.jsonl).
- h8 uses quotes.toscrape.com; tasks.ts uses books.toscrape.com (sibling sandbox, different
  site and markup). Kept, but note the shared "toscrape" family.
- h5 (docs.python.org), h7 (openlibrary.org), h9 (the-internet.herokuapp.com), h10
  (todomvc.com): no overlap with any domain, form or answer in tasks.ts.
- Existing tasks.ts already has a "heldout" suite h1-h4; these are numbered h5-h10 to avoid
  clashing ids.

### h6b — form fill and submit (replacement for h6)

- Pattern: several text inputs, textarea, submit, read the echoed output on the same page.
- Prompt: "Open https://demoqa.com/text-box. Fill Full Name 'Grace Hopper', Email
  'grace@example.org', Current Address '1 Navy Way', Permanent Address '2 Harbor Rd', and
  submit. The page then shows the submitted values below the form. Report the Name and Email
  lines exactly as shown. Reply with `ANSWER: <name line> | <email line>`."
- Checker: contains `Grace Hopper` and `grace@example.org`.
- Note: written after finding the h6/e3 collision; a first replacement draft used a demo
  login page and was discarded because the set must not involve logins.
