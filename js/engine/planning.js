/*
 * ProductLab AI - build planning
 * Evidence-adjusted RICE prioritisation, MoSCoW suggestion, effort roll-up,
 * dependency-aware sprint scheduling (MVP roadmap) and a transparent
 * rule-based technology stack recommender.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./evidence.js'));
  else (root.PL = root.PL || {}).planning = factory(root.PL.evidence);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';

  /* ---------------- Prioritisation ---------------- */

  /**
   * RICE = Reach x Impact x Confidence / Effort  (Intercom's framework).
   * reach: % of target users affected per quarter (0-100)
   * impact: 0.25 minimal, 0.5 low, 1 medium, 2 high, 3 massive
   * confidence: 0-100 (%)
   * effort: person-weeks
   * Evidence adjustment: confidence is scaled by (0.5 + 0.5 x evidenceScore),
   * so a feature nobody can back with evidence loses up to half its confidence.
   */
  function rice(feature, evidenceScore) {
    const reach = Math.max(0, Number(feature.reach) || 0);
    const impact = Math.max(0, Number(feature.impact) || 0);
    const conf = Math.max(0, Math.min(100, Number(feature.confidence) || 0)) / 100;
    const effort = Math.max(0.1, Number(feature.effort) || 0.1);
    const raw = (reach * impact * conf) / effort;
    const ev = typeof evidenceScore === 'number' ? evidenceScore : null;
    const adjusted = ev == null ? raw : (reach * impact * conf * (0.5 + 0.5 * ev)) / effort;
    return { raw, adjusted, evidence: ev };
  }

  function prioritize(project, index) {
    const idx = index || E.buildIndex(project);
    const rows = (project.features || []).map((f) => {
      const ev = E.featureEvidenceScore(idx, f);
      return Object.assign({ feature: f }, rice(f, ev));
    });
    rows.sort((a, b) => b.adjusted - a.adjusted || String(a.feature.id).localeCompare(String(b.feature.id)));
    const n = rows.length;
    rows.forEach((r, i) => {
      r.rank = i + 1;
      const q = n ? i / n : 0;
      r.suggestedMoscow = q < 0.4 ? 'Must' : q < 0.7 ? 'Should' : q < 0.9 ? 'Could' : "Won't";
    });
    return rows;
  }

  /* ---------------- Effort and schedule ---------------- */

  /** PERT expected effort when optimistic/pessimistic estimates exist. */
  function expectedEffort(f) {
    const m = Number(f.effort) || 0;
    if (Number.isFinite(Number(f.effortMin)) && Number.isFinite(Number(f.effortMax)) && f.effortMin !== '' && f.effortMax !== '') {
      return (Number(f.effortMin) + 4 * m + Number(f.effortMax)) / 6;
    }
    return m;
  }

  const MOSCOW_ORDER = { Must: 0, Should: 1, Could: 2, "Won't": 3 };

  /** Topological order respecting dependsOn, tie-broken by MoSCoW then priority order. */
  function topoOrder(features, priority) {
    const byId = new Map(features.map((f) => [f.id, f]));
    const pos = new Map(priority.map((id, i) => [id, i]));
    const indeg = new Map(features.map((f) => [f.id, 0]));
    features.forEach((f) => (f.dependsOn || []).forEach((d) => { if (byId.has(d)) indeg.set(f.id, indeg.get(f.id) + 1); }));
    const key = (f) => [MOSCOW_ORDER[f.moscow] != null ? MOSCOW_ORDER[f.moscow] : 2, pos.has(f.id) ? pos.get(f.id) : 999];
    const cmp = (a, b) => { const ka = key(a); const kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1]; };
    const ready = features.filter((f) => indeg.get(f.id) === 0).sort(cmp);
    const out = [];
    while (ready.length) {
      const f = ready.shift();
      out.push(f);
      features.forEach((g) => {
        if ((g.dependsOn || []).includes(f.id)) {
          indeg.set(g.id, indeg.get(g.id) - 1);
          if (indeg.get(g.id) === 0) { ready.push(g); ready.sort(cmp); }
        }
      });
    }
    const cyclic = features.filter((f) => !out.includes(f)).map((f) => f.id);
    return { order: out, cyclic };
  }

  /**
   * Sprint plan. Capacity per sprint = teamSize x sprintWeeks x focus (person-weeks).
   * Features are list-scheduled in dependency order; a feature never starts
   * before all of its dependencies have finished. "Won't" features are skipped.
   */
  function schedule(project, options) {
    const o = Object.assign({ teamSize: 3, sprintWeeks: 2, focus: 0.7, buffer: 0.2, priority: null }, project.plan || {}, options || {});
    const features = (project.features || []).filter((f) => f.moscow !== "Won't");
    const priority = o.priority || features.map((f) => f.id);
    const { order, cyclic } = topoOrder(features, priority);
    const weekly = o.teamSize * o.focus;
    const finish = new Map();
    let cursor = 0; // week at which the team is next free (team treated as one pooled resource)
    const tasks = order.map((f) => {
      const effort = expectedEffort(f) * (1 + o.buffer);
      const depsDone = Math.max(0, ...(f.dependsOn || []).map((d) => finish.get(d) || 0));
      const start = Math.max(cursor, depsDone);
      const duration = effort / weekly;
      const end = start + duration;
      finish.set(f.id, end);
      cursor = end;
      return { id: f.id, name: f.name, moscow: f.moscow || 'Could', effort, start, end, sprintStart: Math.floor(start / o.sprintWeeks) + 1, sprintEnd: Math.max(1, Math.ceil(end / o.sprintWeeks)) };
    });
    const phase = (m) => tasks.filter((t) => t.moscow === m);
    const end = (ts) => (ts.length ? Math.max(...ts.map((t) => t.end)) : 0);
    const phases = [
      { name: 'MVP (Must)', tasks: phase('Must') },
      { name: 'Release 2 (Should)', tasks: phase('Should') },
      { name: 'Later (Could)', tasks: phase('Could') }
    ].map((p) => Object.assign(p, { weeks: end(p.tasks), effort: p.tasks.reduce((s, t) => s + t.effort, 0) }));
    return {
      settings: o,
      tasks,
      phases,
      cyclic,
      totalWeeks: end(tasks),
      totalEffort: tasks.reduce((s, t) => s + t.effort, 0),
      mvpWeeks: end(phase('Must'))
    };
  }

  /* ---------------- Ways to build it ---------------- */

  /**
   * Not every idea needs accounts, a database and a server. This works out what
   * the idea actually needs, then scores ten ways of building it, from a
   * plain web page to a connected device, and returns the ones that fit,
   * simplest first when two fit equally well. Every reason is traceable to a
   * constraint, so the choice can be defended in a design review.
   *
   * constraints: {kind: 'website'|'webapp'|'mobile'|'service'|'hardware'|'chat',
   *   accounts, sharedData, payments, hardware, messaging, platform, offline,
   *   sensitiveData, ai: 'none'|'rules'|'ml'|'llm', wearables, realtime,
   *   budget: 'low'|'medium'|'high', skills: [...], expectedUsers, region, stack}
   */
  const KINDS = { website: 'An information website', webapp: 'A tool that runs in the browser', mobile: 'A mobile app', service: 'A platform with shared data', hardware: 'A physical device with software', chat: 'A WhatsApp or SMS service' };

  function normalizeConstraints(c) {
    const k = Object.assign({ offline: false, sensitiveData: false, ai: 'rules', wearables: false, realtime: false, budget: 'low', skills: ['javascript'], expectedUsers: 1000, region: 'India' }, c || {});
    // projects made before these fields existed: infer them from the older ones
    if (!KINDS[k.kind]) k.kind = k.platform === 'web' ? 'webapp' : 'mobile';
    if (!k.platform) k.platform = k.kind === 'mobile' ? 'mobile' : 'web';
    if (typeof k.accounts !== 'boolean') k.accounts = !!k.sensitiveData;
    if (typeof k.sharedData !== 'boolean') k.sharedData = !!k.realtime || k.accounts;
    ['payments', 'hardware', 'messaging'].forEach((f) => { k[f] = !!k[f]; });
    if (k.kind === 'hardware') k.hardware = true;
    if (k.kind === 'chat') k.messaging = true;
    k.skills = Array.isArray(k.skills) ? k.skills : String(k.skills || '').split(/\s*,\s*/).filter(Boolean);
    return k;
  }

  /** Plain statements of what the idea needs, shown before the options. */
  function needsOf(c) {
    const k = normalizeConstraints(c);
    const out = [KINDS[k.kind]];
    out.push(k.accounts ? 'People sign in to keep their own data' : 'No sign-in needed');
    out.push(k.sharedData ? 'Data is shared between people or devices' : 'Each person’s data can stay on their device');
    if (k.ai === 'llm') out.push('Uses generative AI, so its key must stay on a server');
    if (k.ai === 'ml') out.push('Uses a trained model');
    if (k.offline) out.push('Must work offline');
    if (k.hardware) out.push('Needs sensors or a device');
    if (k.messaging) out.push('Reaches people on WhatsApp or SMS');
    if (k.payments) out.push('Takes payments');
    if (k.sensitiveData) out.push('Handles sensitive personal data');
    return out;
  }

  function aiLayer(k, where) {
    if (k.ai === 'llm') return { layer: 'Intelligence', choice: where === 'server' ? 'Language model called from the server (key kept secret), answers checked against your sources' : 'Language model through a small serverless function that keeps the key secret', why: ['Generative features were requested', 'An API key in a web page can be copied by anyone, so it must sit on a server'], alternatives: ['Open model on your own server for privacy'] };
    if (k.ai === 'ml') return { layer: 'Intelligence', choice: where === 'device' ? 'Small model running on the device (TensorFlow.js or ONNX Runtime)' : 'scikit-learn or XGBoost model behind an API', why: ['A trained model was requested', where === 'device' ? 'Runs without a server and keeps data on the device' : 'Python has the best tools for training and serving models'], alternatives: ['Rules first, model later'] };
    if (k.ai === 'rules') return { layer: 'Intelligence', choice: 'Plain rules and simple statistics in code', why: ['Easy to explain and test', 'Needs no training data for a first version'], alternatives: [] };
    return null;
  }
  function privacyLayers(k) {
    if (!k.sensitiveData) return [];
    return [{ layer: 'Privacy & security', choice: 'Consent screen, encryption in transit and at rest, collect only what is needed, let people export and delete their data', why: ['Sensitive personal data is processed'].concat(/india/i.test(k.region || '') ? ['India: DPDP Act 2023 and DPDP Rules 2025 require itemised notice and consent'] : []), alternatives: ['Keep the data only on the device'] }];
  }
  const L = (layer, choice, why, alternatives) => ({ layer, choice, why: why || [], alternatives: alternatives || [] });
  const has = (k, s) => k.skills.some((x) => String(x).toLowerCase() === s);

  const WAYS = [
    {
      id: 'static', name: 'A simple website', tagline: 'HTML pages, no server, no database, no logins', complexity: 1, cost: 'Free to host',
      languages: ['HTML', 'CSS', 'JavaScript'],
      fit(k) {
        if (k.accounts || k.sharedData || k.hardware || k.messaging || k.ai === 'llm' || k.ai === 'ml' || ['mobile', 'service', 'hardware', 'chat'].includes(k.kind)) return null;
        const why = ['No sign-in and no shared data, so nothing needs a server'];
        if (k.kind === 'website') why.unshift('The idea is mainly information people read');
        return { score: k.kind === 'website' ? 10 : 4, why, watch: ['Anything people type stays in their browser unless you add a form service', 'Hard to grow into an app with accounts later'] };
      },
      stack: (k) => [L('Pages', 'HTML and CSS, or Astro / Eleventy if there are many pages', ['Plain files any browser opens']), L('Interactivity', 'A little JavaScript (calculators, filters, maps)', ['Only where the page must react to input']), L('Forms', 'Google Forms, Tally or Formspree', ['Collect sign-ups or feedback without a server'], ['Netlify Forms']), L('Hosting', 'GitHub Pages or Netlify (free)', ['Free, fast and needs no maintenance'])],
      steps: ['Sketch the pages on paper, then write them in HTML and CSS', 'Add a form service for anything people send you', 'Publish on GitHub Pages and share the link', 'Add privacy-friendly analytics (GoatCounter or Plausible) to see what people use']
    },
    {
      id: 'browser', name: 'An app that runs in the browser', tagline: 'Works on any phone or laptop, data saved on the device, can work offline', complexity: 2, cost: 'Free to host',
      languages: ['JavaScript or TypeScript', 'HTML', 'CSS'],
      fit(k) {
        if (k.accounts || k.sharedData || k.hardware || k.messaging || k.ai === 'llm' || ['service', 'hardware', 'chat'].includes(k.kind)) return null;
        const why = ['No sign-in and no shared data, so each person’s data can stay on their own device'];
        if (k.offline) why.push('A progressive web app keeps working offline');
        if (k.kind === 'mobile') why.push('Installs from the browser like an app, without an app store');
        return { score: k.kind === 'webapp' ? 9 : k.kind === 'mobile' ? 6 : 6, why, watch: ['Data lives in one browser: offer export and import so people do not lose it', 'No push notifications on older iPhones'] };
      },
      stack: (k) => [L('App', has(k, 'typescript') || has(k, 'javascript') ? 'React or Svelte with Vite, or plain JavaScript for small tools' : 'Plain JavaScript, or Svelte with Vite', ['Runs entirely in the browser']), L('Storage', 'localStorage or IndexedDB on the device, with file export', ['No database server to run or pay for']), L('Offline and install', 'Progressive web app (service worker and manifest)', ['Works without signal and installs to the home screen']), L('Hosting', 'GitHub Pages, Netlify or Vercel (free)', ['Static files only'])].concat([aiLayer(k, 'device')].filter(Boolean)),
      steps: ['Build the core screen first with sample data', 'Save to the device with localStorage or IndexedDB', 'Add export and import so data can move between devices', 'Turn it into a progressive web app so it works offline and installs', 'Host it free and test with five real users']
    },
    {
      id: 'nocode', name: 'A no-code prototype to test demand', tagline: 'Spreadsheet plus an app builder, ready in days', complexity: 1, cost: 'Free plans to start',
      languages: ['None (spreadsheet formulas)'],
      fit(k) {
        if (k.hardware || k.kind === 'hardware') return null;
        const coder = ['javascript', 'typescript', 'python', 'dart', 'java'].some((x) => has(k, x));
        return { score: (k.budget === 'low' ? 4 : 2) + (coder ? 0 : 4), why: ['Tests whether people want it before anyone writes code'].concat(coder ? [] : ['The team does not list programming skills']), watch: ['Hard to customise and you depend on the vendor', 'Free plans limit users and rows'] };
      },
      stack: (k) => [L('Data', 'Google Sheets or Airtable', ['Easy for the whole team to edit']), L('App', 'Glide, AppSheet or Softr on top of the sheet', ['Gives a phone-friendly app with no code']), L('Forms and automation', 'Google Forms, Zapier or Make', ['Connect steps without a server'])],
      steps: ['Put your data in a Google Sheet', 'Generate an app from it with Glide or AppSheet', 'Share it with 10 to 20 target users', 'Keep what they use, and only then build it properly']
    },
    {
      id: 'serverless', name: 'A web app with a small backend, no logins', tagline: 'Front end plus a few serverless functions and simple storage', complexity: 3, cost: 'Free tier covers a pilot',
      languages: ['JavaScript or TypeScript', 'SQL (light)'],
      fit(k) {
        if (k.hardware && !k.messaging || k.kind === 'hardware') return null;
        if (k.accounts && k.sensitiveData) return null;
        const why = []; let score = 3;
        if (k.sharedData && !k.accounts) { why.push('Data is shared between people, but nobody needs an account'); score = 9; }
        if (k.ai === 'llm') { why.push('A serverless function keeps the AI key secret'); score = Math.max(score, 8); }
        if (k.payments) { why.push('Payments can use hosted payment links (e.g. Razorpay) with a webhook'); score += 1; }
        if (k.kind === 'webapp' || k.kind === 'service') score += 1;
        if (!why.length) why.push('Room to add shared features later without running a server');
        return { score, why, watch: ['Without accounts anyone can post, so add rate limits and moderation', 'Keep each function small; it is not a full server'] };
      },
      stack: (k) => [L('App', 'React or Svelte with Vite, or plain JavaScript', ['Fast to build and host']), L('Backend', 'Serverless functions: Cloudflare Workers, Vercel or Netlify Functions', ['Runs only when called, so it costs nothing when idle', 'Holds secrets such as API keys']), L('Storage', 'Cloudflare D1 (SQLite) or KV, or a Google Sheet through its API', ['Simple storage without managing a database server'], ['Supabase without auth']), L('Hosting', 'Cloudflare Pages or Vercel', ['Front end and functions deploy together'])].concat([aiLayer(k, 'server')].filter(Boolean)),
      steps: ['Build the front end against a fake data file', 'Write one serverless function per action (save, list, ask the AI)', 'Store data in D1 or KV and add a per-visitor rate limit', 'Deploy front end and functions together and test from a phone']
    },
    {
      id: 'accounts', name: 'A full web app with accounts', tagline: 'Sign-in, a database and per-user data', complexity: 4, cost: 'Free tier, then about ₹2,000 a month',
      languages: ['TypeScript', 'SQL'],
      fit(k) {
        if (!(k.accounts || k.sensitiveData)) return null;
        const why = [];
        if (k.accounts) why.push('People must sign in to keep their own data');
        if (k.sensitiveData) why.push('Row-level security keeps each person to their own records');
        if (k.sharedData) why.push('A shared database syncs data across people and devices');
        if (k.realtime) why.push('Realtime channels push updates instantly');
        return { score: 8 + (k.sensitiveData ? 1 : 0) + (k.realtime ? 1 : 0) - (k.expectedUsers > 50000 ? 2 : 0), why, watch: ['More to secure: test the access rules carefully', 'Sign-in adds a step that some users drop out at'] };
      },
      stack: (k) => [L('App', k.kind === 'mobile' ? 'React Native (Expo) app plus a Next.js web view' : 'Next.js or React with Vite', ['Large ecosystem and easy hosting']), L('Backend', 'Supabase (PostgreSQL, sign-in, file storage) or Firebase', ['Managed: no servers to run for a small team'], ['Appwrite (self-hosted)']), L('Database', 'PostgreSQL with row-level security', ['Relational data you can export'])].concat(k.realtime ? [L('Realtime', 'Supabase Realtime channels', ['Realtime updates were required'])] : []).concat([aiLayer(k, 'server')].filter(Boolean)).concat(privacyLayers(k)),
      steps: ['Design the tables and who may read each one', 'Set up Supabase sign-in (email link or phone OTP)', 'Build screens against the database with row-level security on', 'Add backups and an export or delete option before real users join']
    },
    {
      id: 'mobile', name: 'A mobile app', tagline: 'Installed app with camera, location, notifications and offline use', complexity: 3, cost: 'Free to build; ₹2,000 one-time for the Play Store',
      languages: k0 => [],
      fit(k) {
        if (!(k.kind === 'mobile' || k.platform === 'both' || k.wearables || k.kind === 'webapp' && k.offline && k.platform === 'mobile')) return null;
        const why = [];
        if (k.kind === 'mobile') why.push('The idea is used on the go, on a phone');
        if (k.offline) why.push('On-device SQLite keeps it working without signal');
        if (k.wearables) why.push('Health Connect and HealthKit need a native app');
        if (!why.length) why.push('A phone app was requested');
        return { score: (k.kind === 'mobile' ? 8 : 5) + (k.wearables ? 2 : 0) + (k.offline ? 1 : 0), why, watch: ['App store review and updates take time', k.sharedData || k.accounts ? 'Still needs a backend for shared data' : 'Without a backend, data stays on one phone'] };
      },
      stack: (k) => [L('App', has(k, 'dart') ? 'Flutter' : 'React Native with Expo', [has(k, 'dart') ? 'The team knows Dart' : 'One JavaScript codebase for Android and iOS'], ['Flutter', 'Kotlin / Swift']), L('On-device storage', 'SQLite (expo-sqlite)', ['Works offline'])].concat(k.wearables ? [L('Integrations', 'Android Health Connect and Apple HealthKit', ['Wearable data was required'])] : []).concat(k.sharedData || k.accounts ? [L('Backend', k.accounts ? 'Supabase (sign-in and database)' : 'Serverless functions with simple storage', ['Shared data needs a server'])] : []).concat([aiLayer(k, k.ai === 'llm' ? 'server' : 'device')].filter(Boolean)).concat(privacyLayers(k)),
      steps: ['Prototype the main screen in Expo and test on your own phone', 'Store data on the device with SQLite', 'Add notifications or camera only if the evidence asks for them', 'Release to a small group with Expo internal builds before the store']
    },
    {
      id: 'chat', name: 'A WhatsApp or SMS service', tagline: 'Nothing to install: people message a number', complexity: 3, cost: 'Free tier, then per message',
      languages: ['JavaScript or Python'],
      fit(k) {
        if (!(k.messaging || k.kind === 'chat')) return null;
        return { score: 9 + (/india/i.test(k.region || '') ? 1 : 0), why: ['People are reached on WhatsApp or SMS, which they already use'].concat(/india/i.test(k.region || '') ? ['WhatsApp is the most used messaging app in India'] : []), watch: ['WhatsApp Business needs a verified business account', 'Templates must be approved before sending first messages'] };
      },
      stack: (k) => [L('Channel', 'WhatsApp Business Cloud API, or a Telegram bot for the prototype', ['No app to install']), L('Backend', 'A webhook on Cloudflare Workers or a small FastAPI app', ['Receives and answers each message']), L('Storage', 'Google Sheets or SQLite', ['Enough for a pilot']), L('SMS fallback', 'MSG91 or Twilio', ['Reaches basic phones'])].concat([aiLayer(k, 'server')].filter(Boolean)),
      steps: ['Script the conversation as a flowchart first', 'Build it as a Telegram bot to test in a day', 'Move to the WhatsApp Business Cloud API once the flow works', 'Log every conversation (with consent) to learn what people ask']
    },
    {
      id: 'hardware', name: 'A connected device', tagline: 'Sensors and a microcontroller, with a dashboard and alerts', complexity: 4, cost: 'About ₹1,500–5,000 per prototype',
      languages: ['C++ (Arduino) or MicroPython', 'JavaScript for the dashboard'],
      fit(k) {
        if (!(k.hardware || k.kind === 'hardware')) return null;
        return { score: 10, why: ['The idea needs sensors or a physical device'], watch: ['Plan for power cuts, heat and damp', 'Hardware takes longer to change than software'] };
      },
      stack: (k) => [L('Device', 'ESP32 microcontroller with the needed sensors', ['Cheap, Wi-Fi built in, large community']), L('Firmware', 'Arduino (C++) or MicroPython', ['Well documented for students']), L('Messaging', 'MQTT (e.g. HiveMQ free tier) or simple HTTP', ['Sends readings over weak connections']), L('Dashboard and alerts', 'A simple web page or ThingsBoard, with SMS or WhatsApp alerts', ['People see readings and get warned'])].concat([aiLayer(k, 'server')].filter(Boolean)),
      steps: ['Prove one sensor reading on a breadboard', 'Send readings to a free MQTT broker', 'Show them on a simple web dashboard', 'Add alerts, then test in the real setting for a week']
    },
    {
      id: 'kit', name: 'Ready-made sensors with their own app', tagline: 'Buy, set up and test before building any hardware', complexity: 1, cost: 'About \u20b91,000\u20133,000 per sensor',
      languages: ['None to start; Python or JavaScript to read their data'],
      fit(k) {
        if (!(k.hardware || k.kind === 'hardware')) return null;
        return { score: k.budget === 'low' ? 8 : 6, why: ['Proves the idea in the real setting before you design a device', 'Many Wi-Fi sensors (temperature, humidity, power) send alerts to a phone app out of the box'], watch: ['Less control over data and features', 'Vendor apps may not export data easily'] };
      },
      stack: (k) => [L('Device', 'Off-the-shelf Wi-Fi sensors (for example Tuya or Sonoff temperature and humidity sensors)', ['Working hardware on day one']), L('App and alerts', 'The vendor\u2019s phone app, or Home Assistant on a spare computer', ['Readings and alerts with no code']), L('Your data', 'Export to Google Sheets, or read it with a small Python script', ['Lets you analyse a week of readings'])],
      steps: ['Pick one sensor that measures what the evidence says matters', 'Install it in one real location for a week', 'Check whether alerts actually change what people do', 'Only then design your own device']
    },
    {
      id: 'scale', name: 'A custom backend built to scale', tagline: 'Your own API and database in containers', complexity: 5, cost: 'About ₹5,000 a month and up',
      languages: k0 => [],
      fit(k) {
        if (!(k.expectedUsers > 50000 || k.budget === 'high' || k.kind === 'service' && k.accounts)) return null;
        return { score: (k.expectedUsers > 200000 ? 9 : k.expectedUsers > 50000 ? 7 : 5), why: [k.expectedUsers > 50000 ? 'Expected to grow beyond 50,000 users' : 'Budget allows a custom backend', 'Full control over performance and data'], watch: ['Someone must run, update and monitor the servers', 'Much slower to build than managed options'] };
      },
      stack: (k) => [L('Backend', has(k, 'python') ? 'FastAPI (Python) in containers' : 'Node.js with NestJS in containers', [has(k, 'python') ? 'The team knows Python' : 'Same language as the front end']), L('Database', 'PostgreSQL (managed)', ['Strong consistency, mature backups']), L('Hosting', 'Render, Railway or AWS (Mumbai region)', ['Scales by adding containers'])].concat([aiLayer(k, 'server')].filter(Boolean)).concat(privacyLayers(k)),
      steps: ['Start on a managed option and move here only when numbers demand it', 'Write the API with tests from day one', 'Containerise and deploy with CI', 'Add monitoring and backups before launch']
    }
  ];

  function languagesOf(way, stack, k) {
    if (Array.isArray(way.languages)) return way.languages;
    const langs = [];
    const want = (l) => { if (!langs.includes(l)) langs.push(l); };
    stack.forEach((r) => {
      const c = r.choice;
      if (/React|NestJS|Node|Next|Expo|TensorFlow\.js|ONNX|Workers|JavaScript/.test(c)) want('TypeScript or JavaScript');
      if (/Flutter/.test(c)) want('Dart');
      if (/FastAPI|scikit|Python/.test(c)) want('Python');
      if (/Supabase|PostgreSQL|SQLite|D1/.test(c)) want('SQL');
    });
    return langs.length ? langs : ['TypeScript or JavaScript'];
  }

  /**
   * Ways to build the idea that fit its constraints, best first. When two fit
   * equally well, the simpler one comes first. The team's own choice
   * (constraints.stack) is kept and marked.
   */
  function buildOptions(c) {
    const k = normalizeConstraints(c);
    let list = WAYS.map((w) => {
      const f = w.fit(k);
      if (!f) return null;
      const stack = w.stack(k);
      const languages = languagesOf(w, stack, k);
      return { id: w.id, name: w.name, tagline: w.tagline, complexity: w.complexity, cost: w.cost, score: f.score, why: f.why, watch: f.watch, languages,
        stack: [L('Languages', languages.join(', '), ['Follows from the choices below'])].concat(stack), steps: w.steps };
    }).filter(Boolean);
    list.sort((a, b) => b.score - a.score || a.complexity - b.complexity);
    if (!list.length) {
      const w = WAYS.find((x) => x.id === 'serverless');
      const stack = w.stack(k);
      list = [{ id: w.id, name: w.name, tagline: w.tagline, complexity: w.complexity, cost: w.cost, score: 1, why: ['A flexible starting point'], watch: [], languages: languagesOf(w, stack, k), stack: [L('Languages', languagesOf(w, stack, k).join(', '), [])].concat(stack), steps: w.steps }];
    }
    const top = list.slice(0, 3);
    const chosenId = k.stack && list.some((x) => x.id === k.stack) ? k.stack : top[0].id;
    if (!top.some((x) => x.id === chosenId)) top.push(list.find((x) => x.id === chosenId));
    top.forEach((x) => { x.recommended = x.id === top[0].id; x.chosen = x.id === chosenId; });
    return { kind: k.kind, needs: needsOf(k), options: top, chosen: top.find((x) => x.chosen) };
  }

  /** The stack (one row per layer) of the chosen way to build it. */
  function recommendStack(c) { return buildOptions(c).chosen.stack; }

  return { WAYS_COUNT: WAYS.length, rice, prioritize, expectedEffort, topoOrder, schedule, recommendStack, buildOptions, needsOf, normalizeConstraints, KINDS, MOSCOW_ORDER };
});
