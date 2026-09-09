(function () {
  "use strict";

  var SUPABASE_URL = "https://afbdrqrslgduomimkmyt.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYmRycXJzbGdkdW9taW1rbXl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTExMTEsImV4cCI6MjA5NTk4NzExMX0.uvOvP-2cfgrIPdOrThLERwOGKid8OYExq1xro-5TAb8";

  var SESSION_KEY = "top1000_admin_session";

  var DECADES = [
    { key: "silents", label: "1895–1929 (silents)" },
    { key: "1930s", label: "1930s" },
    { key: "1940s", label: "1940s" },
    { key: "1950s", label: "1950s" },
    { key: "1960s", label: "1960s" },
    { key: "1970s", label: "1970s" },
    { key: "1980s", label: "1980s" },
    { key: "1990s", label: "1990s" },
    { key: "2000s", label: "2000s" },
    { key: "2010s", label: "2010s–2020s" }
  ];

  var films = [];
  var session = null;

  // ── Session ──────────────────────────────────────────────────

  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(s) {
    session = s;
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* stockage indisponible : la session reste en mémoire */ }
  }

  function authHeaders() {
    var token = (session && session.access_token) || SUPABASE_ANON_KEY;
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    };
  }

  function login(email, password) {
    return fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          throw new Error(body.error_description || body.msg || "Identifiants incorrects.");
        }
        return body;
      });
    }).then(function (body) {
      saveSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        email: email
      });
    });
  }

  function logout() {
    saveSession(null);
    showLoginScreen();
  }

  // ── API films ────────────────────────────────────────────────

  function apiRequest(method, query, body) {
    return fetch(SUPABASE_URL + "/rest/v1/top1000" + query, {
      method: method,
      headers: Object.assign({}, authHeaders(), { Prefer: "return=representation" }),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(
            "Accès refusé (" + res.status + "). " +
            "Vérifiez que vous êtes bien connecté avec un compte autorisé à écrire. " +
            (err.message || "")
          );
        });
      }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(err.message || err.hint || ("Erreur " + res.status));
        });
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function fetchAllFilms() {
    return apiRequest("GET", "?select=*&order=annee.asc,ordre.asc");
  }

  function insertFilm(data) {
    return apiRequest("POST", "", [data]);
  }

  function updateFilm(id, data) {
    return apiRequest("PATCH", "?id=eq." + encodeURIComponent(id), data);
  }

  function deleteFilm(id) {
    return apiRequest("DELETE", "?id=eq." + encodeURIComponent(id));
  }

  // ── UI : écrans ──────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }

  function showLoginScreen() {
    $("loginScreen").hidden = false;
    $("adminScreen").hidden = true;
    $("logoutBtn").hidden = true;
    $("loginError").hidden = true;
    $("loginForm").reset();
  }

  function showAdminScreen() {
    $("loginScreen").hidden = true;
    $("adminScreen").hidden = false;
    $("logoutBtn").hidden = false;
    refreshFilmsList();
  }

  function showBanner(message, type) {
    var banner = $("statusBanner");
    banner.textContent = message;
    banner.className = "admin-banner admin-banner--" + type;
    banner.hidden = false;
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(function () { banner.hidden = true; }, 5000);
  }

  // ── UI : liste des films ─────────────────────────────────────

  function refreshFilmsList() {
    return fetchAllFilms().then(function (rows) {
      films = rows;
      renderTable();
    }).catch(function (err) {
      showBanner(err.message, "error");
    });
  }

  function renderTable() {
    var query = $("searchInput").value.trim().toLowerCase();
    var filtered = films.filter(function (f) {
      if (!query) return true;
      return [f.titre_fr, f.titre_en, f.realisateur_fr, f.realisateur_en, String(f.annee)]
        .join(" ").toLowerCase().indexOf(query) !== -1;
    });

    $("resultCount").textContent = filtered.length + " / " + films.length + " films";

    var tbody = $("filmsTableBody");
    tbody.innerHTML = "";
    filtered.forEach(function (f) {
      var tr = document.createElement("tr");

      var tdAnnee = document.createElement("td");
      tdAnnee.textContent = f.annee;
      tr.appendChild(tdAnnee);

      var tdTitre = document.createElement("td");
      tdTitre.textContent = f.titre_fr;
      tr.appendChild(tdTitre);

      var tdReal = document.createElement("td");
      tdReal.textContent = f.prenom_realisateur ? (f.realisateur_fr + ", " + f.prenom_realisateur) : f.realisateur_fr;
      tr.appendChild(tdReal);

      var tdDecennie = document.createElement("td");
      tdDecennie.textContent = f.decennie;
      tr.appendChild(tdDecennie);

      var tdTier = document.createElement("td");
      tdTier.textContent = f.tier;
      tr.appendChild(tdTier);

      var tdActions = document.createElement("td");
      var actionsWrap = document.createElement("div");
      actionsWrap.className = "admin-row-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Modifier";
      editBtn.addEventListener("click", function () { openFilmModal(f); });
      actionsWrap.appendChild(editBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Supprimer";
      delBtn.addEventListener("click", function () { openDeleteModal(f); });
      actionsWrap.appendChild(delBtn);

      tdActions.appendChild(actionsWrap);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  // ── UI : formulaire ajout / édition ──────────────────────────

  function populateDecadeOptions() {
    var select = $("f_decennie");
    select.innerHTML = "";
    DECADES.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.key;
      opt.textContent = d.label;
      select.appendChild(opt);
    });
  }

  function openFilmModal(film) {
    $("formError").hidden = true;
    $("filmForm").reset();

    if (film) {
      $("filmModalTitle").textContent = "Modifier : " + film.titre_fr;
      $("f_id").value = film.id;
      $("f_titre_fr").value = film.titre_fr || "";
      $("f_titre_en").value = film.titre_en || "";
      $("f_annee").value = film.annee != null ? film.annee : "";
      $("f_decennie").value = film.decennie || "";
      $("f_ordre").value = film.ordre != null ? film.ordre : 0;
      $("f_tier").value = film.tier || "top-rest";
      $("f_realisateur_fr").value = film.realisateur_fr || "";
      $("f_realisateur_en").value = film.realisateur_en || "";
      $("f_prenom_realisateur").value = film.prenom_realisateur || "";
      $("f_portrait").checked = !!film.portrait;
      $("f_portrait_file").value = film.portrait_file || "";
      $("f_credit_decennie_fr").value = film.credit_decennie_fr || "";
      $("f_credit_decennie_en").value = film.credit_decennie_en || "";
      $("f_note_fr").value = film.note_fr || "";
      $("f_note_en").value = film.note_en || "";
    } else {
      $("filmModalTitle").textContent = "Ajouter un film";
      $("f_id").value = "";
      $("f_ordre").value = 0;
      $("f_tier").value = "top-rest";
      $("f_decennie").value = DECADES[DECADES.length - 1].key;
    }

    $("filmModal").hidden = false;
  }

  function closeFilmModal() {
    $("filmModal").hidden = true;
  }

  function readFilmForm() {
    return {
      titre_fr: $("f_titre_fr").value.trim(),
      titre_en: $("f_titre_en").value.trim(),
      annee: parseInt($("f_annee").value, 10),
      decennie: $("f_decennie").value,
      ordre: parseInt($("f_ordre").value, 10) || 0,
      tier: $("f_tier").value,
      realisateur_fr: $("f_realisateur_fr").value.trim(),
      realisateur_en: $("f_realisateur_en").value.trim(),
      prenom_realisateur: $("f_prenom_realisateur").value.trim() || null,
      portrait: $("f_portrait").checked,
      portrait_file: $("f_portrait_file").value.trim() || null,
      credit_decennie_fr: $("f_credit_decennie_fr").value.trim(),
      credit_decennie_en: $("f_credit_decennie_en").value.trim(),
      note_fr: $("f_note_fr").value.trim() || null,
      note_en: $("f_note_en").value.trim() || null
    };
  }

  function submitFilmForm(e) {
    e.preventDefault();
    var id = $("f_id").value;
    var data = readFilmForm();
    var action = id ? updateFilm(id, data) : insertFilm(data);

    action.then(function () {
      closeFilmModal();
      showBanner(id ? "Film modifié." : "Film ajouté.", "success");
      return refreshFilmsList();
    }).catch(function (err) {
      var p = $("formError");
      p.textContent = err.message;
      p.hidden = false;
    });
  }

  // ── UI : suppression ─────────────────────────────────────────

  var filmPendingDelete = null;

  function openDeleteModal(film) {
    filmPendingDelete = film;
    $("deleteFilmLabel").textContent = film.titre_fr + " (" + film.annee + ")";
    $("deleteModal").hidden = false;
  }

  function closeDeleteModal() {
    filmPendingDelete = null;
    $("deleteModal").hidden = true;
  }

  function confirmDelete() {
    if (!filmPendingDelete) return;
    var id = filmPendingDelete.id;
    deleteFilm(id).then(function () {
      closeDeleteModal();
      showBanner("Film supprimé.", "success");
      return refreshFilmsList();
    }).catch(function (err) {
      closeDeleteModal();
      showBanner(err.message, "error");
    });
  }

  // ── Initialisation ───────────────────────────────────────────

  function init() {
    populateDecadeOptions();

    $("loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("loginEmail").value.trim();
      var password = $("loginPassword").value;
      $("loginError").hidden = true;
      login(email, password).then(showAdminScreen).catch(function (err) {
        var p = $("loginError");
        p.textContent = err.message;
        p.hidden = false;
      });
    });

    $("logoutBtn").addEventListener("click", logout);
    $("addFilmBtn").addEventListener("click", function () { openFilmModal(null); });
    $("cancelFilmBtn").addEventListener("click", closeFilmModal);
    $("filmForm").addEventListener("submit", submitFilmForm);
    $("searchInput").addEventListener("input", renderTable);
    $("cancelDeleteBtn").addEventListener("click", closeDeleteModal);
    $("confirmDeleteBtn").addEventListener("click", confirmDelete);

    session = loadSession();
    if (session) {
      showAdminScreen();
    } else {
      showLoginScreen();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
