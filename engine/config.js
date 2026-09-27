// engine/config.js — where things are. The one file a deployment edits.
window.VttConfig = {
  system: 'marvelmultiverse',
  title: 'Marvel Multiverse',
  channel: 'sortilege-vtt-marvelmultiverse', // BroadcastChannel name (same-machine windows)
  storagePrefix: 'sortilege-vtt-marvelmultiverse', // localStorage key prefix
  dataGlobal: 'MARVELMULTIVERSE',        // the global data/*.js registers into
  // The pages, relative to the site root; the gm/ pages carry <base href="../"> so every
  // path stays root-relative.
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // what a fresh browser opens on until a campaign is created or restored.
  // An instance may add `seed: 'campaign/pack/seed.json'` — a pack whose keys fill what its
  // campaign has never had (its arc, its threads), once (engine/state.js seed).
  // An instance may also name the Notes pane's document (engine/gm-panes.js):
  //   notes: { src: 'campaign/docs/state.html', title: '…', class: '…',
  //            gate: { title: '…', text: '…', enter: 'Enter' } }
  // a .html src is the instance's own fragment, inserted as it is; anything else reads as Markdown.
  defaultCampaign: { name: 'A new campaign', modules: [], books: [] },
  // the three panels the GM page opens on (engine/app.js)
  defaultSlots: ['adventure', 'party', 'inspector'],
  // What an instance adds to these pages (engine/instance.js). Upstream declares none, so
  // every stage tag is a no-op here; a campaign repo forked from this VTT owns engine/config.js
  // and fills this in. Its DSL layer is built by build/build_layer.sh into its own data folder.
  //
  //   instance: {
  //     styles: ['campaign/site/campaign.css'],
  //     stages: {
  //       data:  ['campaign/data/index.js'],   // every page, after the books' index and records
  //       site:  ['campaign/site/site.js'],    // push tabs onto window.VttSiteTabs
  //       gm:    ['campaign/site/gm.js'],      // window.VttPanels.register(id, {label, render, count})
  //       table: [], play: [],                 // the map table's and the player's page, before they boot
  //     },
  //   },
  instance: null,
  // The Worker that holds player sessions. Served from localhost the app talks to
  // `wrangler dev`; deployed, to the URL below. Empty = sessions disabled until the owner
  // deploys (PLAN.md D3).
  // The family standards (PLAYBOOK §4b): the public site's book tabs are off — the GM turns them on,
  // per browser, in the GM page's Settings (engine/site.js) — and a veil stands in front of /gm/
  // (engine/app.js). The GM's own material lives in the GM tabs (engine/gm-panes.js), in the pack.
  siteBooks: false,
  gmGate: {
    title: 'The Narrator\u2019s table',
    text: 'Beyond is the Narrator\u2019s material \u2014 the prep, the threads, what the players have not yet found. If you are playing, turn back.',
    enter: 'Enter',
    leave: 'Turn back',
  },
  worker: {
    deployed: '',
    local: 'http://localhost:8802',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
