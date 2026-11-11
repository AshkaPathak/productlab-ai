/* ProductLab AI - UI utilities (browser only) */
(function (root) {
  'use strict';
  const PL = (root.PL = root.PL || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape any value for safe interpolation into HTML. */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]); }

  /** Tagged template that escapes interpolations unless wrapped with raw(). */
  function html(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => {
      out += s;
      if (i < vals.length) {
        const v = vals[i];
        if (v && v.__raw) out += v.value;
        else if (Array.isArray(v)) out += v.map((x) => (x && x.__raw ? x.value : esc(x))).join('');
        else out += esc(v);
      }
    });
    return raw(out);
  }
  function raw(value) { return { __raw: true, value: String(value == null ? '' : value), toString() { return this.value; } }; }
  const str = (h) => (h && h.__raw ? h.value : esc(h));

  const pct = (x, d) => (Number.isFinite(x) ? (x * 100).toFixed(d || 0) + '%' : '–');
  const fix = (x, d) => (Number.isFinite(x) ? Number(x).toFixed(d == null ? 2 : d) : '–');

  /** Next free id with a prefix, e.g. nextId(list, 'E') -> 'E30'. */
  function nextId(list, prefix) {
    let max = 0;
    (list || []).forEach((x) => {
      const m = new RegExp('^' + prefix + '(\\d+)$').exec(x.id || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return prefix + (max + 1);
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** Resolve "features.F2.reach": arrays are addressed by item id. */
  function walk(obj, path, create) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      let next;
      if (Array.isArray(cur)) next = cur.find((x) => x && String(x.id) === k) || (/^\d+$/.test(k) ? cur[Number(k)] : undefined);
      else next = cur[k];
      if (next == null && create) { next = {}; cur[k] = next; }
      if (next == null) return null;
      cur = next;
    }
    return { parent: cur, key: parts[parts.length - 1] };
  }
  function getPath(obj, path) {
    const w = walk(obj, path, false);
    if (!w) return undefined;
    if (Array.isArray(w.parent)) return w.parent.find((x) => x && String(x.id) === w.key) || (/^\d+$/.test(w.key) ? w.parent[Number(w.key)] : undefined);
    return w.parent[w.key];
  }
  function setPath(obj, path, value) {
    const w = walk(obj, path, true);
    if (!w) return false;
    w.parent[w.key] = value;
    return true;
  }

  function parseIds(text) {
    return String(text || '').toUpperCase().split(/[^A-Z0-9]+/).filter((x) => /^[A-Z]{1,3}\d+$/.test(x));
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  function slug(s) { return String(s || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project'; }

  /** Minimal, safe Markdown renderer for the report preview (escapes first). */
  function markdown(md) {
    const lines = String(md || '').split('\n');
    const out = [];
    let i = 0;
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    while (i < lines.length) {
      const l = lines[i];
      if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push('<h' + n + '>' + inline(l.slice(n + 1)) + '</h' + n + '>'); i++; continue; }
      if (/^\|/.test(l)) {
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
        const body = rows.filter((r) => !/^\|[\s|:-]+\|$/.test(r));
        out.push('<div class="table-wrap"><table class="md"><thead><tr>' + cells(body[0]).map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
          body.slice(1).map((r) => '<tr>' + cells(r).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (/^- /.test(l)) {
        const items = [];
        while (i < lines.length && /^- /.test(lines[i])) { items.push('<li>' + inline(lines[i].slice(2)) + '</li>'); i++; }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      if (/^> /.test(l)) { out.push('<blockquote>' + inline(l.slice(2)) + '</blockquote>'); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#|\||- |> )/.test(lines[i])) { para.push(inline(lines[i].replace(/\s{2}$/, ''))); i++; }
      out.push('<p>' + para.join('<br>') + '</p>');
    }
    return out.join('\n');
  }

  /* ---------- toasts and modals ---------- */

  function toast(msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /**
   * Form modal. fields: [{name, label, type:'text'|'textarea'|'number'|'select'|'checkbox', options, value, help, required}]
   * Resolves with values or null on cancel. With options.alt = {label, value},
   * a second button resolves with that value (Escape still resolves null).
   */
  function formModal(title, fields, options) {
    const o = Object.assign({ submit: 'Save', intro: '' }, options || {});
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      const field = (f) => {
        const id = 'mf-' + f.name;
        const help = f.help ? '<small class="help">' + esc(f.help) + '</small>' : '';
        let input;
        if (f.type === 'textarea') input = '<textarea id="' + id + '" name="' + esc(f.name) + '" rows="' + (f.rows || 3) + '"' + (f.required ? ' required' : '') + '>' + esc(f.value) + '</textarea>';
        else if (f.type === 'select') input = '<select id="' + id + '" name="' + esc(f.name) + '">' + f.options.map((op) => { const v = typeof op === 'object' ? op.value : op; const lab = typeof op === 'object' ? op.label : op; return '<option value="' + esc(v) + '"' + (String(v) === String(f.value) ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>';
        else if (f.type === 'checkbox') return '<label class="check"><input type="checkbox" name="' + esc(f.name) + '"' + (f.value ? ' checked' : '') + '> ' + esc(f.label) + '</label>' + help;
        else input = '<input id="' + id + '" name="' + esc(f.name) + '" type="' + (f.type || 'text') + '" value="' + esc(f.value) + '"' + (f.step ? ' step="' + f.step + '"' : '') + (f.required ? ' required' : '') + '>';
        return '<label for="' + id + '">' + esc(f.label) + '</label>' + input + help;
      };
      wrap.innerHTML = '<form class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
        (o.intro ? '<p class="muted">' + esc(o.intro) + '</p>' : '') +
        '<div class="form-grid">' + fields.map(field).join('') + '</div>' +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button>' + (o.alt ? '<button type="button" class="btn" data-alt>' + esc(o.alt.label) + '</button>' : '') + '<button type="submit" class="btn primary">' + esc(o.submit) + '</button></div></form>';
      document.body.appendChild(wrap);
      const form = wrap.querySelector('form');
      const first = form.querySelector('input,textarea,select');
      if (first) first.focus();
      const close = (val) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
      form.querySelector('[data-cancel]').addEventListener('click', () => close(null));
      if (o.alt) form.querySelector('[data-alt]').addEventListener('click', () => close(o.alt.value));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const vals = {};
        fields.forEach((f) => {
          const el = form.elements[f.name];
          if (!el) return;
          if (f.type === 'checkbox') vals[f.name] = el.checked;
          else if (f.type === 'number') vals[f.name] = el.value === '' ? '' : Number(el.value);
          else vals[f.name] = el.value.trim();
        });
        close(vals);
      });
    });
  }

  function confirmModal(message, okLabel) {
    return formModal('Please confirm', [], { intro: message, submit: okLabel || 'Confirm' }).then((v) => !!v);
  }

  PL.ui = { esc, html, raw, str, pct, fix, nextId, clone, getPath, setPath, parseIds, download, readFile, slug, markdown, toast, formModal, confirmModal };
})(typeof globalThis !== 'undefined' ? globalThis : this);
