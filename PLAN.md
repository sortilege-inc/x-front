# sortilege-vtt-marvelmultiverse — plan and decision log

A virtual tabletop for the **Marvel Multiverse Role-Playing Game** (Marvel), built on the
Titterpig corpus `titterpig-dsl-marvelmultiverse/0.5`. Its shape follows `PLAYBOOK.md` (in
`~/Sortilege/VTT/`, beside the VTT repos) and the VtM5e and L5R5e builds the owner named as its
sources; they are read-only reference — nothing in them is modified here.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and
verified by the main session.

## Ground rules (inherited)

- The sibling repos are read-only reference. What is reused is the system-agnostic code only:
  `engine/*.js` (no game words), the generic DSL parser, the shape of the gate and of the
  build, the Worker. No other system's data, `system/` module, css, book map or namespace comes
  across. Every word of rules text this site shows is from `titterpig-dsl-marvelmultiverse/0.5`.
- `data/` is generated; regenerating is the only way to change it. Corpus gaps found while
  building are reported to `titterpig-dsl-marvelmultiverse/TODO.md`, never patched in the tool.
- Rules text is verbatim. The tool's own words are labels and connective prose only. A number
  the rules state only in prose is a named constant citing its sentence.
- The book calls the GM the **Narrator**; the tool's own labels use the book's word.

## What is on disk (read 2026-09-27)

| Input | State |
|---|---|
| `~/Sortilege/VTT/sortilege-vtt-marvelmultiverse` | cloned empty 2026-09-27; remote `sortilege-inc/sortilege-vtt-marvelmultiverse` (**PRIVATE**, `gh repo view`); identity Jordan Peacock <jordan@sortilege.online> set per repo |
| `~/Sortilege/Titterpig/DSL/titterpig-dsl-marvelmultiverse/0.5` | 240 files, 3.6 MB of DSL, clean at `35e0eeb`: 29 `.ttrpg` (core 14, X-Men 15), 211 `.actor` in `characters/` (core 129, X-Men 82); its `./gates.sh` passed at that commit (coverage 903/903 core, 539/539 X-Men) |
| The art | **none on disk** outside the PDFs (`~/Downloads/Marvel Multiverse RPG/`); see D4 |

**The parser** is L5R5e's, unchanged. It reads 240 of 240 files, and the shape gate below found
nothing it misplaces.

### The corpus, by what the tool needs

The BASE (`marvelmultiverse-0.5-core-base.ttrpg`) and the X-Men types file are well typed: 27
types instantiated, 1,978 entities, every one of them hashed (the build writes no ids of its own).

| Need | In the corpus | Shape |
|---|---|---|
| The rules | *How to Play*, *Core Mechanics*, *Combat*, *Narrator*; 25 `Table`s, 85 GUIDANCE entries | typed DEFs, nested as the book nests them |
| The dice | the d616 in *Core Mechanics*' prose — **no FACES or outcome ladder is declared** | read at M2 from the prose, each number a named constant citing its sentence |
| Character creation | *Creating a Character*: 6 `Ability`s (ENUM), 37 `Origin`s, 18 `Occupation`s, 63 `Trait`s, 56 `Tag`s, 364 `Power`s in 30 `Power Set`s, 29 `Power Tree`s, the `Character Sheet` / `Sample Character Sheet`, the `Advancement Chart` | typed |
| Characters | `ACTOR "Character"` (Rank, Karma, Health/Focus and their Damage Reduction, Initiative, Speeds, six `Ability Line`s, `Damage Line`s, Traits and Tags as `Profile Trait`s, Powers as `Power Group`s of `Power Entry`s, biography); `ACTOR "X-Men Expansion Character"` EXTENDS it (+ Notes, `Reliance Mark`s); 130 core + 82 X-Men profiles, 37 `Opponent`s | ACTOR instances |
| The setting | 52 `Location`s, 11 `Alternate Earth`s, 65 `Team Roster`s, 7 `Team Maneuver`s, 13 `Map`s, 14 `Adventure Hooks`, 3 `Vehicle`s, a `Timeline`; 148 `Glossary Entry`s | typed |
| An adventure | **none as an `.arc`** — the books print Adventure Hooks, not a run adventure | the Narrator's own scenes (M3) |

