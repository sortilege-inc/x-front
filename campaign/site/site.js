// campaign/site/site.js — X-FRONT's own tabs on the VTT's site, ahead of the system's (engine/instance.js,
// stage `site`): the campaign's home and the heroes. The home's prose is campaign/data/docs.js
// (window.XFRONT_DOCS, built by campaign/build/build_docs.py); a hero's page is drawn from the hero's
// profile in the campaign's layer (campaign/data/campaign.js, built from campaign/dsl/ by
// build/build_layer.sh) — the same entity the Narrator's sheet reads — with its portrait. Every trait,
// tag and power on it opens the book's entry, or the hero's own wording of it, even with the books closed.
(function () {
  const DOCS = window.XFRONT_DOCS;
  const tabs = window.VttSiteTabs;
  if (!DOCS || !Array.isArray(tabs)) return;
  const { el } = window.VttRender;
  const D = window.MMData;
  const E = window.MMEntity;

  // presentation only, keyed by the hero's name: the portraits the owner supplied (campaign/assets/)
  const PORTRAITS = {
    Flare: 'flare', 'Half-Life': 'half-life', Regret: 'regret', Stasis: 'stasis', Taboo: 'taboo', Tank: 'tank',
  };
  const portrait = (name, cls) => PORTRAITS[name]
    ? el('img', { class: cls, src: 'campaign/assets/portraits/' + PORTRAITS[name] + '.webp', alt: 'Portrait of ' + name, loading: 'lazy' })
    : null;

  const heroes = () => D.profiles().filter((r) => r.book === 'campaign').sort((a, b) => a.name.localeCompare(b.name));
  const page = (container) => { const p = el('div', { class: 'page xf-page' }); container.appendChild(p); return p; };
  const prose = (h, cls) => { const d = el('div', { class: 'xf-prose' + (cls ? ' ' + cls : '') }); d.innerHTML = h; return d; };
  const paras = (s) => String(s || '').split(/\n\n+/).map((t) => el('p', {}, [t]));
  const f = (r, k) => (r.fields || {})[k] || '';

  // ── the campaign ──
  function renderHome(container, path, ctx) {
    const p = page(container);
    const h = DOCS.home;
    p.appendChild(el('div', { class: 'xf-hero' }, [el('h1', { class: 'xf-title' }, [h.title]), el('p', { class: 'xf-sub' }, [h.subtitle])]));
    p.appendChild(prose(h.html, 'xf-lede'));
    p.appendChild(el('h2', { class: 'xf-h' }, ['The heroes']));
    p.appendChild(grid(ctx));
  }

  function grid(ctx) {
    return el('div', { class: 'xf-grid' }, heroes().map((r) => el('a', { class: 'xf-card', href: ctx.href('heroes', [r.id]) }, [
      portrait(r.name, 'xf-card-img'),
      el('div', { class: 'xf-card-t' }, [r.name]),
      el('div', { class: 'xf-card-s muted small' }, [[f(r, 'Real Name'), f(r, 'Rank') && 'Rank ' + f(r, 'Rank')].filter(Boolean).join(' · ')]),
    ])));
  }

  // ── the heroes: the roster, then one hero to a page ──
  function renderHeroes(container, path, ctx) {
    const p = page(container);
    const r = path[0] && heroes().find((x) => x.id === path[0]);
    if (!r) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['The heroes']));
      p.appendChild(grid(ctx));
      return;
    }
    p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('heroes', []) }, ['The heroes']), ' › ', r.name]));
    const note = el('div', { class: 'muted loading' }, ['Opening ' + r.name + '…']);
    p.appendChild(note);
    D.ensure('campaign').then(() => {
      note.remove();
      const e = D.entity(r.id);
      const field = (k) => { const x = (e.props || []).find((pp) => pp.name === k); return x && x.value; };
      const bio = ((e.props || []).find((pp) => pp.name === 'Biography Sections') || { items: [] }).items
        .map((it) => ({ h: (it.d.find((x) => x.name === 'Heading') || {}).value, t: (it.d.find((x) => x.name === 'Text') || {}).value }));
      const age = bio.find((b) => /^Current age$/i.test(b.h || ''));
      p.appendChild(el('div', { class: 'xf-head' }, [
        portrait(r.name, 'xf-portrait'),
        el('div', { class: 'xf-head-t' }, [
          el('h2', { class: 'chapter-h xf-name' }, [r.name]),
          el('table', { class: 'xf-facts' }, [el('tbody', {}, [
            ['Real name', field('Real Name')], [age ? age.h : 'Age', age && age.t], ['Rank', field('Rank')], ['Origin', field('Origin')],
            ['Occupation', field('Occupation')], ['Teams', field('Teams')], ['Height', field('Height')], ['Weight', field('Weight')],
            ['Gender', field('Gender')], ['Eyes', field('Eyes')], ['Hair', field('Hair')], ['Size', field('Size')],
            ['Distinguishing features', field('Distinguishing Features')],
          ].filter((x) => x[1]).map((x) => el('tr', {}, [el('th', {}, [x[0]]), el('td', {}, [x[1]])])))]),
        ]),
      ]));
      p.appendChild(el('h3', { class: 'xf-h' }, ['History']));
      p.appendChild(el('div', { class: 'xf-prose' }, paras(field('History'))));
      p.appendChild(el('h3', { class: 'xf-h' }, ['Personality']));
      p.appendChild(el('div', { class: 'xf-prose' }, paras(field('Personality'))));
      bio.filter((b) => b !== age).forEach((b) => {
        p.appendChild(el('h3', { class: 'xf-h' }, [b.h]));
        p.appendChild(el('div', { class: 'xf-prose' }, paras(b.t)));
      });
      p.appendChild(el('h3', { class: 'xf-h' }, ['The sheet']));
      p.appendChild(el('div', { class: 'site-reader solo xf-sheet' }, [E.render(e)]));
    }).catch((err) => { note.remove(); p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + err.message])); });
  }

  tabs.unshift(
    { id: 'x-front', label: 'X-FRONT', render: renderHome },
    { id: 'heroes', label: 'The heroes', render: renderHeroes },
  );
})();
