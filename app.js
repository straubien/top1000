/* ── app.js ─────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var DATA = null;
  var LANG = localStorage.getItem('lang') || 'fr';

  /* ── i18n labels ── */
  var UI = {
    fr: {
      home: 'Accueil',
      about: 'A propos',
      directors: 'Par réalisateur',
      silentsLabel: '1895–1929',
      langSwitch: 'English version',
      langSwitchTarget: 'en',
      intro: '',
      aboutTitle: 'A propos',
      all: 'Tous',
      films: 'films',
      filmSingular: 'film',
      directorsCount: 'cinéastes représentés',
      metaDescAbout: 'A propos de la sélection cinéphile de Mathieu Muzard.',
      backToTop: 'Retour en haut',
      darkMode: 'Mode sombre'
    },
    en: {
      home: 'Home',
      about: 'About',
      directors: 'By director',
      silentsLabel: 'Silent era (1895–1929)',
      langSwitch: 'Version française',
      langSwitchTarget: 'fr',
      intro: '',
      aboutTitle: 'About',
      all: 'All',
      films: 'films',
      filmSingular: 'film',
      directorsCount: 'directors represented',
      metaDescAbout: "About Mathieu Muzard's film selection.",
      backToTop: 'Back to top',
      darkMode: 'Dark mode'
    }
  };

  var DECADE_KEYS = ['silents','1930s','1940s','1950s','1960s','1970s','1980s','1990s','2000s','2010s'];

  /* ── Helpers ── */
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getDecadeLabel(key) {
    var langData = DATA[LANG];
    for (var i = 0; i < langData.decades.length; i++) {
      if (langData.decades[i].key === key) return langData.decades[i].label;
    }
    return key;
  }

  function getDecadeData(key) {
    var langData = DATA[LANG];
    for (var i = 0; i < langData.decades.length; i++) {
      if (langData.decades[i].key === key) return langData.decades[i];
    }
    return null;
  }

  function countFilms(decade) {
    var c = 0;
    for (var i = 0; i < decade.years.length; i++) {
      c += decade.years[i].films.length;
    }
    return c;
  }

  /* ── Rendering ── */

  function renderFilmItem(film) {
    var note = '';
    if (film.note) {
      note = ' <em>' + esc(film.note) + '</em>';
    }
    return '<li class="' + film.tier + '">' + esc(film.title) + note + '</li>';
  }

  function renderNav(activeKey) {
    var ui = UI[LANG];
    var links = [
      { key: 'home', label: ui.home, hash: '#home' },
      { key: 'about', label: ui.about, hash: '#about' },
      { key: 'directors', label: ui.directors, hash: '#directors' }
    ];
    for (var i = 0; i < DECADE_KEYS.length; i++) {
      var k = DECADE_KEYS[i];
      links.push({ key: k, label: getDecadeLabel(k), hash: '#' + k });
    }

    var html = '';
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var style = l.key === activeKey ? ' style="color: var(--accent);"' : '';
      html += '<a href="' + l.hash + '"' + style + '>' + esc(l.label) + '</a>';
    }
    html += '<a href="#" class="lang-switch" id="langSwitch">' + esc(ui.langSwitch) + '</a>';
    return html;
  }

  function renderLegend() {
    return '<div class="legend">' +
      '<span class="legend-item"><span class="legend-dot green"></span> Top 100</span>' +
      '<span class="legend-item"><span class="legend-dot blue"></span> Top 200</span>' +
      '<span class="legend-item"><span class="legend-dot brown"></span> Top 300</span>' +
      '<span class="legend-item"><span class="legend-dot black"></span> Top 1000</span>' +
      '</div>';
  }

  var _activeTier = 'all';

  function renderTierFilter() {
    var ui = UI[LANG];
    var tiers = ['all', 'top-100', 'top-200', 'top-300', 'top-rest'];
    var labels = [esc(ui.all), 'Top 100', 'Top 200', 'Top 300', 'Top 1000'];
    var html = '<div class="tier-filter">';
    for (var i = 0; i < tiers.length; i++) {
      var active = tiers[i] === _activeTier ? ' class="active"' : '';
      html += '<button' + active + ' data-tier="' + tiers[i] + '">' + labels[i] + '</button>';
    }
    html += '</div>';
    return html;
  }

  function setupTierFilter() {
    var buttons = document.querySelectorAll('.tier-filter button');
    // Apply current active tier immediately
    var items = document.querySelectorAll('.film-list li');
    items.forEach(function (li) {
      li.style.display = (_activeTier === 'all' || li.classList.contains(_activeTier)) ? '' : 'none';
    });
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        _activeTier = this.dataset.tier;
        buttons.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        var items = document.querySelectorAll('.film-list li');
        items.forEach(function (li) {
          if (_activeTier === 'all') {
            li.style.display = '';
          } else {
            li.style.display = li.classList.contains(_activeTier) ? '' : 'none';
          }
        });
      });
    });
  }

  /* ── Pages ── */

  function renderHomePage() {
    var ui = UI[LANG];
    var langData = DATA[LANG];
    document.getElementById('mainNav').innerHTML = renderNav('home');
    document.title = "Mathieu Muzard's 1000 Essential Films";

    var html = '<div class="intro justified"><p>' + esc(langData.intro) + '</p></div>';
    html += '<hr class="separator">';
    html += renderLegend();
    html += '<ul class="links-list">';
    for (var i = 0; i < langData.decades.length; i++) {
      var d = langData.decades[i];
      var c = countFilms(d);
      html += '<li><a href="#' + d.key + '">' + esc(d.label) + '</a> <span class="film-count">(' + c + ' ' + ui.films + ')</span></li>';
    }
    html += '</ul>';
    document.getElementById('main-content').innerHTML = html;
  }

  function renderAboutPage() {
    var ui = UI[LANG];
    var langData = DATA[LANG];
    document.getElementById('mainNav').innerHTML = renderNav('about');
    document.title = ui.aboutTitle + " — Mathieu Muzard's 1000 Essential Films";

    var html = '<h2 class="page-title">' + esc(ui.aboutTitle) + '</h2>';
    html += '<div class="intro justified"><p>' + langData.about + '</p></div>';
    document.getElementById('main-content').innerHTML = html;
  }

  function renderDirectorsPage() {
    var ui = UI[LANG];
    var langData = DATA[LANG];
    document.getElementById('mainNav').innerHTML = renderNav('directors');
    document.title = ui.directors + " — Mathieu Muzard's 1000 Essential Films";

    var dirCount = langData.directors.length;
    var html = '<h2 class="page-title">' + esc(ui.directors) + '</h2>';
    html += '<p class="intro">' + dirCount + ' ' + esc(ui.directorsCount) + '</p>';
    html += renderLegend();
    html += renderTierFilter();

    for (var i = 0; i < langData.directors.length; i++) {
      var dir = langData.directors[i];
      html += '<div class="director-group">';
      var filmWord = dir.films.length === 1 ? ui.filmSingular : ui.films;
      html += '<h3 class="director-heading">' + esc(dir.name) + ' <span class="film-count">(' + dir.films.length + ' ' + filmWord + ')</span></h3>';
      html += '<ul class="film-list">';
      for (var j = 0; j < dir.films.length; j++) {
        html += renderFilmItem(dir.films[j]);
      }
      html += '</ul></div>';
    }

    document.getElementById('main-content').innerHTML = html;
    setupTierFilter();
  }

  function renderDecadePage(key) {
    var ui = UI[LANG];
    var decade = getDecadeData(key);
    if (!decade) { renderHomePage(); return; }
    document.getElementById('mainNav').innerHTML = renderNav(key);
    document.title = decade.label + " — Mathieu Muzard's 1000 Essential Films";

    var html = '<h2 class="decade-title">' + esc(decade.label) + '</h2>';
    html += renderLegend();
    html += renderTierFilter();

    for (var i = 0; i < decade.years.length; i++) {
      var yr = decade.years[i];
      html += '<div class="year-group">';
      html += '<h3 class="year-heading">' + esc(yr.year) + '</h3>';
      html += '<ul class="film-list">';
      for (var j = 0; j < yr.films.length; j++) {
        html += renderFilmItem(yr.films[j]);
      }
      html += '</ul></div>';
    }

    // Decade navigation
    var idx = DECADE_KEYS.indexOf(key);
    html += '<div class="decade-nav">';
    if (idx > 0) {
      var prevKey = DECADE_KEYS[idx - 1];
      html += '<a href="#' + prevKey + '">&larr; ' + esc(getDecadeLabel(prevKey)) + '</a>';
    } else {
      html += '<span></span>';
    }
    if (idx < DECADE_KEYS.length - 1) {
      var nextKey = DECADE_KEYS[idx + 1];
      html += '<a href="#' + nextKey + '">' + esc(getDecadeLabel(nextKey)) + ' &rarr;</a>';
    } else {
      html += '<span></span>';
    }
    html += '</div>';

    document.getElementById('main-content').innerHTML = html;
    setupTierFilter();
  }

  /* ── Router ── */
  function route() {
    var hash = (location.hash || '#home').substring(1);
    // Save scroll position for current page before leaving
    var prevHash = route._currentHash || 'home';
    route._scrollPositions = route._scrollPositions || {};
    route._scrollPositions[prevHash] = window.scrollY;
    route._currentHash = hash;

    // Fade out
    document.body.style.opacity = '0';
    setTimeout(function () {
      if (hash === 'home' || hash === '') {
        renderHomePage();
      } else if (hash === 'about') {
        renderAboutPage();
      } else if (hash === 'directors') {
        renderDirectorsPage();
      } else if (DECADE_KEYS.indexOf(hash) !== -1) {
        renderDecadePage(hash);
      } else {
        renderHomePage();
      }
      setupLangSwitch();
      setupInternalLinks();
      // Restore scroll position if returning to a previously visited page
      var savedScroll = route._scrollPositions[hash] || 0;
      window.scrollTo(0, savedScroll);
      // Fade in
      requestAnimationFrame(function () {
        document.body.style.opacity = '1';
      });
    }, 350);
  }

  function setupInternalLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      if (link.id === 'backToTop') return;
      if (link.id === 'langSwitch') return;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = this.getAttribute('href');
        if (location.hash === href) {
          // Same page — just scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          location.hash = href;
        }
      });
    });
  }

  function setupLangSwitch() {
    var btn = document.getElementById('langSwitch');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      LANG = LANG === 'fr' ? 'en' : 'fr';
      localStorage.setItem('lang', LANG);
      document.documentElement.lang = LANG;
      route();
    });
  }

  /* ── Banner ── */
  function setupBanner() {
    var maxPhoto = 100;
    var bannerCount = 6;
    var memorySize = 30;
    var banner = document.getElementById('mosaic-banner');
    if (!banner) return;

    var memory = [];
    try {
      memory = JSON.parse(sessionStorage.getItem('bannerMemory') || '[]');
    } catch (e) { memory = []; }

    var pool = [];
    for (var i = 1; i <= maxPhoto; i++) pool.push(i);

    // Fisher-Yates shuffle
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = pool[i];
      pool[i] = pool[j];
      pool[j] = temp;
    }

    var preferred = [];
    var fallback = [];
    for (var i = 0; i < pool.length; i++) {
      if (memory.indexOf(pool[i]) === -1) preferred.push(pool[i]);
      else fallback.push(pool[i]);
    }

    var candidates = preferred.concat(fallback);
    var used = [];
    var idx = 0;

    function addImage() {
      if (idx >= candidates.length) return;
      var n = candidates[idx];
      idx++;
      var img = document.createElement('img');
      var num = String(n);
      if (num.length < 2) num = '0' + num;
      img.src = 'images/photo (' + num + ').jpg';
      img.alt = '';
      img.onload = function () {
        used.push(n);
        var newMemory = memory.concat(used);
        if (newMemory.length > memorySize) newMemory = newMemory.slice(newMemory.length - memorySize);
        try { sessionStorage.setItem('bannerMemory', JSON.stringify(newMemory)); } catch (e) { }
      };
      img.onerror = function () {
        banner.removeChild(img);
        addImage();
      };
      banner.appendChild(img);
    }

    for (var i = 0; i < bannerCount; i++) addImage();
  }

  /* ── Back to top ── */
  /* ── Nav toggle (hamburger) ── */
  function setupNavToggle() {
    var btn = document.getElementById('navToggle');
    var nav = document.getElementById('mainNav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      nav.classList.toggle('open');
      btn.classList.toggle('open');
    });
    // Close nav when a link is clicked
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        btn.classList.remove('open');
      }
    });
  }

  /* ── Back to top ── */
  function setupBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.style.opacity = window.scrollY > 400 ? '1' : '0';
      btn.style.pointerEvents = window.scrollY > 400 ? 'auto' : 'none';
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Dark mode ── */
  function setupDarkMode() {
    var btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    var isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    btn.textContent = isDark ? '\u2600' : '\u263D';
    btn.addEventListener('click', function () {
      document.body.classList.toggle('dark-mode');
      var dark = document.body.classList.contains('dark-mode');
      localStorage.setItem('darkMode', dark);
      btn.textContent = dark ? '\u2600' : '\u263D';
    });
  }

  /* ── Init ── */
  function init() {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    document.documentElement.lang = LANG;

    fetch('data.json')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        DATA = d;
        setupBanner();
        setupNavToggle();
        setupBackToTop();
        setupDarkMode();
        route();
        window.addEventListener('hashchange', route);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
