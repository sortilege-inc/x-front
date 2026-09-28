# X-FRONT × sortilege-vtt-marvelmultiverse — plan and decision log

A **Marvel Multiverse** campaign (2025): six young mutants and X-FRONT, the direct-action group Toya
Terrence and Tabitha Fanning formed after a pride march in Tallahassee went south. Built as an
**instance** of `sortilege-vtt-marvelmultiverse` (`~/Sortilege/VTT/INSTANCES.md`, PLAYBOOK §4/§4b).

**This repo depends on `sortilege-vtt-marvelmultiverse` only.** Every script under `campaign/` is its own.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and proven.

- **here** — `sortilege-inc/x-front` (**PUBLIC; LIVE since 2026-09-28** — M5): https://sortilege-inc.github.io/x-front/, Worker https://x-front.sortilege.workers.dev.
- **upstream** — `sortilege-inc/sortilege-vtt-marvelmultiverse` (private), remote `upstream`, at `d97b9f1`.

## What is on disk (read 2026-09-28)

- **`~/Downloads/2025 X-FRONT/`** — the owner's six **short-form Marvel Multiverse sheets** (Inkscape,
  created 2023-08-15, modified 2025-06-06): Flare (2 pages), Half-Life, Regret, Stasis, Taboo, Tank (2 pages),
  each with a text layer; and a 1024 px portrait of each (`.png` and `.webp`). **The record** (X4).
  Copied byte for byte into `campaign/source/sheets/` (PDFs) and `campaign/assets/portraits/` (the `.webp`s).
- **`~/Downloads/2024 X-FRONT/`** — five of the same heroes (no Flare) on the official Marvel sheet
  (Illustrator template "MARRPGP_Character Sheet ver8"): the same numbers (Regret: rank 2, identical
  abilities), names and powers only, no rules text or biography. **Superseded** (X4); nothing from it is
  in the repo.
- No session recordings, notes, Notion or Foundry (X1).

## Decisions

**X1 — (owner, 2026-09-28) the sheets only; build now.** No other source exists yet. The build is the six
heroes as real VTT sheets and public hero pages, a home page from their biographies, the Narrator's table
seeded with the party and an overview. Sessions come later as new chronicle pages and seed ids.

**X2 — (owner, 2026-09-28) public, like the other instances.** Pushing publishes upstream's `data/` (the
Core Rulebook and the X-Men Expansion, verbatim; upstream itself is private, its D3) and
`campaign/pack/seed.json`. The books' tabs stay off the public site by default (§4b.4).

**X3 — (owner, 2026-09-28) the portraits, as `.webp`.** Upstream's D4 ("no art for now") was about the
books' own portraits; these are the campaign's. The `.png` duplicates are not copied.

**X4 — (owner, 2026-09-28) the 2025 sheets are the record;** the 2024 set is superseded.

## Milestones

