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

**D3 — private; deployment deferred (owner, 2026-09-27).** The GitHub repo stays private. Nothing in
the repo hard-codes an origin; the Worker admits localhost and, until a deploy is decided, only
`sortilege-inc.github.io`; `engine/config.js` has `worker.deployed` empty.

**D4 — no art, for now (owner, 2026-09-27: "not as a policy but just for now").** The site stays
text and CSS with the tool's own red-die mark. Asked with the option of the profile portraits in the
owner's PDFs (the core's 129 embedded at ~390×500, Loki p. 197 the example; the X-Men's 82 cut from
its scan); open to be asked again — nothing here rules the portraits out.

**D5 — the §4c GM workbench, ported (owner, 2026-09-27).** From sortilege-vtt-coyotecrow's engine
(HEAD `eacafd5`: app.js, gm-panes.js, gm-text.js — the same VtM5e base, so the three files came
across whole) and its system panes: the sectioned nav, five layout presets with click-to-select
regions, the draggable Scenes outline of typed beats, Encounter beats, and the scene's cast as
tracked copies, each with its own Health and Focus. The Scenes outline replaces M3's separate
scene list: the arc is the campaign's scenes, and the Adventure panel runs one.

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
| M4 | The sheet derived from ACTOR "Character"; the creator (*Creating a Character* walked over the typed sets); the live sheet (Health, Focus, Karma; checks, damage from the check's own Marvel die, Karma for an edge); D5, the GM workbench | **landed 2026-09-27** — `node build/check_chargen.js` (in build.sh): 19 assertions — Young Lion, the chapter's example, built from its own choices comes out as the book prints him (its Ability Scores Table, its Damages Table, Health 30, Focus 30, Initiative +1, Karma 1, Speeds 5/3/3/3, 2 traits and 7 tags read from its Backstory paragraph); a fifth power, a score over the cap, one under −3 and a missing prerequisite refused; "do not stack" on Mighty 1 + Mighty 3; the damage and non-combat derivation explains **199 of 211** printed profiles exactly (the 12 others: weapons and gear, listed with `--list`, pinned). Seen failing: Health ×20 → 1 FAILED; bonuses summed → 1 FAILED. In the browser pane through the real controls: the site's *Make a character* tab (shown with the books off) walked Young Lion step by step — budget 5/5 points, 4/4 powers, 1/1 extra trait; step 5 shows his book numbers; typing in Codename and in Ego ("−" then "1") keeps focus and value; Ego −1 frees a point (4/5); a fifth power → "5 powers; Rank 1 gives 4.", removed → clear. GM page: Heroes ▸ *Make a hero…* → *Take this hero to the table* → the sheet from the ACTOR (head, trackers 30/30/1, abilities with defense and damage, the rest of the declared fields in declared order); Melee check vs TN 10, dice pinned *4 M 2* → 14, Fantastic Success, *damage 28 = M (6) × 2 + 2, doubled*; *Spend 1 Karma for an edge* → Karma 1 → 0 (logged), reroll the 2 → 6, total 18; with Karma 2 the offer comes once per check. Workbench: the nav in five sections; Scenes ▸ scene ▸ *+ Encounter* ▸ A.I.M. Agent ×3 ▸ *Put on the table* → three copies at Health 10 / Focus 60, the scene running; Agent 2 and 3 to 0 → down (the row restyles at once); Adventure lists them, *Open* → the Inspector's copy tracker and *Put another in…*; Settings ▸ Layout: five presets, *Four columns* → 4 regions, a clicked region takes the next nav choice; *Three columns, first split* → Scenes over Adventure, no region scrolls sideways. Table: each copy its own token (*A.I.M. Agent 2 · Health 0 · Focus 60*). Player's page: a created hero's file loads (*Young Lion is ready…*), *Make a character…* opens the creator. Phone (375 px): every creator step fits. 0 console errors. `node`: the cast is shared, npcState hidden from players, the four pack ops local. Test state cleared from the browser |
| M5 | Sessions proven with `wrangler dev` on 8802; deploy stays off (D3) | **landed 2026-09-27** — `worker/`: `npm ci` (wrangler 4.136.3), `wrangler deploy --dry-run` bundles 20.87 KiB with this system's ops; `wrangler dev` on 8802: a localhost origin gets a room, a foreign one 403. `NODE_PATH=~/App/ray-so/scripts/node_modules node tools/check-session.js` → `check-session: OK` (exit 0), headless Chromium through the real controls, two origins with their own storage: the Narrator (localhost:8746) adds Spider-Man (p. 237) for Sam, a scene with two tracked A.I.M. Agents (Agent 1 at Health 4) and private notes, and starts a session → room *live*; the player (127.0.0.1:8746, 390 px) follows the join link, claims the hero → the sheet; the player's view holds no npcState, no GM notes, no arc (the cast is shared); the player's Health − and Agility check (dice pinned, *4 M 2 → 19*) reach the GM; the Narrator's Focus 80 reaches the player; the player's forbidden ops are refused by the room (*not allowed: setNpcState*, *not allowed: setSceneCast*; setGmNotes, local, is never sent) and the GM's state is unchanged; the GM's table shows *A.I.M. Agent 1 · Health 4 · Focus 60*, the player's table (opened by its *Open the table* link) the token without it; a reload keeps the seat; 0 console errors on five pages. **Seen failing**: with setNpcState opened to players, `check-session: 2 FAILED` (exit 1); restored from git → OK |

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
| 27 | D5 as ported: Scenes (the arc) are the campaign's scenes; M3's VtM5e `scenes` ops and scene list are gone; `setSceneCast` stores `{ [sceneId]: [instance] }`; `setNpcState` (the Narrator's own) holds a copy's current Health and Focus | One scene list, not two; a copy's numbers start at the profile's printed ones, like a hero's |
| 28 | The sheet derives from the ACTOR's declared props down its EXTENDS chain; the head, the ability grid, damages, traits/tags and powers get the profile's own layout, every other declared field shows in declared order | PLAYBOOK §1b; one sheet for a printed profile and a created hero (same value shape) |
| 29 | The creator's numbers: the per-rank table rows; the prose rules as named constants citing their sentences (Health 30×, Focus 30×, Defense +10, the −3 floor, Run 5 + 1 per 5 Agility ± Big/Small, Climb/Jump/Swim half of Run rounded up, Initiative = Vigilance); a power's damage-multiplier and non-combat bonuses read from its own Effect ("adds +N to their X damage multiplier", "a +N bonus to X checks other than attacks"), the largest per ability ("do not stack") | Nothing typed; the Effect-reading reproduces 199 of 211 printed profiles, which is its proof |
| 30 | Young Lion's origin in the check is *Magic: Sorcery*: the example says "the Magic origin … gives them the tags Sorcerous and Supernatural", but the origin the core prints as *Magic* gives Supernatural alone | The book disagrees with itself; the origin whose printed tags match the sentence is taken. Not a conversion defect (the corpus prints both origins verbatim), so not reported to the corpus TODO |
| 31 | The creator does not convert unused power picks into ability points | "you can use the extra picks to add to your character's ability scores" (Powers) states no rate; left to the Narrator rather than invented |
| 32 | Damage shown under an attack check = the check's Marvel die (M = 6) × the Damage line's multiplier + the ability score, doubled on a Fantastic success | Damages, Roll d616 and Fantastic Success, each cited in sheet.js; shown as "if it hits" — the defense is the target's |
| 33 | Karma for an edge: offered under a finished check while the hero has Karma, once per check, never on 6 M 6 | Karma: "After a character makes an action check, they can spend a point of Karma to gain an edge"; "cannot spend more than 1 point of Karma on any given action check" |
| 34 | The 12 profiles the derivation cannot explain are pinned (`KNOWN_UNEXPLAINED = 12`, must equal) | Weapons and gear the rules here don't read (the Wolverines, Daredevil, the Thors, Captain America…), Sentinel's size, Polaris one lower than her Brilliance gives; a change in either direction fails the build |
| 35 | A character file is version 2 (adds `character`); version 1 files (M3, a profile id) still load | A created hero has no profile to point at |
| 36 | Not ported from C&C: its `npcConditions` (Effects and States) | No typed condition set in this corpus to offer; a candidate if the Narrator wants free-text conditions |
| 37 | M5 runs headless (Playwright from ray-so's install; the repo served from disk for both origins by `route`), the Worker in the browser pane's launch slot | The pane's five dev-server slots per folder were four other chats'; this chat's site server was stopped for the Worker and restored after. The family's method (VtM5e memory) |
| 38 | The harness launches Chromium with Local Network Access checks off | A page served by `route` has no address, so Chromium counts it public and blocks its calls to the loopback Worker; a real `http://localhost:8746` page is loopback itself. A harness setting, not a product change |
| 39 | `tools/check-session.js` kept in the repo as M5's gate (not in build.sh: it needs the Worker running and Playwright, which is not a dependency here) | Re-runnable proof; asserts, exits 1 on any failure, and was seen failing |
| 40 | The players' side shows a copy's printed Rank, never a number, in `tokenStatus` | The engine already draws a cast token's status only for the GM (vtt.js), so nothing leaked; this also covers the player's page, where a printed Health would read as the copy's live one |
| 41 | Known, not fixed here: a player's refused op on a key the room does not share (npcState) stays in that player's own browser copy — the room's snapshot replaces shared keys only | Engine behaviour (engine/state.js replaceShared), family-wide; only reachable from a player's dev console; the room, the GM and every other player are untouched (proven). Candidate for an engine fix upstream |
| 42 | Deployment stays off (D3): `engine/config.js` `worker.deployed` empty; the Worker admits localhost and `sortilege-inc.github.io` only | The owner's ruling |
