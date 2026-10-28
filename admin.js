(function () {
  "use strict";

  // Configuration Supabase (projet "Topscineastes", table top1000)
  // Identique à app.js : la clé anon est publique par conception, les
  // droits d'écriture sont contrôlés par les policies RLS côté base.
  var SUPABASE_URL = "https://afbdrqrslgduomimkmyt.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmRycXJzbGdkdW9taW1rbXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTExMTEsImV4cCI6MjA5NTk4NzExMX0.uvOvP-2cfgrIPdOrThLERwOGKid8OYExq1xro-5TAb8";

  // Clé de stockage de la session administrateur
  var SESSION_KEY = "top1000AdminSession";

  // Nombre de lignes récupérées par requête (la table est lue par pages
  // pour ne pas dépendre de la limite de lignes de l'API REST)
  var PAGE_SIZE = 1000;

  // Session courante : { access_token, refresh_token, expires_at }
  var session = null;

  // Lignes de top1000, triées comme sur le site (année puis ordre)
  var films = [];

  // Lignes de top1000_decades, triées par ordre d'affichage
  var decades = [];

  // Film en attente de confirmation de suppression
  var pendingDelete = null;

  // Timeout d'effacement de la bannière de statut
  var bannerTimeoutId = null;

  // Dernières valeurs recopiées automatiquement dans les crédits
  // affichés, pour savoir si l'utilisateur les a repris à la main
  var autoCredit = { fr: null, en: null };

  // Libellés courts des tiers pour la colonne du tableau
  var tierLabels = {
    "top-100": "Top 100",
    "top-200": "Top 200",
    "top-300": "Top 300",
    "top-rest": "Top 1000"
  };

  // ── Utilitaires ──────────────────────────────────────────────

  /**
   * Raccourci sur document.getElementById.
   */
  function el(id) {
    return document.getElementById(id);
  }

  /**
   * Échappe une chaîne pour l'insérer sans risque dans du HTML.
   * Protection contre les injections XSS.
   */
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str === null || str === undefined ? "" : String(str);
    return div.innerHTML;
  }

  /**
   * Retourne la valeur d'un champ, débarrassée de ses espaces de bord.
   */
  function fieldValue(id) {
    var node = el(id);
    return node && node.value ? node.value.trim() : "";
  }

  /**
   * Comme fieldValue, mais renvoie null si le champ est vide : les
   * colonnes optionnelles de la table acceptent NULL, pas "".
   */
  function fieldValueOrNull(id) {
    var value = fieldValue(id);
    return value === "" ? null : value;
  }

  /**
   * Minuscule sans accents, pour une recherche tolérante.
   */
  function normalize(str) {
    var value = str === null || str === undefined ? "" : String(str);
    if (value.normalize) {
      value = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
    return value.toLowerCase();
  }

  /**
   * Affiche un message temporaire en tête de l'interface.
   */
  function showBanner(message, isError) {
    var banner = el("statusBanner");
    banner.textContent = message;
    banner.className = "admin-banner " + (isError ? "admin-banner--error" : "admin-banner--success");
    banner.hidden = false;
    clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(function () { banner.hidden = true; }, 5000);
  }

  /**
   * Affiche ou masque un paragraphe d'erreur (connexion, formulaire).
   */
  function showErrorText(id, message) {
    var node = el(id);
    if (message) {
      node.textContent = message;
      node.hidden = false;
    } else {
      node.textContent = "";
      node.hidden = true;
    }
  }

  /**
   * Libellé d'une décennie à partir de sa clé.
   */
  function getDecadeLabel(key) {
    for (var i = 0; i < decades.length; i++) {
      if (decades[i].cle === key) { return decades[i].label_fr; }
    }
    return key;
  }

  /**
   * Nom du réalisateur tel qu'affiché dans le tableau.
   */
  function getDirectorLabel(film) {
    if (film.prenom_realisateur) {
      return film.prenom_realisateur + " " + film.realisateur_fr;
    }
    return film.realisateur_fr;
  }

  /**
   * Trie les films dans l'ordre d'affichage du site.
   */
  function sortFilms() {
    films.sort(function (a, b) {
      return a.annee - b.annee || a.ordre - b.ordre || a.id - b.id;
    });
  }

  // ── Session et authentification ──────────────────────────────

  /**
   * Relit la session stockée localement, ou null si elle est absente
   * ou illisible.
   */
  function loadSession() {
    try {
      var stored = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (stored && stored.access_token && stored.refresh_token) { return stored; }
    } catch (error) {
      // Session corrompue : on repart d'une connexion propre
    }
    return null;
  }

  /**
   * Mémorise la session renvoyée par l'API d'authentification.
   */
  function saveSession(payload) {
    session = {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at
        ? payload.expires_at * 1000
        : Date.now() + (payload.expires_in || 3600) * 1000
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      // Stockage indisponible : la session ne survivra pas au rechargement
    }
    return session;
  }

  /**
   * Oublie la session courante.
   */
  function clearSession() {
    session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Rien à faire : la session en mémoire est déjà effacée
    }
  }

  /**
   * Appelle l'API d'authentification (connexion par mot de passe ou
   * renouvellement du jeton).
   */
  function authRequest(grantType, body) {
    return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=" + grantType, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (error) { payload = null; }
        if (!response.ok) {
          var message = payload &&
            (payload.error_description || payload.msg || payload.message || payload.error);
          if (!message && response.status === 400) {
            message = "Email ou mot de passe incorrect.";
          }
          throw new Error(message || "Échec de l'authentification (" + response.status + ").");
        }
        if (!payload || !payload.access_token) {
          throw new Error("Réponse d'authentification inattendue.");
        }
        return payload;
      });
    });
  }

  /**
   * Garantit un jeton d'accès valide, en le renouvelant si nécessaire.
   */
  function ensureToken() {
    if (!session) {
      return Promise.reject(new Error("Session expirée. Reconnectez-vous."));
    }
    if (session.expires_at - Date.now() > 60000) {
      return Promise.resolve(session.access_token);
    }
    return authRequest("refresh_token", { refresh_token: session.refresh_token })
      .then(function (payload) { return saveSession(payload).access_token; })
      .catch(function () {
        handleSessionLoss("Session expirée. Reconnectez-vous.");
        throw new Error("Session expirée. Reconnectez-vous.");
      });
  }

  // ── Accès aux données ────────────────────────────────────────

  /**
   * Construit un message lisible à partir d'une erreur de l'API REST.
   */
  function restErrorMessage(response, payload) {
    if (response.status === 401) { return "Session expirée. Reconnectez-vous."; }
    if (response.status === 403) {
      return "Droits insuffisants : ce compte n'est pas administrateur.";
    }
    if (payload && payload.message) { return payload.message; }
    return "Erreur " + response.status + " lors de l'accès à la base.";
  }

  /**
   * Requête authentifiée sur l'API REST de Supabase.
   * @param {string} path - chemin après /rest/v1/
   * @param {Object} [options] - method, body, prefer, range
   */
  function api(path, options) {
    var opts = options || {};
    return ensureToken().then(function (token) {
      var headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + token
      };
      if (opts.body) { headers["Content-Type"] = "application/json"; }
      if (opts.prefer) { headers.Prefer = opts.prefer; }
      if (opts.range) {
        headers["Range-Unit"] = "items";
        headers.Range = opts.range[0] + "-" + opts.range[1];
      }
      return fetch(SUPABASE_URL + "/rest/v1/" + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    }).then(function (response) {
      if (response.status === 204) { return null; }
      return response.text().then(function (text) {
        var payload = null;
        try { payload = text ? JSON.parse(text) : null; } catch (error) { payload = null; }
        if (!response.ok) {
          var message = restErrorMessage(response, payload);
          // Jeton refusé : la session n'est plus utilisable
          if (response.status === 401) { handleSessionLoss(message); }
          throw new Error(message);
        }
        return payload;
      });
    });
  }

  /**
   * Vérifie que le compte connecté est bien administrateur, via la même
   * fonction que celle utilisée par les policies RLS de la table.
   */
  function checkIsAdmin() {
    return api("rpc/tc_est_admin", { method: "POST", body: {} })
      .then(function (result) { return result === true; });
  }

  /**
   * Lit toute la table des films, page par page, pour ne pas dépendre
   * du nombre maximal de lignes renvoyées par une seule requête.
   */
  function fetchAllFilms() {
    var collected = [];
    function fetchPage(offset) {
      return api("top1000?select=*&order=annee.asc,ordre.asc,id.asc", {
        range: [offset, offset + PAGE_SIZE - 1]
      }).then(function (rows) {
        if (!rows || !rows.length) { return collected; }
        collected = collected.concat(rows);
        if (rows.length < PAGE_SIZE) { return collected; }
        return fetchPage(offset + PAGE_SIZE);
      });
    }
    return fetchPage(0);
  }

  /**
   * Charge films et décennies, puis rafraîchit l'interface.
   */
  function loadData() {
    return Promise.all([
      fetchAllFilms(),
      api("top1000_decades?select=*&order=ordre.asc")
    ]).then(function (results) {
      films = results[0] || [];
      decades = results[1] || [];
      sortFilms();
      fillDecadeSelect();
      renderTable();
    });
  }

  // ── Rendu ────────────────────────────────────────────────────

  /**
   * Remplit la liste déroulante des décennies du formulaire.
   */
  function fillDecadeSelect() {
    var select = el("f_decennie");
    var html = "";
    for (var i = 0; i < decades.length; i++) {
      html += '<option value="' + escapeHtml(decades[i].cle) + '">' +
        escapeHtml(decades[i].label_fr) + "</option>";
    }
    select.innerHTML = html;
  }

  /**
   * Films correspondant à la recherche en cours.
   */
  function getVisibleFilms() {
    var query = normalize(fieldValue("searchInput"));
    if (query === "") { return films; }
    var terms = query.split(/\s+/);
    return films.filter(function (film) {
      var haystack = normalize([
        film.titre_fr,
        film.titre_en,
        film.realisateur_fr,
        film.realisateur_en,
        film.prenom_realisateur,
        film.credit_decennie_fr,
        film.credit_decennie_en,
        film.annee
      ].join(" "));
      for (var i = 0; i < terms.length; i++) {
        if (haystack.indexOf(terms[i]) === -1) { return false; }
      }
      return true;
    });
  }

  /**
   * Redessine le tableau des films et le compteur de résultats.
   */
  function renderTable() {
    var visible = getVisibleFilms();
    var html = "";

    for (var i = 0; i < visible.length; i++) {
      var film = visible[i];
      html += "<tr>" +
        "<td>" + escapeHtml(film.annee) + "</td>" +
        "<td>" + escapeHtml(film.titre_fr) + "</td>" +
        "<td>" + escapeHtml(getDirectorLabel(film)) + "</td>" +
        "<td>" + escapeHtml(getDecadeLabel(film.decennie)) + "</td>" +
        "<td>" + escapeHtml(tierLabels[film.tier] || film.tier) + "</td>" +
        '<td><div class="admin-row-actions">' +
          '<button type="button" data-action="edit" data-id="' + escapeHtml(film.id) + '">Modifier</button>' +
          '<button type="button" data-action="delete" data-id="' + escapeHtml(film.id) + '">Supprimer</button>' +
        "</div></td>" +
        "</tr>";
    }

    if (visible.length === 0) {
      html = '<tr><td colspan="6" class="admin-hint">Aucun film ne correspond à cette recherche.</td></tr>';
    }

    el("filmsTableBody").innerHTML = html;

    var count = visible.length === films.length
      ? films.length + (films.length > 1 ? " films" : " film")
      : visible.length + " / " + films.length + " films";
    el("resultCount").textContent = count;
  }

  // ── Formulaire d'ajout et d'édition ──────────────────────────

  /**
   * Retrouve un film chargé à partir de son identifiant.
   */
  function findFilm(id) {
    for (var i = 0; i < films.length; i++) {
      if (String(films[i].id) === String(id)) { return films[i]; }
    }
    return null;
  }

  /**
   * Ouvre le formulaire, vide pour un ajout, prérempli pour une édition.
   */
  function openFilmModal(film) {
    showErrorText("formError", "");
    autoCredit = { fr: null, en: null };
    el("filmModalTitle").textContent = film ? "Modifier le film" : "Ajouter un film";
    el("f_id").value = film ? film.id : "";
    el("f_titre_fr").value = film ? film.titre_fr : "";
    el("f_titre_en").value = film ? film.titre_en : "";
    el("f_annee").value = film ? film.annee : "";
    el("f_decennie").value = film && film.decennie ? film.decennie : (decades.length ? decades[0].cle : "");
    el("f_ordre").value = film ? film.ordre : 0;
    el("f_tier").value = film ? film.tier : "top-rest";
    el("f_realisateur_fr").value = film ? film.realisateur_fr : "";
    el("f_realisateur_en").value = film ? film.realisateur_en : "";
    el("f_prenom_realisateur").value = film && film.prenom_realisateur ? film.prenom_realisateur : "";
    el("f_portrait").checked = film ? film.portrait === true : false;
    el("f_portrait_file").value = film && film.portrait_file ? film.portrait_file : "";
    el("f_credit_decennie_fr").value = film ? film.credit_decennie_fr : "";
    el("f_credit_decennie_en").value = film ? film.credit_decennie_en : "";
    el("f_note_fr").value = film && film.note_fr ? film.note_fr : "";
    el("f_note_en").value = film && film.note_en ? film.note_en : "";
    el("filmModal").hidden = false;
    el("f_titre_fr").focus();
  }

  /**
   * Ferme le formulaire.
   */
  function closeFilmModal() {
    el("filmModal").hidden = true;
    showErrorText("formError", "");
  }

  /**
   * Clé de décennie correspondant à une année, déduite de la table
   * top1000_decades : les clés numérotées ("1930s") couvrent dix ans,
   * les années antérieures tombent dans la première décennie (muet) et
   * les années postérieures dans la dernière.
   */
  function decadeKeyForYear(year) {
    if (!decades.length || isNaN(year)) { return ""; }
    var match = null;
    for (var i = 0; i < decades.length; i++) {
      var start = parseInt(decades[i].cle, 10);
      if (isNaN(start)) { continue; }
      if (year >= start) { match = decades[i].cle; }
    }
    return match || decades[0].cle;
  }

  /**
   * Aligne la décennie sur l'année saisie. La liste reste modifiable
   * ensuite : un choix fait après la saisie de l'année est conservé.
   */
  function syncDecadeToYear() {
    var key = decadeKeyForYear(parseInt(fieldValue("f_annee"), 10));
    if (key) { el("f_decennie").value = key; }
  }

  /**
   * Recopie le nom du réalisateur dans le crédit affiché, tant que
   * celui-ci est vide ou n'a pas été repris à la main : les deux
   * valeurs sont identiques dans la quasi-totalité de la table.
   */
  function syncCreditToDirector(lang) {
    var director = fieldValue("f_realisateur_" + lang);
    var credit = el("f_credit_decennie_" + lang);
    if (credit.value.trim() === "" || credit.value === autoCredit[lang]) {
      credit.value = director;
      autoCredit[lang] = director;
    }
  }

  /**
   * Construit la ligne à envoyer à la base depuis les champs du
   * formulaire. Lève une erreur si une valeur obligatoire manque.
   */
  function collectFilmPayload() {
    var annee = parseInt(fieldValue("f_annee"), 10);
    if (isNaN(annee)) { throw new Error("L'année doit être un nombre."); }

    var ordre = parseInt(fieldValue("f_ordre"), 10);
    if (isNaN(ordre)) { ordre = 0; }

    var payload = {
      annee: annee,
      decennie: fieldValue("f_decennie"),
      ordre: ordre,
      tier: fieldValue("f_tier"),
      titre_fr: fieldValue("f_titre_fr"),
      titre_en: fieldValue("f_titre_en"),
      realisateur_fr: fieldValue("f_realisateur_fr"),
      realisateur_en: fieldValue("f_realisateur_en"),
      prenom_realisateur: fieldValueOrNull("f_prenom_realisateur"),
      portrait: el("f_portrait").checked,
      portrait_file: fieldValueOrNull("f_portrait_file"),
      credit_decennie_fr: fieldValue("f_credit_decennie_fr"),
      credit_decennie_en: fieldValue("f_credit_decennie_en"),
      note_fr: fieldValueOrNull("f_note_fr"),
      note_en: fieldValueOrNull("f_note_en")
    };

    var required = [
      "decennie", "tier", "titre_fr", "titre_en", "realisateur_fr",
      "realisateur_en", "credit_decennie_fr", "credit_decennie_en"
    ];
    for (var i = 0; i < required.length; i++) {
      if (payload[required[i]] === "") {
        throw new Error("Tous les champs marqués d'une étoile doivent être remplis.");
      }
    }

    return payload;
  }

  /**
   * Enregistre l'ajout ou la modification en cours.
   */
  function submitFilmForm(event) {
    event.preventDefault();

    var payload;
    try {
      payload = collectFilmPayload();
    } catch (error) {
      showErrorText("formError", error.message);
      return;
    }

    var id = el("f_id").value;
    var isEdit = id !== "";
    var submitBtn = el("filmForm").querySelector('button[type="submit"]');

    showErrorText("formError", "");
    submitBtn.disabled = true;
    submitBtn.textContent = "Enregistrement…";

    var request = isEdit
      ? api("top1000?id=eq." + encodeURIComponent(id), {
          method: "PATCH", body: payload, prefer: "return=representation"
        })
      : api("top1000", {
          method: "POST", body: payload, prefer: "return=representation"
        });

    request.then(function (rows) {
      var saved = rows && rows.length ? rows[0] : null;
      if (!saved) {
        throw new Error("Enregistrement refusé par la base : droits insuffisants ?");
      }
      if (isEdit) {
        var existing = findFilm(saved.id);
        if (existing) { films[films.indexOf(existing)] = saved; }
      } else {
        films.push(saved);
      }
      sortFilms();
      closeFilmModal();
      renderTable();
      showBanner(isEdit ? "Film modifié." : "Film ajouté.", false);
    }).catch(function (error) {
      showErrorText("formError", error.message);
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enregistrer";
    });
  }

  // ── Suppression ──────────────────────────────────────────────

  /**
   * Ouvre la demande de confirmation de suppression.
   */
  function openDeleteModal(film) {
    pendingDelete = film;
    el("deleteFilmLabel").textContent =
      film.titre_fr + " (" + film.annee + ") — " + getDirectorLabel(film);
    el("deleteModal").hidden = false;
    el("cancelDeleteBtn").focus();
  }

  /**
   * Ferme la demande de confirmation.
   */
  function closeDeleteModal() {
    el("deleteModal").hidden = true;
    pendingDelete = null;
  }

  /**
   * Supprime définitivement le film confirmé.
   */
  function confirmDelete() {
    if (!pendingDelete) { return; }

    var film = pendingDelete;
    var button = el("confirmDeleteBtn");
    button.disabled = true;
    button.textContent = "Suppression…";

    api("top1000?id=eq." + encodeURIComponent(film.id), {
      method: "DELETE",
      prefer: "return=representation"
    }).then(function (rows) {
      if (!rows || !rows.length) {
        throw new Error("Suppression refusée par la base : droits insuffisants ?");
      }
      var existing = findFilm(film.id);
      if (existing) { films.splice(films.indexOf(existing), 1); }
      closeDeleteModal();
      renderTable();
      showBanner("Film supprimé.", false);
    }).catch(function (error) {
      closeDeleteModal();
      showBanner(error.message, true);
    }).then(function () {
      button.disabled = false;
      button.textContent = "Supprimer définitivement";
    });
  }

  // ── Écrans ───────────────────────────────────────────────────

  /**
   * Affiche l'écran de connexion.
   */
  function showLoginScreen(message) {
    el("adminScreen").hidden = true;
    el("loginScreen").hidden = false;
    el("logoutBtn").hidden = true;
    el("loginPassword").value = "";
    showErrorText("loginError", message || "");
  }

  /**
   * Ramène à l'écran de connexion quand la session n'est plus valide.
   */
  function handleSessionLoss(message) {
    clearSession();
    films = [];
    closeFilmModal();
    closeDeleteModal();
    showLoginScreen(message);
  }

  /**
   * Vérifie les droits puis affiche l'interface d'administration.
   * Un échec de vérification renvoie à la connexion ; un échec du seul
   * chargement des données (réseau, base indisponible) conserve la
   * session et se contente de signaler l'erreur.
   */
  function showAdminScreen() {
    return checkIsAdmin().then(function (isAdmin) {
      if (!isAdmin) {
        handleSessionLoss("Ce compte n'est pas administrateur.");
        return;
      }
      el("loginScreen").hidden = true;
      el("adminScreen").hidden = false;
      el("logoutBtn").hidden = false;
      return loadData().catch(function (error) {
        showBanner("Chargement des films impossible : " + error.message, true);
      });
    }).catch(function (error) {
      handleSessionLoss(error.message);
    });
  }

  /**
   * Traite l'envoi du formulaire de connexion.
   */
  function submitLoginForm(event) {
    event.preventDefault();

    var button = el("loginForm").querySelector('button[type="submit"]');
    showErrorText("loginError", "");
    button.disabled = true;
    button.textContent = "Connexion…";

    authRequest("password", {
      email: fieldValue("loginEmail"),
      password: el("loginPassword").value
    }).then(function (payload) {
      saveSession(payload);
      return showAdminScreen();
    }).catch(function (error) {
      clearSession();
      showErrorText("loginError", error.message);
    }).then(function () {
      button.disabled = false;
      button.textContent = "Se connecter";
    });
  }

  /**
   * Déconnecte le compte courant.
   */
  function logout() {
    var token = session ? session.access_token : null;
    clearSession();
    films = [];
    el("searchInput").value = "";
    showLoginScreen("");
    if (token) {
      fetch(SUPABASE_URL + "/auth/v1/logout", {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + token
        }
      }).catch(function () {
        // La session locale est déjà effacée : rien de plus à faire
      });
    }
  }

  // ── Initialisation ───────────────────────────────────────────

  /**
   * Branche les gestionnaires d'événements de la page.
   */
  function bindEvents() {
    el("loginForm").addEventListener("submit", submitLoginForm);
    el("logoutBtn").addEventListener("click", logout);

    el("searchInput").addEventListener("input", renderTable);
    el("addFilmBtn").addEventListener("click", function () { openFilmModal(null); });

    el("filmForm").addEventListener("submit", submitFilmForm);
    el("cancelFilmBtn").addEventListener("click", closeFilmModal);

    // Aides à la saisie : décennie déduite de l'année, crédit affiché
    // recopié depuis le nom du réalisateur
    el("f_annee").addEventListener("input", syncDecadeToYear);
    el("f_realisateur_fr").addEventListener("input", function () { syncCreditToDirector("fr"); });
    el("f_realisateur_en").addEventListener("input", function () { syncCreditToDirector("en"); });

    el("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
    el("confirmDeleteBtn").addEventListener("click", confirmDelete);

    // Boutons "Modifier" et "Supprimer" du tableau (délégation)
    el("filmsTableBody").addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("button[data-action]") : null;
      if (!button) { return; }
      var film = findFilm(button.getAttribute("data-id"));
      if (!film) { return; }
      if (button.getAttribute("data-action") === "edit") {
        openFilmModal(film);
      } else {
        openDeleteModal(film);
      }
    });

    // Fermeture des fenêtres par la touche Échap ou par le fond
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") { return; }
      if (!el("deleteModal").hidden) { closeDeleteModal(); }
      else if (!el("filmModal").hidden) { closeFilmModal(); }
    });
    el("filmModal").addEventListener("click", function (event) {
      if (event.target === el("filmModal")) { closeFilmModal(); }
    });
    el("deleteModal").addEventListener("click", function (event) {
      if (event.target === el("deleteModal")) { closeDeleteModal(); }
    });
  }

  /**
   * Point d'entrée : reprend le mode sombre du site, branche les
   * événements et restaure une éventuelle session en cours.
   */
  function init() {
    if (localStorage.getItem("darkMode") === "true") {
      document.body.classList.add("dark-mode");
    }

    bindEvents();

    session = loadSession();
    if (session) {
      showAdminScreen();
    } else {
      showLoginScreen("");
    }
  }

  // Lancer l'initialisation dès que le DOM est prêt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
