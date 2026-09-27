# sortilege-vtt-marvelmultiverse

A virtual tabletop for the **Marvel Multiverse Role-Playing Game**, generated from the Titterpig
corpus `titterpig-dsl-marvelmultiverse/0.5`: the Core Rulebook and the X-Men Expansion to read,
the d616 dice, the character profiles, powers, origins and occupations, and live sessions for
players on their own devices.

- `/` — the site: the books, the profiles, the powers, the dice, making a character, search.
  Writes nothing.
- `/gm/` — the Narrator's table: panels over the campaign, the map table (`gm/vtt.html`), the
  player's page (`gm/play.html`). *(M3)*

No build step for the pages; `data/` is generated:

```bash
bash build/build.sh
```

It parses every corpus file, writes `data/`, and gates the result both ways (every string the
corpus prints reaches the data as often as it is printed, and nothing in the data is not in the
corpus), then checks the shapes the site reads against counts taken from the raw corpus.

Local: the launch entries `vtt-marvelmultiverse` (8746) and `vtt-marvelmultiverse-worker`
(8802). See `PLAN.md` for the milestones, the decisions and the proof of each.
