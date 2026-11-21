// A CDN: readers far from the origin wait; edge caches near them keep copies;
// a miss fetches from the origin; changing the file needs a purge so the
// edges stop serving the old copy. The request lines run through the spots
// where the edges will stand, so the edges appear right on the way.
BLUEPRINT.scene('cdn', {
  title: 'How a CDN brings files closer',
  fig: 5,
  size: [800, 400],
  parts: [
    { id: 'eu', kind: 'zone', at: [195, 110], size: [350, 140], label: 'LONDON' },
    { id: 'au', kind: 'zone', at: [195, 300], size: [350, 140], label: 'SYDNEY' },
    { id: 'home', kind: 'zone', at: [660, 205], size: [200, 340], label: 'MUMBAI' },
    { id: 'userL', kind: 'screen', at: [80, 110], size: [100, 70], label: 'READER', n: 1, lead: 's', name: 'Reader', note: 'opens photo.jpg (240 KB) from London' },
    { id: 'userS', kind: 'screen', at: [80, 300], size: [100, 70], label: 'READER' },
    { id: 'origin', kind: 'cabinet', at: [650, 190], size: [80, 100], rows: 4, label: 'ORIGIN', labelAt: 'e', n: 2, lead: 'sw', name: 'Origin', note: 'the one server that holds the real files, in Mumbai' },
    { id: 'gear', kind: 'gear', at: [650, 92], size: [40, 40], teeth: 12 },
    { id: 'edgeL', kind: 'drawer', at: [300, 110], size: [90, 40], label: 'EDGE · LHR', n: 3, lead: 'n', link: 'cache', name: 'Edge cache', note: 'a drawer of copies a few km from readers; 300+ cities' },
    { id: 'edgeS', kind: 'drawer', at: [300, 300], size: [90, 40], label: 'EDGE · SYD' },
    { id: 'clock', kind: 'clock', at: [190, 66], size: [36, 36], label: 'TTL 24 H', labelAt: 'e', n: 4, lead: 'n', name: 'Timer (TTL)', note: 'how long an edge trusts its copy, e.g. 24 hours' },
    { id: 'tower', kind: 'tower', at: [650, 322], size: [36, 64], label: 'PURGE', labelAt: 'e', n: 5, lead: 'w', name: 'Purge', note: 'tells every edge to drop a file, done in ~2 S worldwide' }
  ],
  lines: [
    { id: 'uL', from: 'userL.e', to: 'edgeL' },
    { id: 'eL', from: 'edgeL', to: 'origin.w-24' },
    { id: 'uS', from: 'userS.e', to: 'edgeS' },
    { id: 'eS', from: 'edgeS', to: 'origin.w+24' },
    { id: 'shaft', from: 'gear.s', to: 'origin.n', heavy: true },
    { id: 'tw', from: 'tower.n', to: 'origin.s', kind: 'wire' },
    { id: 'dist', from: [134, 200], to: [604, 200], kind: 'dim', label: '7,200 KM · ~180 MS THERE AND BACK' }
  ],
  steps: [
    {
      say: 'A reader in London (1) opens photo.jpg, which lives on one server in Mumbai (2).',
      draw: ['eu', 'userL', 'uL', 'eL', 'home', 'origin', 'gear', 'shaft'],
      run: [
        { on: 'uL', item: 'chip', text: 'PHOTO.JPG', dur: 0.9 },
        { on: 'eL', item: 'chip', text: 'PHOTO.JPG', dur: 1.1, arrive: { glow: ['origin'] } }
      ]
    },
    {
      say: 'The photo crosses 7,200 km to get back, so every reader waits.',
      draw: ['dist'],
      spin: ['gear'],
      run: [
        { on: 'eL', back: true, item: 'packet', count: 3, gap: 0.25, dur: 1.2 },
        { on: 'uL', back: true, item: 'packet', count: 3, gap: 0.25, dur: 0.8 }
      ]
    },
    {
      say: 'Sydney waits even longer, and the one origin (2) has to serve the whole world.',
      draw: ['au', 'userS', 'uS', 'eS'],
      spin: ['gear'],
      run: [
        { on: 'uS', item: 'chip', text: 'PHOTO.JPG', dur: 0.8 },
        { on: 'eS', item: 'chip', text: 'PHOTO.JPG', dur: 1.1, arrive: { glow: ['origin'] } },
        { on: 'eS', back: true, item: 'packet', count: 3, gap: 0.25, dur: 1.2 },
        { on: 'uS', back: true, item: 'packet', count: 3, gap: 0.25, dur: 0.8 }
      ],
      note: { at: 'userS.s', text: '10,200 KM · ~220 MS' }
    },
    {
      say: 'So put edge caches (3) beside the readers: drawers that keep copies of popular files.',
      draw: ['edgeL', 'edgeS'],
      then: { glow: ['edgeL', 'edgeS'] }
    },
    {
      say: 'The first London request misses, so the edge fetches from Mumbai and keeps a copy.',
      view: ['userL', 'edgeL', 'origin'],
      spin: ['gear'],
      run: [
        { on: 'uL', item: 'chip', text: 'PHOTO.JPG', dur: 0.8, arrive: { fail: ['edgeL'] } },
        { on: 'eL', item: 'chip', text: 'PHOTO.JPG', dur: 1.0 },
        { on: 'eL', back: true, item: 'packet', count: 3, gap: 0.25, dur: 1.0, arrive: { set: { edgeL: { fill: 1 } } } },
        { on: 'uL', back: true, item: 'packet', count: 3, gap: 0.25, dur: 0.6 }
      ],
      note: { at: 'edgeL.s', text: 'MISS · ~180 MS', dy: 26 }
    },
    {
      say: 'The next London reader gets it from the edge in 10 ms, with no trip to Mumbai.',
      view: ['userL', 'edgeL', 'eu'],
      run: [
        { on: 'uL', item: 'chip', text: 'PHOTO.JPG', dur: 0.8, arrive: { ok: ['edgeL'], glow: ['edgeL'] } },
        { on: 'uL', back: true, item: 'packet', count: 3, gap: 0.2, dur: 0.6 }
      ],
      note: { at: 'edgeL.s', text: 'HIT · ~10 MS', dy: 26 }
    },
    {
      say: 'But a new photo goes up in Mumbai, and the edge serves the old copy until its timer (4) ends.',
      view: 'all',
      draw: ['clock'],
      spin: ['clock'],
      set: { origin: { text: 'PHOTO V2' } },
      run: [
        { on: 'uL', item: 'chip', text: 'PHOTO.JPG', dur: 0.8 },
        { on: 'uL', back: true, item: 'chip', text: 'V1', color: 'fail', dur: 0.8, arrive: { fail: ['userL'] } }
      ],
      note: { at: 'edgeL.s', text: 'STALE FOR UP TO 24 H', dy: 26 },
      hold: 1.8
    },
    {
      say: 'So the origin sends a purge (5), and every edge throws its old copy away.',
      draw: ['tower', 'tw'],
      light: ['tower'],
      run: [
        { on: 'tw', back: true, item: 'letter', dur: 0.6 },
        { on: 'eL', back: true, item: 'letter', dur: 1.1, arrive: { set: { edgeL: { fill: 0 } } } },
        { on: 'eS', back: true, item: 'letter', dur: 1.1, with: true, arrive: { set: { edgeS: { fill: 0 } } } }
      ],
      note: { at: 'tower.e', text: '~2 S\nALL EDGES', dy: 18 }
    },
    {
      say: 'One miss fetches v2; after that, readers everywhere get the new photo from nearby.',
      run: [
        { on: 'uL', item: 'chip', text: 'PHOTO.JPG', dur: 0.7 },
        { on: 'eL', item: 'chip', text: 'PHOTO.JPG', dur: 0.9 },
        { on: 'eL', back: true, item: 'chip', text: 'V2', dur: 0.9, arrive: { set: { edgeL: { fill: 1 } } } },
        { on: 'uL', back: true, item: 'chip', text: 'V2', dur: 0.6, arrive: { ok: ['edgeL'] } }
      ],
      note: [
        { at: 'edgeL.s', text: 'HIT ~10 MS · MISS ~180 MS', dy: 26, dx: 62, anchor: 'end' },
        { at: 'edgeS.n', text: 'NEXT MISS FETCHES V2', dy: -10 }
      ],
      hold: 2.6
    }
  ]
});