## Decisions

**D1 — no BASE change needed.** Unlike VtM5e and Coyote & Crow, the corpus already declares the
player character: `ACTOR "Character"` in the core BASE, which every profile EXTENDS, and
`ACTOR "X-Men Expansion Character"` EXTENDS it. The sheet (M4) derives from it.

**D2 — the books are the shelf; a book's chapters are its files** (autonomous, tool/method).
`build/build_data.py` maps each corpus file to its book by the file-name prefix
(`marvelmultiverse-0.5-<book>-…`, the name not the path — the profiles live in `characters/`).
Two books today, `core` (143 chapters, 3.0 MB) and `x-men` (97 chapters, 2.0 MB); an expansion
(Avengers, Spider-Verse, Cataclysm of Kang, Deadpool) is one line of `BOOKS` once converted.

**D3 — PROPOSED: private for now; deployment deferred** (as L5R5e's and Coyote & Crow's D3). The
GitHub repo is private. Nothing in the repo hard-codes an origin; the Worker admits localhost
and, until the owner decides, only `sortilege-inc.github.io`; `engine/config.js` has
`worker.deployed` empty.

**D4 — PROPOSED: the art.** No Marvel Multiverse art exists on disk outside the PDFs, and no owner
site to copy it from (L5R5e copied from Portents & Fortunes). Recommendation: none until the owner
names a source — the site works on text and CSS, and the d616 is drawn in CSS.

**D5 — PROPOSED: the §4c GM workbench.** PLAYBOOK §4c (sectioned nav, layout presets with
split regions, the draggable beat outline with Encounter beats, per-copy NPC tracking) lives in
Daggerheart's and Coyote & Crow's engine; VtM5e's engine, the one named for this VTT, predates it,
so M3 has VtM5e's shell (three slots, one flat nav). Recommendation: port it at M4 from Coyote &
Crow's engine (the same VtM5e base, so the diff is the workbench alone) — a Marvel fight of several
identical A.I.M. Agents needs per-copy Health. Trade-off: a third sibling as a source, against
building per-copy tracking a second way.

## Layout (the inherited three-layer shape; everything game-specific written here)

