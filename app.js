(function () {
  "use strict";

  // Données chargées depuis data.json
  var data = null;

  // Correction #4 : détection de la langue du navigateur avant de tomber sur "fr"
  var currentLang =
    localStorage.getItem("lang") ||
    (navigator.language && navigator.language.startsWith("en") ? "en" : "fr");

  // Libellés de l'interface dans les deux langues
  var i18n = {
    fr: {
      home: "Accueil",
      about: "A propos",
      directors: "Par réalisateur",
      silentsLabel: "1895–1929",
      langSwitch: "English version",
      langSwitchTarget: "en",
      intro: "",
      aboutTitle: "A propos",
      all: "Tous",
      films: "films",
      filmSingular: "film",
      directorsCount: "cinéastes représentés",
      metaDescAbout: "A propos de la sélection cinéphile de Mathieu Muzard.",
      backToTop: "Retour en haut",
      darkMode: "Mode sombre"
    },
    en: {
      home: "Home",
      about: "About",
      directors: "By director",
      silentsLabel: "Silent era (1895–1929)",
      langSwitch: "Version française",
      langSwitchTarget: "fr",
      intro: "",
      aboutTitle: "About",
      all: "All",
      films: "films",
      filmSingular: "film",
      directorsCount: "directors represented",
      metaDescAbout: "About Mathieu Muzard's film selection.",
      backToTop: "Back to top",
      darkMode: "Dark mode"
    }
  };

  // Clés des décennies dans l'ordre d'affichage
  var decadeKeys = [
    "silents", "1930s", "1940s", "1950s",
    "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"
  ];

  // Préfixe de base des URLs
  var basePath = "/top1000";

  // Tier actif pour le filtre
  var activeTier = "all";

  // ID du timeout de transition (évite les superpositions lors de navigation rapide)
  var transitionTimeoutId = null;

  // ── Utilitaires ──────────────────────────────────────────────

  /**
   * Échappe une chaîne pour l'insérer sans risque dans du HTML.
   * Protection contre les injections XSS.
   */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Retourne le label d'une décennie à partir de sa clé.
   */
  function getDecadeLabel(key) {
    var langData = data[currentLang];
    for (var i = 0; i < langData.decades.length; i++) {
      if (langData.decades[i].key === key) {
        return langData.decades[i].label;
      }
    }
    return key;
  }

  /**
   * Compte le nombre total de films dans une décennie.
   */
  function countFilmsInDecade(decade) {
    var total = 0;
    for (var i = 0; i < decade.years.length; i++) {
      total += decade.years[i].films.length;
    }
    return total;
  }

  /**
   * Génère le HTML d'un élément <li> pour un film.
   */
  function renderFilmItem(film) {
    var note = "";
    if (film.note) {
      note = " <em>" + escapeHtml(film.note) + "</em>";
    }
    return '<li class="' + film.tier + '">' + escapeHtml(film.title) + note + "</li>";
  }

  // ── Navigation ───────────────────────────────────────────────

  /**
   * Génère le HTML de la barre de navigation.
   * @param {string} activePage - clé de la page active (pour coloration)
   */
  function renderNav(activePage) {
    var labels = i18n[currentLang];
    var items = [
      { key: "home",      label: labels.home },
      { key: "about",     label: labels.about },
      { key: "directors", label: labels.directors }
    ];

    for (var i = 0; i < decadeKeys.length; i++) {
      var key = decadeKeys[i];
      items.push({ key: key, label: getDecadeLabel(key) });
    }

    var html = "";
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var activeStyle = (item.key === activePage) ? ' style="color: var(--accent);"' : "";
      html +=
        '<a href="' + basePath + "/" + item.key + '"' +
        ' data-page="' + item.key + '"' +
        activeStyle + ">" +
        escapeHtml(item.label) +
        "</a>";
    }

    html +=
      '<a href="#" class="lang-switch" id="langSwitch">' +
      escapeHtml(labels.langSwitch) +
      "</a>";

    return html;
  }

  // ── Filtre par tier ──────────────────────────────────────────

  /**
   * Génère le HTML des boutons de filtre par tier.
   */
  function renderTierFilter() {
    var tierKeys   = ["all", "top-100", "top-200", "top-300", "top-rest"];
    var tierLabels = [escapeHtml(i18n[currentLang].all), "Top 100", "Top 200", "Top 300", "Top 1000"];

    var html = '<div class="tier-filter">';
    for (var i = 0; i < tierKeys.length; i++) {
      var isActive = (tierKeys[i] === activeTier);
      html +=
        '<button' + (isActive ? ' class="active"' : '') +
        ' data-tier="' + tierKeys[i] + '"' +
        ' aria-pressed="' + (isActive ? "true" : "false") + '">' +
        tierLabels[i] +
        "</button>";
    }
    html += "</div>";
    return html;
  }

  /**
   * Attache les écouteurs sur les boutons de filtre et applique l'état initial.
   */
  function bindTierFilter() {
    var buttons = document.querySelectorAll(".tier-filter button");
    var legendBtns = document.querySelectorAll(".legend-btn");

    function setActiveButton(btns, tier) {
      btns.forEach(function (b) {
        var isActive = b.dataset.tier === tier;
        b.classList.toggle("active", isActive);
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function hideGroupsWithoutFilms(selector, tier) {
      document.querySelectorAll(selector).forEach(function (group) {
        if (tier === "all") {
          group.style.display = "";
          return;
        }
        var visibleFilms = group.querySelectorAll(".film-list li." + tier);
        group.style.display = visibleFilms.length > 0 ? "" : "none";
      });
    }

    function applyFilter(tier) {
      activeTier = tier;

      // Mettre à jour l'état actif des boutons tier-filter et légende
      setActiveButton(buttons, tier);
      setActiveButton(legendBtns, tier);

      // Afficher/masquer les films
      document.querySelectorAll(".film-list li").forEach(function (li) {
        li.style.display =
          tier === "all" || li.classList.contains(tier) ? "" : "none";
      });

      // Masquer les groupes sans films visibles
      hideGroupsWithoutFilms(".year-group", tier);
      hideGroupsWithoutFilms(".director-group", tier);
    }

    // Appliquer l'état initial
    applyFilter(activeTier);

    // Écouter les clics sur tier-filter
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var newTier = this.dataset.tier;
        applyFilter(activeTier === newTier ? "all" : newTier);
      });
    });

    // Écouter les clics sur la légende
    legendBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var newTier = this.dataset.tier;
        applyFilter(activeTier === newTier ? "all" : newTier);
      });
    });
  }

  // ── Pages ────────────────────────────────────────────────────

  /**
   * Affiche la page d'accueil (liste des décennies).
   */
  function renderHomePage() {
    var labels   = i18n[currentLang];
    var langData = data[currentLang];

    document.getElementById("mainNav").innerHTML = renderNav("home");
    document.title = "Mathieu Muzard's 1000 Essential Films";

    var html = '<div class="intro"><p>' + escapeHtml(langData.intro) + "</p></div>";
    html += '<hr class="separator">';
    html += renderLegend(false);
    html += '<ul class="links-list">';

    for (var i = 0; i < langData.decades.length; i++) {
      var decade = langData.decades[i];
      var count  = countFilmsInDecade(decade);
      html +=
        "<li>" +
        '<a href="' + basePath + "/" + decade.key + '" data-page="' + decade.key + '">' +
        escapeHtml(decade.label) +
        "</a>" +
        ' <span class="film-count">(' + count + " " + labels.films + ")</span>" +
        "</li>";
    }

    html += "</ul>";
    document.getElementById("main-content").innerHTML = html;
  }

  /**
   * Affiche la page "À propos".
   */
  function renderAboutPage() {
    var labels   = i18n[currentLang];
    var langData = data[currentLang];

    document.getElementById("mainNav").innerHTML = renderNav("about");
    document.title = labels.aboutTitle + " — Mathieu Muzard's 1000 Essential Films";

    var mainContent = document.getElementById("main-content");
    var html = '<h2 class="page-title">' + escapeHtml(labels.aboutTitle) + "</h2>";
    mainContent.innerHTML = html;

    var aboutContainer = document.createElement("div");
    aboutContainer.className = "intro justified";
    var parser = new DOMParser();
    var parsed = parser.parseFromString(langData.about, "text/html");
    Array.from(parsed.body.childNodes).forEach(function (node) {
      aboutContainer.appendChild(document.importNode(node, true));
    });
    Array.from(aboutContainer.querySelectorAll("a[href]")).forEach(function (a) {
      if (a.hostname && a.hostname !== window.location.hostname) {
        a.setAttribute("rel", "noopener noreferrer");
      }
    });
    mainContent.appendChild(aboutContainer);
  }

  /**
   * Affiche la page "Par réalisateur".
   */
  function renderDirectorsPage() {
    var labels   = i18n[currentLang];
    var langData = data[currentLang];

    document.getElementById("mainNav").innerHTML = renderNav("directors");
    document.title = labels.directors + " — Mathieu Muzard's 1000 Essential Films";

    var totalDirectors = langData.directors.length;
    var sortedDirectors = langData.directors.slice().sort(function(a, b) {
      var nameA = a.name.replace(/[^a-zA-ZÀ-ÿ]/g, "");
      var nameB = b.name.replace(/[^a-zA-ZÀ-ÿ]/g, "");
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });

    var html = '<h2 class="page-title">' + escapeHtml(labels.directors) + "</h2>";
    html += '<p class="intro">' + totalDirectors + " " + escapeHtml(labels.directorsCount) + "</p>";

    html += renderLegend(true);
    html += renderTierFilter();

    // ── Index alphabétique ──
    var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    var presentLetters = {};
    for (var d = 0; d < sortedDirectors.length; d++) {
      var firstChar = sortedDirectors[d].name.charAt(0).toUpperCase();
      presentLetters[firstChar] = true;
    }
    html += '<div class="alpha-index">';
    for (var a = 0; a < alphabet.length; a++) {
      var letter = alphabet[a];
      if (presentLetters[letter]) {
        html += '<button class="alpha-letter" data-letter="' + letter + '" aria-label="' + (currentLang === "fr" ? "Aller à la lettre " : "Go to letter ") + letter + '">' + letter + '</button>';
      } else {
        html += '<span class="alpha-letter alpha-letter--disabled">' + letter + '</span>';
      }
    }
    html += '</div>';

    for (var i = 0; i < sortedDirectors.length; i++) {
      var director = sortedDirectors[i];
      if (!director.films) { director.films = []; }
      var filmWord = director.films.length === 1 ? labels.filmSingular : labels.films;
      var dirLetter = director.name.charAt(0).toUpperCase();

      html += '<div class="director-group" id="dir-' + dirLetter + '-' + i + '">';
      if (i === 0 || sortedDirectors[i - 1].name.charAt(0).toUpperCase() !== dirLetter) {
        html += '<div id="dir-' + dirLetter + '"></div>';
      }
      var dirDisplayName;
      if (director.firstname) {
        dirDisplayName = escapeHtml(director.name) +
          '<span class="director-firstname">, ' + escapeHtml(director.firstname) + '</span>';
      } else if (director.name.indexOf(", ") !== -1) {
        var parts = director.name.split(", ");
        dirDisplayName = escapeHtml(parts[0]) +
          '<span class="director-firstname">, ' + escapeHtml(parts.slice(1).join(", ")) + '</span>';
      } else {
        dirDisplayName = escapeHtml(director.name);
      }

      var portraitHtml = "";
      if (director.portrait) {
        if (director.name === "Straub/Huillet") {
          portraitHtml =
            '<img class="director-portrait director-portrait--duo" src="' + basePath + '/portraits/portrait-Straub.jpg" alt="">' +
            '<img class="director-portrait director-portrait--duo" src="' + basePath + '/portraits/portrait-Huillet.jpg" alt="">';
        } else {
          var portraitFileName = director.portraitFile || director.name;
          var portraitPath = basePath + "/portraits/portrait-" + encodeURIComponent(portraitFileName) + ".jpg";
          portraitHtml = '<img class="director-portrait" src="' + portraitPath + '" alt="">';
        }
      }

      html += portraitHtml;
      html +=
        '<h3 class="director-heading">' +
        dirDisplayName +
        ' <span class="film-count">(' + director.films.length + " " + filmWord + ")</span>" +
        "</h3>";
      html += '<ul class="film-list">';
      for (var j = 0; j < director.films.length; j++) {
        html += renderFilmItem(director.films[j]);
      }
      html += "</ul></div>";
    }

    document.getElementById("main-content").innerHTML = html;
    bindTierFilter();

    // Binding de l'index alphabétique
    document.querySelectorAll(".alpha-letter[data-letter]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var target = document.getElementById("dir-" + this.dataset.letter);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  /**
   * Affiche la page d'une décennie.
   * @param {string} key - clé de la décennie (ex: "1960s")
   */
  function renderDecadePage(key) {
    var langData = data[currentLang];
    var decade   = null;

    for (var i = 0; i < langData.decades.length; i++) {
      if (langData.decades[i].key === key) {
        decade = langData.decades[i];
        break;
      }
    }

    if (!decade) {
      renderHomePage();
      return;
    }

    document.getElementById("mainNav").innerHTML = renderNav(key);
    document.title = decade.label + " — Mathieu Muzard's 1000 Essential Films";

    var html = '<h2 class="decade-title">' + escapeHtml(decade.label) + "</h2>";
    html += renderLegend(false);
    html += renderTierFilter();

    for (var y = 0; y < decade.years.length; y++) {
      var yearGroup = decade.years[y];
      html += '<div class="year-group">';
      html += '<h3 class="year-heading">' + escapeHtml(yearGroup.year) + "</h3>";
      html += '<ul class="film-list">';
      for (var f = 0; f < yearGroup.films.length; f++) {
        html += renderFilmItem(yearGroup.films[f]);
      }
      html += "</ul></div>";
    }

    // Navigation précédente / suivante
    var decadeIndex = decadeKeys.indexOf(key);
    html += '<div class="decade-nav">';

    if (decadeIndex > 0) {
      var prevKey = decadeKeys[decadeIndex - 1];
      html +=
        '<a href="' + basePath + "/" + prevKey + '" data-page="' + prevKey + '">' +
        "&larr; " + escapeHtml(getDecadeLabel(prevKey)) +
        "</a>";
    } else {
      html += "<span></span>";
    }

    if (decadeIndex < decadeKeys.length - 1) {
      var nextKey = decadeKeys[decadeIndex + 1];
      html +=
        '<a href="' + basePath + "/" + nextKey + '" data-page="' + nextKey + '">' +
        escapeHtml(getDecadeLabel(nextKey)) + " &rarr;" +
        "</a>";
    } else {
      html += "<span></span>";
    }

    html += "</div>";
    document.getElementById("main-content").innerHTML = html;
    bindTierFilter();
  }

  // ── Légende ──────────────────────────────────────────────────

  /**
   * Génère le HTML du bloc légende (Top 100 / 200 / 300 / 1000).
   */
  function renderLegend(isDirectorsPage) {
    var items = [
      { tier: "top-100",  cls: "green",  label: "Top 100" },
      { tier: "top-200",  cls: "blue",   label: "Top 200" },
      { tier: "top-300",  cls: "brown",  label: "Top 300" },
      { tier: "top-rest", cls: "black",  label: "Top 1000" }
    ];
    var html = '<div class="legend' + (isDirectorsPage ? ' legend--filterable" role="group" aria-label="Filtrer par tier"' : '"') + '>';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (isDirectorsPage) {
        html += '<button class="legend-item legend-btn" data-tier="' + item.tier + '" aria-pressed="false">' +
          '<span class="legend-dot ' + item.cls + '"></span> ' + item.label +
          '</button>';
      } else {
        html += '<span class="legend-item"><span class="legend-dot ' + item.cls + '"></span> ' + item.label + '</span>';
      }
    }
    html += '</div>';
    return html;
  }

  // ── Routeur ──────────────────────────────────────────────────

  /**
   * Retourne la clé de page courante à partir de l'URL.
   */
  var validPages = ["home", "about", "directors",
    "silents", "1930s", "1940s", "1950s",
    "1960s", "1970s", "1980s", "1990s", "2000s", "2010s"];

  function getCurrentPage() {
    var page = window.location.pathname
      .replace(basePath, "")
      .replace(/^\//, "")
      .replace(/\/$/, "") || "home";
    return validPages.indexOf(page) !== -1 ? page : "home";
  }

  /**
   * Navigue vers une page et met à jour l'historique du navigateur.
   */
  function navigateTo(pageKey) {
    var targetPath = basePath + (pageKey === "home" ? "/" : "/" + pageKey);
    if (window.location.pathname !== targetPath) {
      history.pushState(null, "", targetPath);
    }
    renderCurrentPage();
  }

  /**
   * Lit l'URL courante et affiche la bonne page, avec une transition en fondu.
   */
  function renderCurrentPage() {
    var page         = getCurrentPage();
    var previousPage = renderCurrentPage._currentPage || "home";

    renderCurrentPage._scrollPositions = renderCurrentPage._scrollPositions || {};
    renderCurrentPage._scrollPositions[previousPage] = window.scrollY;
    renderCurrentPage._currentPage = page;

    document.body.style.opacity = "0";

    if (transitionTimeoutId) clearTimeout(transitionTimeoutId);
    transitionTimeoutId = setTimeout(function () {
      if (page === "home" || page === "") {
        renderHomePage();
      } else if (page === "about") {
        renderAboutPage();
      } else if (page === "directors") {
        renderDirectorsPage();
      } else if (decadeKeys.indexOf(page) !== -1) {
        renderDecadePage(page);
      } else {
        renderHomePage();
      }

      // Renouveler le banner à chaque changement de page
      initMosaicBanner();

      // Réattacher le switcher de langue après chaque rendu
      bindLangSwitch();

      // Réattacher les liens de navigation après chaque rendu
      bindNavLinks();

      // Restaurer la position de défilement
      var savedScroll = renderCurrentPage._scrollPositions[page] || 0;
      window.scrollTo(0, savedScroll);

      var announcer = document.getElementById("page-announcer");
      if (announcer) announcer.textContent = document.title;

      requestAnimationFrame(function () {
        document.body.style.opacity = "1";
      });
    }, 350);
  }

  // ── Liaisons d'événements ────────────────────────────────────

  /**
   * Attache le clic sur le bouton de changement de langue.
   */
  function bindLangSwitch() {
    var btn = document.getElementById("langSwitch");
    if (!btn) return;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      currentLang = currentLang === "fr" ? "en" : "fr";
      localStorage.setItem("lang", currentLang);
      document.documentElement.lang = currentLang;
      renderCurrentPage();
    });
  }

  /**
   * Attache les clics sur tous les liens [data-page] pour la navigation SPA.
   */
  function bindNavLinks() {
    document.querySelectorAll("a[data-page]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var targetPage = this.dataset.page;
        if (getCurrentPage() === targetPage) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          navigateTo(targetPage);
        }
      });
    });
  }

  /**
   * Swipe gauche/droite sur mobile pour naviguer entre les décennies.
   */
  function initSwipe() {
    var touchStartX = 0;
    var touchEndX   = 0;
    var threshold   = 60; // px minimum pour déclencher la navigation

    document.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener("touchend", function (e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff  = touchStartX - touchEndX;

      if (Math.abs(diff) < threshold) return;

      var page = getCurrentPage();
      var idx  = decadeKeys.indexOf(page);
      if (idx === -1) return;

      if (diff > 0 && idx < decadeKeys.length - 1) {
        // Swipe gauche → décennie suivante
        navigateTo(decadeKeys[idx + 1]);
      } else if (diff < 0 && idx > 0) {
        // Swipe droite → décennie précédente
        navigateTo(decadeKeys[idx - 1]);
      }
    }, { passive: true });
  }

  /**
   * Initialise le bouton "retour en haut".
   */
  function initBackToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn) return;
    var scrollTicking = false;
    window.addEventListener("scroll", function () {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(function () {
        btn.style.opacity       = window.scrollY > 400 ? "1" : "0";
        btn.style.pointerEvents = window.scrollY > 400 ? "auto" : "none";
        scrollTicking = false;
      });
    }, { passive: true });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /**
   * Initialise le bouton dark mode.
   */
  function initDarkMode() {
    var btn = document.getElementById("darkModeToggle");
    if (!btn) return;
    var isDark = localStorage.getItem("darkMode") === "true";
    if (isDark) document.body.classList.add("dark-mode");
    btn.textContent = isDark ? "☀" : "☽";
    btn.setAttribute("aria-label", isDark ? i18n[currentLang].darkMode + " (désactiver)" : i18n[currentLang].darkMode);
    btn.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
      var nowDark = document.body.classList.contains("dark-mode");
      localStorage.setItem("darkMode", nowDark);
      btn.textContent = nowDark ? "☀" : "☽";
      btn.setAttribute("aria-label", nowDark ? i18n[currentLang].darkMode + " (désactiver)" : i18n[currentLang].darkMode);
    });
  }

  /**
   * Initialise le menu hamburger (mobile).
   */
  function initHamburgerMenu() {
    var toggleBtn = document.getElementById("navToggle");
    var nav       = document.getElementById("mainNav");
    if (!toggleBtn || !nav) return;

    function closeMenu() {
      nav.classList.remove("open");
      toggleBtn.classList.remove("open");
      toggleBtn.setAttribute("aria-expanded", "false");
    }

    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle("open");
      toggleBtn.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeMenu();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && nav.classList.contains("open")) {
        closeMenu();
        toggleBtn.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== toggleBtn) {
        closeMenu();
      }
    });
  }

  /**
   * Remplit le banner mosaïque avec 6 photos aléatoires.
   *
   * Algorithme :
   * 1. Récupérer la mémoire des photos déjà affichées (sessionStorage, max 30 entrées)
   * 2. Construire un pool [1..100] mélangé aléatoirement (Fisher-Yates)
   * 3. Trier le pool : photos jamais vues en premier, déjà vues en dernier
   * 4. Lancer 6 chargements en parallèle — chacun pioche dans le pool via un curseur partagé
   * 5. En cas d'image manquante (onerror), relancer un chargement pour la remplacer
   * 6. Mettre à jour la mémoire au fil des chargements réussis
   */
  function initMosaicBanner() {
    var banner = document.getElementById("mosaic-banner");
    if (!banner) return;

    // Vider le banner avant de le reremplir
    while (banner.firstChild) banner.removeChild(banner.firstChild);

    // 1. Récupérer la mémoire des photos déjà affichées dans cette session
    var memory = [];
    try {
      memory = JSON.parse(sessionStorage.getItem("bannerMemory") || "[]");
    } catch (e) {
      memory = [];
    }

    // 2. Construire un pool [1..100] et le mélanger (Fisher-Yates)
    var pool = [];
    for (var i = 1; i <= 100; i++) pool.push(i);
    for (var j = pool.length - 1; j > 0; j--) {
      var rand = Math.floor(Math.random() * (j + 1));
      var tmp  = pool[j];
      pool[j]  = pool[rand];
      pool[rand] = tmp;
    }

    // 3. Séparer les photos jamais vues (en premier) des déjà vues (en dernier)
    var unseen = [];
    var seen   = [];
    for (var m = 0; m < pool.length; m++) {
      if (memory.indexOf(pool[m]) === -1) {
        unseen.push(pool[m]);
      } else {
        seen.push(pool[m]);
      }
    }
    var ordered = unseen.concat(seen);

    // 4. Préfixe de chemin basé sur basePath
    var prefix = basePath + "/";

    // 5. Lancer 6 chargements en parallèle
    // cursor est partagé : chaque appel à loadOne() prend le prochain index disponible
    var loaded = [];
    var cursor = 0;

    function loadOne() {
      if (cursor >= ordered.length) return;

      var photoIndex = ordered[cursor];
      cursor++;

      var img = document.createElement("img");
      var num = String(photoIndex);

      img.src = prefix + "images/photo (" + num + ").jpg";
      img.alt = "";

      // 7. Mise à jour de la mémoire à chaque chargement réussi
      img.onload = function () {
        var currentMemory = [];
        try {
          currentMemory = JSON.parse(sessionStorage.getItem("bannerMemory") || "[]");
        } catch (e) {}
        currentMemory.push(photoIndex);
        if (currentMemory.length > 30) {
          currentMemory = currentMemory.slice(currentMemory.length - 30);
        }
        try {
          sessionStorage.setItem("bannerMemory", JSON.stringify(currentMemory));
        } catch (e) {}
      };

      // 6. Photo manquante : retirer du banner et charger un remplaçant
      img.onerror = function () {
        banner.removeChild(img);
        loadOne();
      };

      // Ajouter immédiatement au banner (parallèle)
      banner.appendChild(img);
    }

    // Lancer les 6 chargements simultanément (4 sur mobile)
    var imageCount = window.innerWidth <= 600 ? 4 : 6;
    for (var t = 0; t < imageCount; t++) loadOne();

    // Précharger discrètement les 12 images suivantes en arrière-plan
    // pour qu'elles soient dans le cache du navigateur au prochain changement de page
    var preloadCache = [];
    setTimeout(function () {
      for (var p = 0; p < 12; p++) {
        if (cursor >= ordered.length) break;
        var nextIndex = ordered[cursor];
        cursor++;
        var nextNum = String(nextIndex);
        var preload = new Image();
        preload.src = prefix + "images/photo (" + nextNum + ").jpg";
        preloadCache.push(preload);
      }
    }, 500); // Attendre 500ms que les images visibles soient chargées en priorité
  }

  // ── Initialisation ───────────────────────────────────────────

  /**
   * Point d'entrée : chargement des données puis initialisation de l'app.
   */
  function init() {
    document.body.style.opacity      = "0";
    document.body.style.transition   = "opacity 0.4s ease, background-color 0.4s, color 0.4s";
    document.documentElement.lang    = currentLang;

    // Gérer une éventuelle redirection (ex: depuis 404.html)
    var redirect = sessionStorage.getItem("redirect");
    sessionStorage.removeItem("redirect");
    if (redirect && validPages.indexOf(redirect) !== -1) {
      history.replaceState(null, "", basePath + "/" + redirect);
    }

    var fetchController = new AbortController();
    var fetchTimeout = setTimeout(function () { fetchController.abort(); }, 10000);

    fetch(basePath + "/data.json", { signal: fetchController.signal })
      .then(function (response) {
        clearTimeout(fetchTimeout);
        return response.json();
      })
      .then(function (json) {
        if (!json || !json.fr || !json.en || !json.fr.decades || !json.fr.directors) {
          document.getElementById("main-content").innerHTML =
            '<p style="padding:2rem;text-align:center;color:var(--text-light)">Erreur : données manquantes ou corrompues.</p>';
          document.body.style.opacity = "1";
          return;
        }
        data = json;

        initMosaicBanner();
        initHamburgerMenu();
        initBackToTop();
        initDarkMode();
        initSwipe();

        renderCurrentPage();

        // Gérer le bouton retour/avant du navigateur
        window.addEventListener("popstate", renderCurrentPage);
      })
      .catch(function () {
        // Message d'erreur si data.json est inaccessible
        document.getElementById("main-content").innerHTML =
          '<p style="padding:2rem;text-align:center;color:var(--text-light)">' +
          "Erreur de chargement des données. Veuillez recharger la page." +
          "</p>";
        document.body.style.opacity = "1";
      });
  }

  // Lancer l'initialisation dès que le DOM est prêt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