| # | What | Proof |
|---|---|---|
| **M1** | The fork — `main` = upstream `main` (`d97b9f1`) + the instance commit; `engine/config.js` (title, storage prefix `x-front-vtt`, the seed, `hidePanes: ['adventure']`, the instance stages), `.gitattributes`, `.gitignore`, `.nojekyll`, `.claude/launch.json`, `worker/wrangler.jsonc` (`x-front`), README | landed 2026-09-28 (`36091cb`). **Boundary proven by making it fail** in a throwaway clone: a fake upstream commit to `engine/config.js` and `index.html` merged without the driver → `CONFLICT (content): Merge conflict in engine/config.js`; with `merge.ours.driver true` → merged clean, the title stayed *X-FRONT*, `index.html` took upstream's line. `bash campaign/build/build.sh` twice → no diff |
| **M2** | The heroes — `campaign/source/extract_sheets.py` (PDF → `sheets.json`) · `check_sheets.py` · `convert_heroes.py` (→ `campaign/dsl/`) · `build/build_layer.sh` (→ `campaign/data/`) · `check_heroes.py` | landed 2026-09-28. **check_sheets: OK** — 6 sheets, 99 entries (book 70, abridged 9, excerpt 5, punct 1, own 13, free 1): each `.txt` is the PDF's text layer byte for byte, and the words of each sheet equal the template's labels plus the record's values, both ways; **proven by planted faults** (Stasis's *Paralyzed* → *stunned*, Tank's Focus 150 → 151: both reported, exit 1). **build_layer: OK** — 306 strings (1,465 occurrences) 0 uncovered · 0 short · 0 unsourced; 19 ids, none the corpus's; every reference resolves. **check_heroes: OK** — 464 checks over 6 heroes, 0 differ; **proven by planted faults** in the generated DSL (Tank's Focus 15, *Fearles*, both Stasis Effects to *stunned*: 4 reported, exit 1 — the misspelt name passes `build_layer`, which does not check a profile row's Name; `check_heroes` does) |
| **M3** | The public pages — `campaign/docs/home.md` → `campaign/build/build_docs.py` → `campaign/data/docs.js`; `campaign/site/site.js` (tabs *X-FRONT* and *The heroes*, drawn from the layer's profiles + portraits), `campaign.css` | landed 2026-09-28. **build_docs: OK** (names gate: every capitalised word on a hero's sheet; **proven** by *Talahassee* → reported, exit 1). Browser on 8757: tabs *X-FRONT · The heroes* ahead of the VTT's (books off), robots meta, six cards with portraits; Stasis's page — facts, History, Personality, *Elemental Control: Velocity*, the sheet with 16 linked entries; *Elemental Burst* opens `#book/campaign/…` *Elemental Burst (Stasis)* ("…is Paralyzed for one round."), *Situation Awareness* opens the core's *Situational Awareness*, both with the books closed; 375 px: scrollWidth 375 on the home and a hero page; 0 console errors |
| **M4** | The Narrator's seed — `campaign/source/gm.md` + the layer → `campaign/build/build_seed.py` → `campaign/pack/seed.json` | landed 2026-09-28. **build_seed: OK** — overview 2 cards, party 6 (Health/Focus/Karma: Flare 120/60/4, Half-Life 60/30/2, Regret 30/90/2, Stasis 10/115/2, Taboo 60/60/2, Tank 60/150/3); ids unique; gm.md's words = the pack's. Browser, fresh storage, through the gate's *Enter*: campaign *X-FRONT*, 6 heroes on their layer profiles, 14 ids seeded, no Adventure pane; Tank in the Inspector: trackers 60/150/3, damage *dMarvel × 3 + 4* (Agility), traits/tags/power groups as printed; the Health *−* button → 59 on the sheet and in the store, log "Tank: Health 60 → 59"; 0 console errors |
| **M5** | Deploy — push, Pages from `main`, the Worker `x-front` | **owner, 2026-09-28: "push and deploy"**. Worker `x-front` (version 5c0a5cdf) → https://x-front.sortilege.workers.dev, `ALLOWED_ORIGIN` the github.io origin: `GET /session/ABCD` from it → 200 `{"exists":false}`, from a foreign origin → 403 `origin not allowed`; `engine/config.js` names it. `main` pushed; Pages from `main` (`.nojekyll`) → https://sortilege-inc.github.io/x-front/. Redeploy the Worker (`cd worker && npx wrangler deploy`) after any upstream change to `engine/ops.js` or the system's `ops.js` |

`bash campaign/build/build.sh` runs M2–M4's steps and gates in order.

## Decision log