```
index.html                  the site
build/                      the generators and their gates
data/                       GENERATED — window.MARVELMULTIVERSE.books / .entities / .index / .records
engine/                     system-agnostic, copied whole from VtM5e (engine-level GM panes,
                            keepFocus, the §4b standards)
system/marvelmultiverse/    accessors, the entity renderer, the dice, the sheet, the creator, the
                            site's tabs; for the table: ops, the table adapter, panels
gm/                         the Narrator's page, the table (vtt.html), the player's page (M3)
worker/                     the session rooms (Cloudflare Worker + Durable Object); not deployed
```

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| M0 | Repo skeleton: `engine/*.js` and `worker/` from VtM5e, `build/parse_dsl.py` and the build from L5R5e, renamed; `engine/config.js`; `system/marvelmultiverse/ops.js`; launch entries (`vtt-marvelmultiverse` 8746, `vtt-marvelmultiverse-worker` 8802) | **landed 2026-09-27** — `grep -rniE 'vtm\|vampire\|kindred\|l5r\|samurai\|rokugan\|coyote'` over `engine worker/src build` matches only provenance comments ("Ported from sortilege-vtt-l5r5e"); the pilot parse reads 240 of 240 DSL files; `node` loads `engine/ops.js` + `system/marvelmultiverse/ops.js` (register, shared, playerView…) |
| M1 | `build/` generates `data/` from the corpus losslessly; `verify_data.py` both directions **and by count**; `check_shape.py` against counts scanned from the corpus; `build_layer.sh` with a Marvel fixture | **landed 2026-09-27** — `bash build/build.sh` exit 0: 240 corpus files → 2 books, 1,978 entities (0 ids written here), 1,245 records; `verify_data: 8422 strings (78326 occurrences) — 0 uncovered · 0 short · 0 unsourced`; `check_shape: OK (186 assertions)` — every typed set by its own EXTENDS lines (27), both ACTORs and 25 declared fields, every row of all 17 typed-list kinds (Power Entry 2,888 … Biography Section 5) by a bracket count of the raw text, every named value by field name, 25 TABLEs / 150 ROWs, 85 GUIDANCE entries, the DESCRIPTIONs. **Proven to fail**: a corpus copy with one Speed row added to Loki and his Teams value moved onto Base → 5 FAILED (exit 1). `build_layer.sh build/fixtures/layer`: 24 strings 0/0/0, references and names resolve; a copy with a mistyped Character hash and MODIFY name **fails** (exit 1) |
| M2 | The site: the books (outline, reader, sidebars, tables), the character profiles, powers and power sets, origins/occupations/traits/tags, the Multiverse's teams and places, the glossary, the d616 roller, search; the §4b standards that concern the site (robots, books off by default) | **landed 2026-09-27** — in the browser pane through the real controls: books off by default shows 5 tabs (Characters, Powers, Character options, Glossary, Dice), on shows 8; Loki's profile as the book sets it (the head's seven numbers, the six-row Ability grid, Damage, printed Traits/Tags, Powers by set with each power linked); a power opened from a profile with the books closed shows the entry alone, its crumbs unlinked; the d616 roller with `crypto.getRandomValues` pinned replays the book's Edge example (1 5 2 +1 = 9 vs 10 → reroll the 1 → 5 5 2 +1 = 13, Success) and Trouble example (6 M 5 → the M rerolled → 6 2 5 = 13) through the inputs and the die button; Rank 4 + Difficult fills TN 16 from the corpus's two tables; EMPHASIS drawn into Fantastic Rolls' prose and its examples as Example sidebars; *Powers* opens as a 321-entry contents list; the Multiverse's 10 groups = the typed counts (213); options 37/18/63/56; glossary 148; search "Healing Factor" → 51 hits; 375 px light: no horizontal scroll, the menu, a live roll; 0 console errors. `node build/check_dice.js`: 8 assertions from Core Mechanics' worked examples, OK — and 4 FAILED with the logo counted as 1 and trouble keeping the better die |
| M3 | The Narrator's page (and its §4b gate): Adventure (the Narrator's own scenes), Heroes, Inspector, Cast, Powers, Dice, Rules & Book, Log, Campaign; the engine's GM panes (Overview, Scenes, Threads, Places, People, Settings); a first live sheet (Health, Focus, Karma; checks from the profile's Ability Lines); the table and the player's page wired | **landed 2026-09-27** — in the browser pane through the real controls, 1500 px and 900 px: the gate (*The Narrator’s table*) → Enter; the nav lists the 9 system panels and the 6 engine panes, all render; **Adventure**: two scenes added (Add button and Enter), the first current; **Heroes**: *Spider-Man (Peter Parker) (p. 237)* picked (the duplicate name carries its page), player Sam → card *Rank 4 · Peter Parker · Health 90/90 · Focus 90/90 · Karma 4/4 · played by Sam*; the sheet's Health − → 89, logged *Health 90 → 89*; the *Agility 7* check presets the roller (*Rolling for … · Agility*), dice pinned → *4 M 2 = 12 + 7 → 19*, a Fantastic roll, logged under the hero, the result kept on screen; **Cast**: Loki + → the scene's *In it*; his chip opens the Inspector (the profile's head: Rank 5, Karma —, Health 90, Focus 120, Initiative +4); **Powers** 30 printed sets; **Rules & Book** *Karma* → 150 results; **Log** the three entries. **Table** (`gm/vtt.html`): scenes, the hero and Loki as token sources; both placed, reading *Health 89 · Focus 90* and *Rank 5*. **Player's page**: the hero's file loaded through the file input → *… is ready — they take their seat when you join*; a foreign file refused. 900 px: single-panel mode, no horizontal scroll. 0 console errors on all three pages. `node`: the Worker-side ops load (putScene, setSceneCast, setGm, setArc; the four GM ops local). Test campaign cleared from the browser |
| M4 | The character sheet derived from `ACTOR "Character"`, the creator (*Creating a Character* walked over the typed sets), the live sheet (Health, Focus, Karma) and d616 checks | the browser, through the real controls |
| M5 | Sessions proven with `wrangler dev` on 8802; deploy is the owner's step (D3) | two pages, two origins, one room |

