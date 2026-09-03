/* The window: a live context window. Lines stream in; what no longer fits falls out the
   top; the visitor can drag the bottom edge to make the window bigger and get it back.
   Everything the window can say is also written plainly further down the page, so
   nothing here is the only copy of anything. */
(function () {
  'use strict';
  var view  = document.getElementById('view');
  var log   = document.getElementById('log');
  var ruler = document.getElementById('ruler');
  var fill  = document.getElementById('fill');
  var stTok = document.getElementById('stTok');
  var stOut = document.getElementById('stOut');
  var grip  = document.getElementById('grip');
  var win   = document.getElementById('win');
  if (!view || !log) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The whole transcript. `>` marks an indented line, `~` a dim one.
  var SCRIPT = [
    'the context window.',
    'a standing morning call for people who build with ai.',
    'remote. small. technical.',
    '~the premise:',
    '>no one person can hold all of this at once.',
    '>a room can hold more than a head.',
    'bring the thing you built.',
    'bring the thing that broke.',
    'show it running, not on a slide.',
    '~what fits in the window:',
    '>working code, however ugly',
    '>models on your own hardware',
    '>agents that touched something real',
    '>what it cost, in dollars and hours',
    '>the result you didn\'t want',
    '>the question you\'re stuck on',
    '~what doesn\'t:',
    '>vendor pitches',
    '>slide decks',
    '>anyone selling anything',
    '>hype',
    'mornings, on a video call.',
    'a signal over noise thing.',
    'the window only holds so much. that\'s why we meet.',
    'drag the bar below to make it bigger.'
  ];

  // Lines already in the HTML count as streamed.
  var streamed = log.children.length;
  var lines = [];               // every line that has been streamed so far
  Array.prototype.forEach.call(log.children, function (li) { lines.push(parse(SCRIPT[lines.length])); });
  var partial = null;           // the line currently being typed
  var evicted = 0;

  function parse(raw) {
    var cls = '';
    if (raw.charAt(0) === '>') { cls = 'in'; raw = raw.slice(1); }
    else if (raw.charAt(0) === '~') { cls = 'dim'; raw = raw.slice(1); }
    return { text: raw, cls: cls };
  }
  // The common rule of thumb; it is labelled "≈" wherever it is shown.
  function tokens(s) { return Math.max(1, Math.ceil(s.length / 4)); }
  var avgTok = Math.round(SCRIPT.reduce(function (a, s) { return a + tokens(parse(s).text); }, 0) / SCRIPT.length);

  function lineHeight() {
    var lh = parseFloat(getComputedStyle(log).lineHeight);
    return isNaN(lh) ? 24 : lh;
  }

  // Render the newest lines that fit; older ones are "outside the window".
  function render() {
    var all = lines.slice();
    if (partial) all.push(partial);
    var frag = document.createDocumentFragment();
    all.forEach(function (l, i) {
      var li = document.createElement('li');
      li.textContent = l.text;
      if (l.cls) li.className = l.cls;
      if (partial && i === all.length - 1) li.classList.add('cur');
      frag.appendChild(li);
    });
    log.innerHTML = '';
    log.appendChild(frag);
    // Drop from the top until it fits. Wrapped lines make a fixed count wrong, so measure.
    var dropped = 0;
    while (log.children.length > 1 && log.scrollHeight > view.clientHeight - 44 + 1) {
      log.removeChild(log.firstElementChild); dropped++;
    }
    evicted = dropped;

    var shownTok = 0;
    Array.prototype.forEach.call(log.children, function (li) { shownTok += tokens(li.textContent); });
    // Capacity: what is shown plus what the empty space below could still hold, so the
    // figure can never read as more than full. Wrapped lines make a flat count wrong.
    var spare = Math.max(0, (view.clientHeight - 44) - log.scrollHeight);
    var cap = shownTok + Math.floor(spare / lineHeight()) * avgTok;
    if (fill) fill.style.height = Math.min(100, Math.round(shownTok / cap * 100)) + '%';
    if (stTok) stTok.textContent = '≈ ' + shownTok.toLocaleString() + ' of ' + cap.toLocaleString() + ' tokens in the window';
    if (stOut) stOut.textContent = evicted === 0 ? 'nothing outside it yet' : evicted + (evicted === 1 ? ' line' : ' lines') + ' outside it';
    drawRuler(cap);
  }

  var lastCap = -1;
  function drawRuler(cap) {
    if (!ruler || cap === lastCap) return;
    lastCap = cap;
    Array.prototype.slice.call(ruler.querySelectorAll('.tick')).forEach(function (t) { t.parentNode.removeChild(t); });
    for (var i = 0; i <= 4; i++) {
      var t = document.createElement('i');
      t.className = 'tick';
      t.style.bottom = (i * 25) + '%';
      var b = document.createElement('b');
      b.textContent = i === 0 ? '0' : Math.round(cap * i / 4).toLocaleString();
      t.appendChild(b);
      ruler.appendChild(t);
    }
  }

  // ---- streaming ----
  var timer = null;
  function next() {
    if (streamed >= SCRIPT.length) { partial = null; render(); return; }
    var l = parse(SCRIPT[streamed]);
    if (reduce) {
      lines.push(l); streamed++; partial = null; render();
      timer = setTimeout(next, 1400);
      return;
    }
    var i = 0;
    partial = { text: '', cls: l.cls };
    (function type() {
      i++;
      partial.text = l.text.slice(0, i);
      render();
      if (i < l.text.length) { timer = setTimeout(type, 14 + Math.random() * 22); }
      else { lines.push(l); streamed++; partial = null; render(); timer = setTimeout(next, 520 + Math.random() * 400); }
    })();
  }

  // ---- the grip: drag, keys, double-click ----
  var base = view.getBoundingClientRect().height;
  var startY = 0, startH = 0;
  function clampH(h) { return Math.max(200, Math.min(h, Math.round(window.innerHeight * 0.86))); }
  function setH(h) { view.style.height = clampH(h) + 'px'; render(); }

  if (grip) {
    grip.addEventListener('pointerdown', function (e) {
      startY = e.clientY; startH = view.getBoundingClientRect().height;
      win.classList.add('dragging');
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener('pointermove', function (e) {
      if (!win.classList.contains('dragging')) return;
      setH(startH + (e.clientY - startY));
    });
    function end(e) { win.classList.remove('dragging'); try { grip.releasePointerCapture(e.pointerId); } catch (_) {} }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', function () { view.style.height = ''; render(); });
    grip.addEventListener('keydown', function (e) {
      var h = view.getBoundingClientRect().height;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { setH(h + 24); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { setH(h - 24); e.preventDefault(); }
      else if (e.key === 'Home') { view.style.height = ''; render(); e.preventDefault(); }
    });
  }

  window.addEventListener('resize', render);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  render();
  timer = setTimeout(next, 900);

  // Debug hook for verification only.
  window.__cw = { lines: function () { return log.children.length; }, evicted: function () { return evicted; }, streamed: function () { return streamed; } };
})();