| When | Kind | Decision | Why |
|---|---|---|---|
| 2026-09-28 | autonomous, method | **`main` is upstream's `main` plus the instance commit**, not a move-and-merge | The repo was empty: nothing to move (Naadag's precedent) |
| 2026-09-28 | autonomous, method | **The sheets are read, never retyped**: `pdftotext -raw` (each text box whole, in drawing order) for the head and the entries, `-layout` over page 1's biography column for the fields and paragraph breaks; the template's label run is removed only after it is checked word for word against the template's list | Deterministic-first; every value provable against the PDF |
| 2026-09-28 | autonomous, method | **An entry is split where a line begins with a name the corpus prints** (trait, tag, power, a numbered power's stem such as *Flight*, case-blind for *Rally On Me*), where a line opens a `Name [text]` entry, or after a heading's `===` rule; a heading is a line beginning with a power set's name, *Traits (,) continued* or *Weapons* | The sheets are free-form text boxes; the corpus is the dictionary |
| 2026-09-28 | autonomous, fidelity | **A hero is a profile on the corpus's `ACTOR "Character"`** — the same type as the book's 129 core profiles — so the VTT's own sheet, Heroes pane and Cast read it unchanged | No upstream edit; one sheet |
| 2026-09-28 | autonomous, fidelity | **An entry whose words are the book's links to the book's entry** (book 70, abridged 9 — the sheet stops before a later paragraph —, excerpt 5 — *Connections*' middle paragraph ×4, *Combat Trickery* without its Trigger —, punct 1 — *Keep Moving*'s `stunned]` for `stunned.]`). **An entry whose words differ is kept word for word as the hero's own power** in `campaign/dsl/x-front.ttrpg`, "*Power* (*Hero*)", on the corpus's `Power` type — 13, every one an Elemental Control power with the element's special effect written into the Fantastic success (Flare *stunned*, Half-Life *Blinded* / *trouble on all actions*, Stasis *Paralyzed*, Tank *trouble on all actions*), as the book's Elemental Control tells a player to | Verbatim rules text, and no duplicate of what the book already holds |
| 2026-09-28 | autonomous, fidelity | **Each entry's `Printed` is the sheet's heading, terms included** — "*Evil Eye (Standard, Concentration, Cost: 5 Focus per turn, Range: 10 spaces)*" — because the sheets work the book's variables out for the hero (Evil Eye's *5 spaces per rank* → 10 at rank 2; Ricochet's *10 spaces times the character's rank* → 40 at rank 4) | Nothing on the sheet left out |
| 2026-09-28 | autonomous, fidelity | **Sheet spellings kept, linked to the book's name**: *Situation Awareness* → *Situational Awareness* (the one alias, `resolve.py`), *Rally On Me* → *Rally on Me*, *Flight* → *Flight 1*, *Uncanny* → *Uncanny 1*, *Elemental Protection* → *Elemental Protection 1* (the text decides the rank) | The sheet is the record; the link must open the entry |
| 2026-09-28 | autonomous, fidelity | **Power groups**: the sheet's heading over them, a heading printed again (Regret's three *Telepathy*, Tank's two *Tactics*, Taboo's two *Luck*) or shortened on page 2 (Flare's *Elemental Control*) is one group; the powers the sheet lists before any heading are **Basic**, the book's own word in its profiles for powers of no set | The profile's shape; no word the book doesn't use |
| 2026-09-28 | autonomous, fidelity | **Stasis's *Elemental Control: Velocity* description** and each sheet's *Current Age* line go in the profile's `Biography Sections`; **Half-Life's knife** is a `Weapons` group row as printed (the Common Weapons table's row, not an entity); the note under it is the book's Weapons text word for word | Where the profile type keeps such things |
| 2026-09-28 | autonomous, fidelity | **Numbers as printed** — e.g. Stasis Health 10, Taboo Focus DR −1, Tank Health DR −1, initiative *+4E* — none recomputed | The sheet is the record |
| 2026-09-28 | autonomous, privacy/content | **Pronouns from the sheets**: Tank *they* (Gender: Non-binary; the sheet's own *they*); Taboo *she* (Gender: Female; her Goal's *herself*/*She's* — her History says *They briefly attended*, so this is **for the owner's check**); the others as their Gender lines | Never inferred from a name |
| 2026-09-28 | autonomous, content | **The Narrator's seed holds only what the sheets say**: an overview of X-FRONT and the heroes (every paragraph tagged with its sheet) and the party; **no threads** — the sheets' Goals and Barriers are already on each hero, and restating them would be commentary | GM notes hold content (gm-prep-notes) |
| 2026-09-28 | autonomous, tool | Identity Jordan Peacock <jordan@sortilege.online>; `merge.ours.driver true`; launch `x-front` 8757 / `x-front-worker` 8807 (both free: `ss -ltn` and every launch file); storage prefix and channel `x-front-vtt`; Worker `x-front` | Per-instance values |
| 2026-09-28 | autonomous, look | **Protest-poster tokens** over the VTT's comic page: signal orange (`--red`), night navy (`--blue`), hazard yellow (`--gold`), both schemes, `campaign/site/campaign.css` | An instance never edits upstream files |

## To add a session

New material for the Narrator goes in `campaign/source/gm.md` under new ids (the seed never overwrites what
the Narrator changed in the tabs); a revised sheet replaces its PDF in `campaign/source/sheets/`; then
`bash campaign/build/build.sh`.
