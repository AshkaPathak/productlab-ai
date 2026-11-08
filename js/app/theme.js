/* ProductLab AI - project themes for the Story page.
 * The app itself always wears the ProductLab colours (blueprint blue for
 * thinking, amber for building). A project's Story re-tints the same colour
 * slots to suit its subject: the theme is picked from the project's domain,
 * name and problem text, or chosen by hand on the Overview page.
 */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});

  /* Each theme: page colours, orb tones [highlight, body, shade] and liquid [top, bottom]. */
  const THEMES = {
    lab: { label: 'ProductLab (default)', keywords: [] },
    bloom: {
      label: 'Bloom: health and care',
      keywords: ['health', 'women', 'medical', 'clinic', 'patient', 'doctor', 'hormone', 'pcos', 'pmos', 'care', 'disease', 'diagnos', 'pregnan', 'nutrition', 'mental', 'therapy', 'hospital'],
      vars: { think: '#d9467a', 'think-ink': '#a72c5a', 'think-soft': '#fde8ef', 'think-rgb': '217, 70, 122', 'think-light': '#ffc3d6', build: '#2bb3a3', 'build-soft': '#dcf6f2', spark: '#ff8a5c', sea: '#2bb3a3', 'deep-2': '#8a3a73', 'deep-hi': '#6b2a5e', 'deep-mid': '#3d1838', 'deep-lo': '#1f0c1d', 'bg-a': 'rgba(255, 192, 214, .7)', 'bg-b': 'rgba(178, 232, 224, .62)', 'bg-c': 'rgba(236, 206, 240, .6)', 'grid': 'rgba(217, 70, 122, .05)' },
      tones: { think: ['#ffe0ea', '#e2588a', '#a72c5a'], build: ['#d8f6f1', '#2bb3a3', '#16786d'], deep: ['#d7a3c8', '#8a3a73', '#4a1a40'], soft: ['#ffffff', '#f6d8e5', '#d9a3bd'], spark: ['#ffe2d6', '#ff8a5c', '#c95a2c'] },
      liquid: { think: ['#ff9fc0', '#c93a6e'], build: ['#8de3d8', '#1b9486'] }
    },
    harvest: {
      label: 'Harvest: food and the planet',
      keywords: ['food', 'waste', 'farm', 'agri', 'harvest', 'produce', 'crop', 'climate', 'sustain', 'kitchen', 'canteen', 'mess', 'grocery', 'recycl', 'carbon', 'plant'],
      vars: { think: '#3f9b5f', 'think-ink': '#2a6e41', 'think-soft': '#e4f4e8', 'think-rgb': '63, 155, 95', 'think-light': '#bfe8c9', build: '#e6a23c', 'build-soft': '#fdf0d8', spark: '#e0603a', sea: '#3f9b5f', 'deep-2': '#4f7a3e', 'deep-hi': '#3a5a30', 'deep-mid': '#1f3520', 'deep-lo': '#0f1d10', 'bg-a': 'rgba(200, 232, 190, .7)', 'bg-b': 'rgba(250, 224, 170, .62)', 'bg-c': 'rgba(226, 236, 200, .6)', 'grid': 'rgba(63, 155, 95, .055)' },
      tones: { think: ['#e0f5e5', '#4fae6e', '#2a6e41'], build: ['#fdecc8', '#e6a23c', '#a86a12'], deep: ['#a9c79a', '#4f7a3e', '#26401d'], soft: ['#ffffff', '#dcebd2', '#a9c79a'], spark: ['#ffe0d4', '#e0603a', '#a8391b'] },
      liquid: { think: ['#9fdcb0', '#2f8a4c'], build: ['#ffd68a', '#d98a14'] }
    },
    signal: {
      label: 'Signal: digital life',
      keywords: ['digital', 'social', 'app', 'online', 'post', 'reel', 'video', 'media', 'screen', 'phone', 'internet', 'instagram', 'youtube', 'notification', 'content', 'feed', 'saved'],
      vars: { think: '#7a5cff', 'think-ink': '#5a3fe0', 'think-soft': '#efeaff', 'think-rgb': '122, 92, 255', 'think-light': '#cdbfff', build: '#22c3e6', 'build-soft': '#ddf6fc', spark: '#ff5fa2', sea: '#22c3e6', 'deep-2': '#6a52c9', 'deep-hi': '#4a3596', 'deep-mid': '#241a52', 'deep-lo': '#110b2b', 'bg-a': 'rgba(205, 191, 255, .7)', 'bg-b': 'rgba(170, 236, 250, .62)', 'bg-c': 'rgba(255, 196, 226, .5)', 'grid': 'rgba(122, 92, 255, .055)' },
      tones: { think: ['#ece6ff', '#8a70ff', '#4f36c9'], build: ['#d4f6fd', '#22c3e6', '#0b86a3'], deep: ['#b6a8ef', '#6a52c9', '#352575'], soft: ['#ffffff', '#e2dcfb', '#b6a8ef'], spark: ['#ffe0ef', '#ff5fa2', '#c22a6c'] },
      liquid: { think: ['#b3a3ff', '#5a3fe0'], build: ['#8ee6f7', '#0ea5c9'] }
    },
    campus: {
      label: 'Campus: learning and students',
      keywords: ['student', 'exam', 'education', 'school', 'college', 'learn', 'study', 'universit', 'teacher', 'class', 'course', 'campus', 'hostel'],
      vars: { think: '#2f7de1', 'think-ink': '#1f5fb4', 'think-soft': '#e3efff', 'think-rgb': '47, 125, 225', 'think-light': '#b9d6ff', build: '#ff8a3d', 'build-soft': '#ffeadb', spark: '#ffc93d', sea: '#2f7de1', 'deep-2': '#3f6db5', 'deep-hi': '#2a4f8f', 'deep-mid': '#142850', 'deep-lo': '#0a1630', 'bg-a': 'rgba(185, 214, 255, .7)', 'bg-b': 'rgba(255, 214, 180, .62)', 'bg-c': 'rgba(255, 236, 170, .5)', 'grid': 'rgba(47, 125, 225, .055)' },
      tones: { think: ['#deebff', '#3f8bec', '#1f5fb4'], build: ['#ffe4d0', '#ff8a3d', '#c4561a'], deep: ['#a3bde6', '#3f6db5', '#1c3a6e'], soft: ['#ffffff', '#d8e6fb', '#a3bde6'], spark: ['#fff2c8', '#ffc93d', '#c48a00'] },
      liquid: { think: ['#9cc4ff', '#1f66c8'], build: ['#ffbf8f', '#ea6a17'] }
    },
    ocean: {
      label: 'Tide: water, cities and travel',
      keywords: ['water', 'ocean', 'sea', 'river', 'travel', 'transport', 'traffic', 'city', 'urban', 'mobility', 'energy', 'commute', 'flood', 'tourism'],
      vars: { think: '#1690a8', 'think-ink': '#0d6a7e', 'think-soft': '#def4f8', 'think-rgb': '22, 144, 168', 'think-light': '#a9e6f2', build: '#ff7a59', 'build-soft': '#ffe6de', spark: '#ffd166', sea: '#1690a8', 'deep-2': '#2f6f8a', 'deep-hi': '#1f5168', 'deep-mid': '#0f3142', 'deep-lo': '#061a24', 'bg-a': 'rgba(169, 230, 242, .7)', 'bg-b': 'rgba(255, 205, 190, .6)', 'bg-c': 'rgba(200, 236, 228, .6)', 'grid': 'rgba(22, 144, 168, .055)' },
      tones: { think: ['#d6f2f8', '#1fa3bd', '#0d6a7e'], build: ['#ffe2d8', '#ff7a59', '#c44a2c'], deep: ['#97c3d4', '#2f6f8a', '#123c50'], soft: ['#ffffff', '#d6ecf2', '#97c3d4'], spark: ['#fff3d0', '#ffd166', '#c49422'] },
      liquid: { think: ['#8fdcec', '#0f8098'], build: ['#ffb39e', '#e85a36'] }
    }
  };

  const LIST = Object.keys(THEMES).map((id) => ({ id, label: THEMES[id].label }));

  /** The theme for a project: its own choice, else the best keyword match, else ProductLab. */
  function pick(project) {
    if (!project) return 'lab';
    if (project.theme && project.theme !== 'auto' && THEMES[project.theme]) return project.theme;
    const text = [project.domain, project.name, project.challenge, project.hmw].filter(Boolean).join(' ').toLowerCase();
    let best = 'lab'; let score = 0;
    Object.keys(THEMES).forEach((id) => {
      const s = THEMES[id].keywords.reduce((n, k) => n + (text.indexOf(k) >= 0 ? 1 : 0), 0);
      if (s > score) { best = id; score = s; }
    });
    return best;
  }

  let applied = null;
  function propsOf(id) {
    const t = THEMES[id]; const out = {};
    if (!t || !t.vars) return out;
    Object.keys(t.vars).forEach((k) => { out['--' + k] = t.vars[k]; });
    Object.keys(t.tones || {}).forEach((k) => t.tones[k].forEach((c, i) => { out['--tn-' + k + '-' + i] = c; }));
    Object.keys(t.liquid || {}).forEach((k) => t.liquid[k].forEach((c, i) => { out['--lq-' + k + '-' + i] = c; }));
    return out;
  }

  /** Re-tint the page for a project (Story), or restore the ProductLab colours (null). */
  function apply(project) {
    if (!root.document) return 'lab';
    const id = project ? pick(project) : 'lab';
    if (id === applied) return id;
    const el = root.document.documentElement;
    if (applied) Object.keys(propsOf(applied)).forEach((k) => el.style.removeProperty(k));
    const props = propsOf(id);
    Object.keys(props).forEach((k) => el.style.setProperty(k, props[k]));
    el.dataset.theme = id;
    applied = id;
    return id;
  }

  PL.theme = { THEMES, LIST, pick, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = PL.theme;
})(typeof globalThis !== 'undefined' ? globalThis : this);
