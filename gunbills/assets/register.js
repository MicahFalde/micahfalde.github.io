/* ==========================================================================
   The Firearms Register — rendering and filtering.

   AIDEV-NOTE: Content is never gated on an animation or a reveal. The "not
   compiled yet" block in the markup is VISIBLE by default and is only hidden
   once real entries have been written. If this script never runs, or the fetch
   fails, the visitor still reads a complete, honest page.

   AIDEV-NOTE: SECURITY — every string in data.json originates from the LegiScan
   API (bill titles, sponsor text) and from an LLM summary. All of it is escaped
   through esc() before it reaches innerHTML. Do not interpolate a raw field.
   ========================================================================== */
(function () {
  'use strict';

  var DATA_URL = 'data.json';

  /* LegiScan Status / Progress codes, verbatim from the v1.91 manual p42.
     Mapped onto the four stations the track draws. `dead` marks a terminal
     failure so the track can strike it rather than show progress. */
  var STATUS = {
    0:  { label: 'No status',  stage: 0 },
    1:  { label: 'Introduced', stage: 1 },
    2:  { label: 'Engrossed',  stage: 2 },
    3:  { label: 'Enrolled',   stage: 3 },
    4:  { label: 'Passed',     stage: 4 },
    5:  { label: 'Vetoed',     stage: 3, dead: true },
    6:  { label: 'Failed',     stage: 1, dead: true },
    7:  { label: 'Override',   stage: 4 },
    8:  { label: 'Chaptered',  stage: 4 },
    9:  { label: 'In committee', stage: 1 },
    10: { label: 'Reported',   stage: 1 },
    11: { label: 'Report DNP', stage: 1 },
    12: { label: 'Draft',      stage: 0 }
  };
  var STATIONS = ['Introduced', 'Engrossed', 'Enrolled', 'Law'];

  var state = { bills: [], dir: 'all', juris: 'all', q: '' };

  var els = {
    entries:   document.getElementById('entries'),
    msg:       document.getElementById('stateMsg'),
    count:     document.getElementById('resultCount'),
    stateSel:  document.getElementById('stateSel'),
    q:         document.getElementById('q'),
    total:     document.getElementById('statTotal'),
    moved:     document.getElementById('statMoved'),
    states:    document.getElementById('statStates'),
    synced:    document.getElementById('statSynced')
  };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* -----------------------------------------------------------------------
     The stage track. Four stations on a ruled bar; the travelled span is a
     polygon whose leading edge is cut to a point, so it reads as a chamfered
     rule and not a rounded progress pill. A dead bill is drawn at the dim tone
     and struck with a cross at the station it stopped on.
     ----------------------------------------------------------------------- */
  /* AIDEV-NOTE: The four stations sit at the QUARTER points of the rule, not at
     its origin — station i is at X0 + STEP*(i+1). If Introduced sat at X0 a
     newly-introduced bill would draw a zero-length bar and read as "no
     progress", which is exactly wrong. Reaching stage N fills N quarters. */
  var X0 = 6, X1 = 232, STEP = (X1 - X0) / 4, MID = 13;

  function track(statusCode) {
    var s = STATUS[statusCode] || STATUS[0];
    var reached = s.stage;                       // 0..4 stations completed
    var tone = s.dead ? 'var(--bone-faint)' : 'var(--amber)';
    var p = [];

    p.push('<line x1="' + X0 + '" y1="' + MID + '" x2="' + X1 + '" y2="' + MID +
           '" stroke="var(--edge-lit)" stroke-width="1"/>');

    if (reached > 0) {
      var endX = X0 + STEP * reached;
      // Pointed leading edge — the chamfer. Never a rounded cap.
      var pts = X0 + ',11 ' + Math.max(X0, endX - 5) + ',11 ' + endX + ',' + MID + ' ' +
                Math.max(X0, endX - 5) + ',15 ' + X0 + ',15';
      p.push('<polygon points="' + pts + '" fill="' + tone + '"/>');

      if (s.dead) {
        p.push('<line x1="' + (endX - 5) + '" y1="6" x2="' + (endX + 5) + '" y2="20" stroke="' + tone + '" stroke-width="1.4"/>');
        p.push('<line x1="' + (endX + 5) + '" y1="6" x2="' + (endX - 5) + '" y2="20" stroke="' + tone + '" stroke-width="1.4"/>');
      }
    }

    for (var i = 0; i < 4; i++) {
      var x = X0 + STEP * (i + 1);
      var lit = (i < reached) && !s.dead;
      p.push('<line x1="' + x + '" y1="7" x2="' + x + '" y2="19" stroke="' +
             (lit ? 'var(--amber)' : 'var(--edge-lit)') + '" stroke-width="' + (lit ? 1.8 : 1.2) + '"/>');
    }

    var reading = s.label + '. ' + (reached > 0 ? 'Reached ' + STATIONS[Math.max(0, reached - 1)] : 'Not yet moved') +
                  ' of ' + STATIONS.join(', ') + '.';

    return '<svg class="track-svg" viewBox="0 0 238 26" role="img" aria-label="' + esc(reading) + '">' +
             p.join('') +
           '</svg>' +
           '<span class="track-status' + (s.dead ? ' is-dead' : '') + '">' + esc(s.label) + '</span>';
  }

  /* Direction is drawn, never coloured — the register does not editorialise
     with hue. Outward chevrons expand, inward chevrons restrict. */
  function chevron(dir) {
    var d = {
      expands:   '<path d="M6 1 L2 5 L6 9"/><path d="M9 1 L13 5 L9 9"/>',
      restricts: '<path d="M2 1 L6 5 L2 9"/><path d="M13 1 L9 5 L13 9"/>',
      mixed:     '<path d="M7.5 1 L12 5 L7.5 9 L3 5 Z"/>',
      unclear:   '<path d="M3 5 L12 5"/>'
    }[dir] || '<path d="M3 5 L12 5"/>';
    var word = { expands: 'Expands', restricts: 'Restricts', mixed: 'Mixed' }[dir] || 'Unclear';
    return '<span class="e-dir"><svg viewBox="0 0 15 10" fill="none" stroke="currentColor" ' +
           'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           d + '</svg>' + esc(word) + '</span>';
  }

  function fmtDate(iso) {
    if (!iso) return null;
    var d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
    if (isNaN(d)) return esc(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function entry(b) {
    var meta = [];
    meta.push(chevron(b.direction));
    if (b.last_action) meta.push('<span>' + esc(b.last_action) + '</span>');
    var when = fmtDate(b.last_action_date);
    if (when) meta.push('<span>' + when + '</span>');

    var title = esc(b.title || 'Untitled bill');
    var titleHtml = b.url
      ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>'
      : title;

    return '<li class="entry">' +
      '<div class="e-juris">' +
        '<span class="e-state">' + esc(b.state || '') + '</span>' +
        '<span class="e-num">' + esc(b.bill_number || '') + '</span>' +
      '</div>' +
      '<div class="e-body">' +
        '<h3 class="e-title">' + titleHtml + '</h3>' +
        (b.summary ? '<p class="e-sum">' + esc(b.summary) + '</p>' : '') +
        '<p class="e-meta">' + meta.join('<span class="sep" aria-hidden="true">/</span>') + '</p>' +
      '</div>' +
      '<div class="e-track">' + track(b.status) + '</div>' +
    '</li>';
  }

  function visible() {
    var q = state.q.trim().toLowerCase();
    return state.bills.filter(function (b) {
      if (state.dir !== 'all' && b.direction !== state.dir) return false;
      if (state.juris !== 'all' && b.state !== state.juris) return false;
      if (q) {
        var hay = ((b.bill_number || '') + ' ' + (b.title || '') + ' ' +
                   (b.summary || '') + ' ' + (b.state || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var rows = visible();
    els.entries.innerHTML = rows.map(entry).join('');

    if (!state.bills.length) return;                 // keep the standing message

    els.msg.hidden = rows.length > 0;
    if (!rows.length) {
      els.msg.innerHTML = '<p class="state-head">Nothing matches those filters.</p>' +
        '<p class="state-body">Widen the jurisdiction, clear the search, or switch the direction back to All.</p>';
    }
    els.count.textContent = rows.length === state.bills.length
      ? rows.length.toLocaleString() + ' bills'
      : rows.length.toLocaleString() + ' of ' + state.bills.length.toLocaleString() + ' bills';
  }

  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (btn) {
      btn.addEventListener('click', function () {
        state.dir = btn.getAttribute('data-dir');
        Array.prototype.forEach.call(document.querySelectorAll('.seg-btn'), function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        render();
      });
    });
    els.stateSel.addEventListener('change', function () { state.juris = els.stateSel.value; render(); });
    els.q.addEventListener('input', function () { state.q = els.q.value; render(); });
  }

  /* LegiScan's licence requires the CC BY 4.0 credit by name; Open States does
     not, but is credited anyway. The page must never credit a source that did
     not produce the data on screen. */
  function attribution(source) {
    var el = document.getElementById('srcAttr');
    if (!el || !source) return;
    if (String(source).toLowerCase().indexOf('legiscan') !== -1) {
      el.innerHTML = 'Compiled from the <a href="https://legiscan.com/legiscan" rel="noopener noreferrer" target="_blank">LegiScan API</a>, ' +
        'which is licensed <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer nofollow" target="_blank">CC&nbsp;BY&nbsp;4.0</a> by LegiScan LLC.';
    }
  }

  function standing(data) {
    var b = data.bills || [];
    attribution(data.source);
    els.total.textContent = b.length.toLocaleString();
    els.states.textContent = (data.states || []).length || new Set(b.map(function (x) { return x.state; })).size;

    var moved = (data.stats && data.stats.moved_7d != null) ? data.stats.moved_7d : (function () {
      var cut = Date.now() - 7 * 864e5, n = 0;
      b.forEach(function (x) { var d = Date.parse(x.changed || x.last_action_date); if (d && d >= cut) n++; });
      return n;
    })();
    els.moved.textContent = Number(moved).toLocaleString();
    els.synced.textContent = data.generated ? fmtDate(data.generated.slice(0, 10)) : '—';

    var seen = (data.states && data.states.length)
      ? data.states.slice()
      : Object.keys(b.reduce(function (m, x) { m[x.state] = 1; return m; }, {}));
    seen.sort().forEach(function (s) {
      var o = document.createElement('option');
      o.value = s; o.textContent = s;
      els.stateSel.appendChild(o);
    });
  }

  wire();

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      if (!data || !Array.isArray(data.bills) || !data.bills.length) return;
      state.bills = data.bills;
      standing(data);
      render();
    })
    .catch(function () {
      // Leave the markup's standing message in place — it already says the
      // register has not been compiled. Nothing is hidden by this failure.
      els.count.textContent = 'No data file yet';
    });
})();
