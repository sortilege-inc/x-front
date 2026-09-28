# X-FRONT

A **Marvel Multiverse** campaign: young mutants who have stopped waiting for protest and petition to
work. Toya Terrence (Tank) and Tabitha Fanning (Taboo) formed X-FRONT after a pride march in
Tallahassee went south; Stasis, Regret and Half-Life have joined them, and in Florida the state has
taken Taylor Crenshaw (Flare).

This repo is an **instance** of [`sortilege-vtt-marvelmultiverse`](https://github.com/sortilege-inc/sortilege-vtt-marvelmultiverse):
the VTT owns the root (the site at `/`, the Narrator's table at `/gm/`, the player's page, the engine,
the generated book data); the campaign owns `campaign/` and a few per-deployment root files
(`.gitattributes`, `merge=ours`).

```bash
git config merge.ours.driver true        # once per clone — the fork boundary needs it
git fetch upstream && git merge upstream/main   # pull the VTT; a merge, never a rebase
bash campaign/build/build.sh             # the heroes, the public pages, the Narrator's seed
```

The heroes are the owner's six short-form sheets (`campaign/source/sheets/`), read by poppler's text
layer into `campaign/source/sheets.json`, written into the campaign's DSL layer (`campaign/dsl/`),
built through the books' gate into `campaign/data/`, and checked field by field against the sheets.
Local: the launch entries `x-front` (8757) and `x-front-worker` (8807). The plan, the decisions and
the proof of each step are in `campaign/PLAN.md`.
