/* Search the card box.

   Progressive enhancement, deliberately: the search control ships hidden and
   this script reveals it. If the script never runs, nobody sees a dead box —
   they see the whole card box, which is fully browsable without JavaScript.
   Content is never gated on this file loading.

   Scoring leans on the hand-written tags in search-index.js, so a search for
   "Christmas" finds the Julekake and the Fattigmann even though neither card
   says the word. */
(function () {
  var index = window.FALDE_INDEX;
  var form = document.querySelector('.search');
  var input = document.getElementById('q');
  if (!index || !form || !input) return;

  var status = document.getElementById('search-status');
  var clear = form.querySelector('.search__clear');
  var main = document.querySelector('main');
  var cards = Array.prototype.slice.call(main.querySelectorAll('.card[data-slug]'));
  var groups = Array.prototype.slice.call(main.querySelectorAll('.group'));
  var byslug = {};
  cards.forEach(function (c) { byslug[c.getAttribute('data-slug')] = c; });

  // A few things people type that the cards phrase differently.
  var SYNONYMS = {
    xmas: 'christmas', holiday: 'christmas', yule: 'christmas julekake',
    nobake: 'frozen refrigerator icebox chilled', freezer: 'frozen',
    fridge: 'refrigerator icebox',
    bp: 'baking powder', choc: 'chocolate', chocolatechip: 'chocolate chips',
    oats: 'oatmeal', cooky: 'cookies', cookys: 'cookies', cookie: 'cookies',
    sirup: 'syrup', raisin: 'raisins', rasin: 'raisins',
    norway: 'norwegian scandinavian', scandinavian: 'norwegian',
    grandma: 'grandmother', crowd: 'dozen hundred fifty',
    canning: 'canning preserves put up seal jars',
    supper: 'supper dinner', dinner: 'supper dinner',
    veg: 'vegetable', dessert: 'cake torte cookies dessert'
  };

  // Phrases that mean one thing, collapsed before the query is split up.
  // Without this, "no bake" searches for "bake" and returns every baked card.
  var PHRASES = [
    [/\bno[- ]bake\b/g, 'nobake'],
    [/\bice[- ]box\b/g, 'icebox'],
    [/\bmeat[- ]loaf\b/g, 'meatloaf'],
    [/\bpop[- ]corn\b/g, 'popcorn'],
    [/\bcream of tartar\b/g, 'tartar'],
    [/\bmrs?\.? ([a-z])\b/g, 'mrs$1']   // "Mrs. J" -> mrsj, so initials survive
  ];

  // Filler that would otherwise match half the box.
  var SKIP = { no: 1, not: 1, any: 1, some: 1, thing: 1, something: 1, with: 1,
               without: 1, the: 1, and: 1, for: 1, that: 1, has: 1, have: 1 };

  function norm(s) {
    return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\- ]+/g, ' ');
  }

  // Each word the reader typed becomes a GROUP of acceptable alternatives.
  // A card must satisfy every group, but any one alternative inside a group
  // will do — so "no bake" (frozen OR refrigerator OR icebox) works, instead
  // of demanding a card be all three at once.
  function queryGroups(raw) {
    var s = norm(raw);
    PHRASES.forEach(function (p) { s = s.replace(p[0], p[1]); });
    var groups = [];
    s.split(/\s+/).forEach(function (w) {
      if (!w || w.length < 2 || SKIP[w]) return;
      var alts = [w];
      var syn = SYNONYMS[w.replace(/[^a-z]/g, '')];
      if (syn) syn.split(' ').forEach(function (x) { if (x) alts.push(x); });
      groups.push(alts);
    });
    return groups;
  }

  // one-character edit distance, for forgiving a typo on longer words
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }

  function hit(token, list, exact, prefix) {
    var best = 0;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w === token) return exact;
      if (w.indexOf(token) === 0) best = Math.max(best, prefix);
      else if (token.length >= 5 && near(token, w)) best = Math.max(best, prefix - 1);
    }
    return best;
  }

  function score(rec, groups) {
    var name = norm(rec.n), nameWords = name.split(/\s+/);
    var total = 0;
    for (var i = 0; i < groups.length; i++) {
      var alts = groups[i], best = 0;
      for (var j = 0; j < alts.length; j++) {
        var t = alts[j];
        var s = hit(t, nameWords, 14, 10) || hit(t, rec.g, 8, 6) || hit(t, rec.t, 3, 2);
        if (!s && name.indexOf(t) > -1) s = 6;   // matches inside a name
        if (s > best) best = s;
      }
      if (!best) return 0;   // every word the reader typed must land somewhere
      total += best;
    }
    return total;
  }

  function run(raw) {
    var q = raw.trim();
    form.classList.toggle('is-active', q.length > 0);

    if (!q) {
      cards.forEach(function (c) { c.hidden = false; });
      groups.forEach(function (g) { g.hidden = false; });
      status.textContent = '';
      return;
    }

    var groups_q = queryGroups(q);
    var keep = {};
    var n = 0;
    index.forEach(function (rec) {
      if (score(rec, groups_q) > 0) { keep[rec.s] = true; n++; }
    });

    cards.forEach(function (c) { c.hidden = !keep[c.getAttribute('data-slug')]; });
    groups.forEach(function (g) {
      var box = g.querySelector('.box');
      if (!box) { g.hidden = true; return; }   // hide "Adding to this" while searching
      g.hidden = !box.querySelector('.card:not([hidden])');
    });

    status.textContent = n === 0
      ? 'No cards match “' + q + '”.'
      : n + (n === 1 ? ' card' : ' cards') + ' match “' + q + '”.';
  }

  form.hidden = false;                 // reveal only now that it works
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  input.addEventListener('input', function () { run(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; run(''); }
  });
  clear.addEventListener('click', function () { input.value = ''; run(''); input.focus(); });
})();
