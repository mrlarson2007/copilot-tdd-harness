// Shared helpers for the eval report prototypes.
// Reads window.EVAL_REPORT (see site/data/eval-report.js) and exposes
// aggregation + small DOM helpers on window.Report.
(function () {
  'use strict';

  const data = window.EVAL_REPORT;
  if (!data) {
    throw new Error('window.EVAL_REPORT is missing. Load data/eval-report.js first.');
  }

  const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));
  const index = {
    models: byId(data.models),
    metrics: byId(data.metrics),
    scenarios: byId(data.scenarios),
    conditions: byId(data.conditions),
    failureModes: byId(data.failureModes),
  };

  // Pass rate (0..1) for a filter, pooled across matching runs. Returns null
  // when no run in the filter measured that metric.
  function passRate({ model, condition, metric, scenario } = {}) {
    let passes = 0;
    let trials = 0;
    for (const run of data.runs) {
      if (model && run.model !== model) continue;
      if (condition && run.condition !== condition) continue;
      if (scenario && run.scenario !== scenario) continue;
      const metricIds = metric ? [metric] : Object.keys(run.passes);
      for (const id of metricIds) {
        if (!(id in run.passes)) continue;
        passes += run.passes[id];
        trials += run.trials;
      }
    }
    return trials === 0 ? null : passes / trials;
  }

  // Overall TDD score: unweighted mean of per-metric pass rates.
  function overallScore(filter = {}) {
    const rates = data.metrics
      .map((m) => passRate({ ...filter, metric: m.id }))
      .filter((r) => r !== null);
    return rates.length === 0 ? null : rates.reduce((a, b) => a + b, 0) / rates.length;
  }

  function failureCounts({ model, condition } = {}) {
    const counts = Object.fromEntries(data.failureModes.map((f) => [f.id, 0]));
    let trials = 0;
    for (const run of data.runs) {
      if (model && run.model !== model) continue;
      if (condition && run.condition !== condition) continue;
      trials += run.trials;
      for (const [id, n] of Object.entries(run.failureModes || {})) {
        counts[id] = (counts[id] || 0) + n;
      }
    }
    return { counts, trials };
  }

  function median(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const pct = (r) => (r === null ? '—' : `${Math.round(r * 100)}%`);
  const pts = (d) => (d === null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)} pts`);

  // Tiny element builder that only ever sets text, never HTML.
  function h(tag, attrs = {}, ...children) {
    const isSvg = ['svg', 'g', 'rect', 'line', 'text', 'circle', 'title', 'path'].includes(tag);
    const el = isSvg
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || (value === false && !key.startsWith('aria-'))) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2), value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else {
        el.setAttribute(key, String(value));
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function sampleBanner() {
    if (!data.isSample) return null;
    return h('div', { class: 'sample-banner', role: 'note' },
      h('strong', {}, 'Sample data. '),
      data.sampleNotice || 'These numbers are illustrative.');
  }

  function protoNav(current) {
    const links = [
      ['../index.html', 'All prototypes'],
      ['../prototype-a-scorecard/index.html', 'A · Scorecard'],
      ['../prototype-b-dashboard/index.html', 'B · Dashboard'],
      ['../prototype-c-story/index.html', 'C · Story'],
    ];
    return h('nav', { class: 'proto-nav', 'aria-label': 'Report prototypes' },
      links.map(([href, label]) =>
        h('a', { href, 'aria-current': label.startsWith(`${current} ·`) ? 'page' : null }, label)));
  }

  function methodology() {
    return h('details', { class: 'methodology' },
      h('summary', {}, 'How these numbers are produced'),
      h('p', {},
        `Each model × condition × scenario cell has at least ${data.trialsPerCell} run(s) of the same prompt against a disposable fixture repository. `,
        'Runs are scored with the promptfoo assertions in evals/promptfoo/assertions by inspecting git history and a final test run. ',
        'The "No skills" condition uses the same model and prompt without the TDD agent or skills installed.'),
      h('ul', {}, data.metrics.map((m) =>
        h('li', {}, h('strong', {}, m.label), ` — ${m.description} `, h('code', {}, m.source)))),
      h('p', { class: 'muted' },
        `Schema ${data.schemaVersion} · harness ${data.harnessVersion} · generated ${data.generatedAt.slice(0, 10)}`));
  }

  window.Report = {
    data, index, passRate, overallScore, failureCounts, median, pct, pts, h,
    sampleBanner, protoNav, methodology,
  };
})();
