# Changelog

## 25 mai 2026

### Architecture
- Migration vers `data.json` + `app.js` + `index.html` minimal
- Suppression du dossier `en/` — FR/EN géré dynamiquement via `app.js`
- `banner.js` intégré dans `app.js`
- Migration du routeur hash (`#1960s`) vers de vraies URLs (`/top1000/1960s`) via `history.pushState` + `404.html`

### Corrections de données
- *La soif du mal* (Welles) — ajout *(version de 1998)* [FR] / *(1998 version)* [EN]
- *La femme des sables* (Teshigahara) — ajout *(director's cut)* [FR + EN]
- *Meurtre d'un bookmaker chinois* (Cassavetes) — ajout *(version de 1976)* [FR] / *(1976 version)* [EN]
- *Celestial subway lines / salvaging noise* (Jacobs) — ajout *(performance filmée)* [FR] / *(videotaped performance)* [EN]
- *Gigi, Monica… et Bianca* — réalisateur corrigé : `(Dervaux)` → `(Dervaux/Abdellaoui)` [FR + EN]
- *Marketa Lazarová* (EN) — `(Vlacil)` → `(Vláčil)`
- *Diaries, notes and sketches* (EN) — titre corrigé : `(also known as Walden)`
- *Rameau's nephew* (EN) — titre corrigé : `'Rameau's nephew' by Diderot (Thanx to Dennis Young) by Wilma Schoen (Snow)`
- Suppression de *Material* (Heise, 2009) — film et réalisateur retirés [FR + EN]
- 308 cinéastes représentés (au lieu de 309)

### Améliorations fonctionnelles
- Responsive mobile — menu hamburger sur écran < 600px
- Rétention de la position de scroll entre les pages
- Filtre actif (Top 100/200/300/1000) mémorisé lors de la navigation entre décennies
- Nombre de cinéastes remis en tête de la section "Par réalisateur"

### Design
- Notes italiques (version, director's cut…) en non-gras
- Contraste couleur Top 300 amélioré en mode clair

### SEO / technique
- `sitemap.xml` mis à jour avec les vraies URLs
- Balises Open Graph (`og:title`, `og:description`, `og:image`, `og:url`)
- Image de partage `og-image.jpg` (1200×630px, photo 31)
- `<link rel="canonical">` ajouté
- Favicon pellicule de film (`favicon.ico`)