One commit per milestone; each proven by the main session through the real controls
(PLAYBOOK §5) before the next begins.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | `engine/`, `worker/`, `robots.txt`, `.gitignore` copied from VtM5e HEAD `91c233a`; the parser and the build (`build_data`, `verify_data`, `check_shape`'s helpers, `build_layer`, the fixture folder) from L5R5e HEAD `312af2b`. Taken by `git archive` of each HEAD, never the working trees | The owner named VtM5e and L5R5e. VtM5e's engine is the newer (engine-level GM panes, `keepFocus`); L5R5e's build is the lossless generic dump (its decision 4). VtM5e's working tree holds another session's uncommitted work; `git archive` keeps it out. The same pair Coyote & Crow started from |
| 2 | Local ports **8746 / 8802** | Every port in 8731–8745, 8747–8753, 8787–8801 is in a launch entry already (`~/.claude/launch.json` and every VTT's own); neither is listening (`ss -ltn`). Both entries added to `~/.claude/launch.json` |
| 3 | D2 above: two books, `core` and `x-men` | — |
| 4 | No parser extensions were needed; Coyote & Crow's sixth (a typed DEF-valued property) and Daggerheart's same-line row are **not** carried | This corpus writes neither construct (no `^"P" #h ^"T" DEF {` and no same-line `"label" "text"` rows); the shape gate passes on L5R5e's parser as it is |
| 5 | `check_shape.py` written here, generic: one assertion per type from the corpus's own `EXTENDS` lines, per typed-list kind from a bracket count of the raw text, per field name from a regex over every `^"X" STRING "…"` value — rather than a hand list of sets | 27 types, 17 list kinds, every field name, none named by hand; a new type or field in a new book is checked without a code change. L5R5e's asserts L5R's own sets and could not run here |
| 6 | `RECORD_FIELDS` (what a list view reads without loading a book): Type, Rank, Real Name, Occupation, Origin, Teams, Size, Action, Duration, Cost, Printed Power Set, Set, Ability | The fields a profile list and a power list sort and filter on, read off the BASE |
| 7 | The layer fixture rewritten for this corpus: a Character with a Speed row and a Power Group, a MODIFY and a CONCERNS by name on *Flexible Fingers* (a name printed once) | The inherited fixture pointed at L5R5e hashes; the gate must be proven against this corpus |
| 8 | GM-facing labels in `engine/config.js` say **Narrator** (the gate's title and text); the default campaign is "A new campaign" with no module and the GM page opens on Adventure, Party, Inspector | The book's own word for the GM; "campaign" is the book's word too (it has no saga/chronicle), and no book ships an `.arc` |
| 9 | Not taken: VtM5e's maps page (`pages.maps`), L5R5e's art build and chargen check | VtM5e-specific (relationship maps are V9 of that VTT) or L5R-specific; the maps page can be ported at M3 if the Narrator wants it |
| 10 | `system/marvelmultiverse/data.js` and `entity.js` ported from L5R5e (the same data shape); L5R's lore graph, arcs, rings, curriculum, game lists and Markdown lore left out; `dice.js`, `site.js`, `assets/css/marvelmultiverse.css` written here | The data is L5R5e's lossless dump, so its accessors fit; nothing of L5R's look or game comes across |
| 11 | EMPHASIS is drawn back into the prose it marks (each run bolded where it first occurs after the previous one, whole words only) and never rendered as a block | Spec §5.4: recorded beside the verbatim text so "a renderer can still set [it] the way the book sets it"; the corpus has 722. The spec does not say bold or italic, so one weight is used for both |
| 12 | Worked examples are read from each entity's own blocks, not only a file's top level | 76 GUIDANCE blocks sit inside the entity they explain (build_data keeps an ENTRY carrying EMPHASIS as a block, not as `guidance`) |
| 13 | A typed list of rows renders as a table, one column per field; when every row carries `Printed`, as that printed string in a line, linked where its `Name` names an entry | The profile prints traits, tags and powers as a line; its abilities, damage and speeds as a grid. The printed form is the verbatim one |
| 14 | A large entry (more than 40 beneath it) opens as its own text plus a contents list | *Power Descriptions* holds 321 powers; rendering it at once made the page unusable (Coyote & Crow's decision 14) |
| 15 | Tabs: The books, the Multiverse and Search are the books' tabs (closed by default, §4b.4); Characters, Powers, Character options, Glossary and Dice always show | §4b.4: reference tabs, stat blocks and dice stay; the Multiverse is setting text. With the books closed a single entry still opens, but its breadcrumbs are text, not links back into the book |
| 16 | The d616: the player picks which die an edge rerolls; trouble rerolls the best die automatically (of two equal best, the first listed); edges and troubles net off before rolling; 6 M 6 ignores trouble | Each step cites its sentence in dice.js; the rules are pure and replayed by build/check_dice.js |
| 17 | The TN helpers (Rank → Challenging TN, adjective → modifier) read *Challenging TN by Rank* and *TN Modifiers by Adjectives* from the data | No number typed by hand; "—" (Challenging) reads as 0 |
| 18 | Vehicles (3, stat blocks) are listed on Characters; Opponents (37, prose on groups) are in the Multiverse | Opponents carry a description and a Profile paragraph, not a stat block |
| 19 | The favicon is the tool's own red-die mark; the look (newsprint, ink, one red) is written here | D4: no book art. The red is the book's own suggestion for a stand-in Marvel die |
| 20 | Candidate, not done: where a type holds both a parsed list and its printed string (an Origin's `Tags` and `Printed Tags`), both show | Showing one would be an editorial call on the corpus's own duplication; left for the owner if it reads as noise |
| 21 | The Narrator's scenes are VtM5e's Chronicle (its `scenes` ops, `setSceneCast` by record id), under module id `adventure`; its loresheets, conflicts and relationship maps not taken | Neither book ships an `.arc`; VtM5e is the sibling whose GM writes the scenes. Those three are Vampire's own |
| 22 | A first live sheet at M3 (`sheet.js`): a hero is a profile id (or blank) + `live {health, focus, karma}`; every number is the profile's printed string, never derived; the check buttons preset the d616 with the Ability Score ("added to any action check made using that ability") or the printed Non-Combat Checks | The table and the player's page need a sheet; the one derived from ACTOR "Character" is M4. Coyote & Crow did the same at its M3 |
| 23 | Records carry `file` and the profile's Health, Focus and Karma (`RECORD_FIELDS`); data/records.js rebuilt through every gate | A hero added on the GM page, whose book is not yet loaded, came out with no live numbers (found in the browser); the printed page tells two printings of one name apart (Peter Parker, p. 22 and p. 237) |
| 24 | One d616 roller per hero, kept across redraws | A roll commits to the log, the log redraws the Inspector, and a new roller lost the roll on screen (found in the browser; VtM5e's sheet keeps its rollers the same way) |
| 25 | `assets/css/gm.css` copied whole (the engine's own GM stylesheet, identical in VtM5e and Coyote & Crow); `marvelmultiverse-gm.css` written here | The first is the engine's; the second is this site's look |
| 26 | The GM page's tab title still reads "the GM’s table" (engine/app.js) | An engine string shared by the family; the gate and the page's own words say Narrator |
