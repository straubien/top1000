# Mathieu Muzard — 1000 Films Essentiels

Site cinéphile personnel listant 1000 films essentiels classés chronologiquement de 1895 à 2023, avec navigation par décennie et par réalisateur.

🔗 **[Voir le site](https://straubien.github.io/top1000/)**

---

## Fonctionnalités

- Navigation par décennie (1895–2023) et par réalisateur
- Filtre par tier (Top 100 / 200 / 300 / 1000)
- Tri des réalisateurs par ordre alphabétique ou nombre de films
- Mode sombre
- Interface bilingue français / anglais (détection automatique de la langue du navigateur)
- Mosaïque de photos aléatoire en bannière
- SPA (Single Page Application) avec gestion de l'historique navigateur

## Architecture

Site statique hébergé sur GitHub Pages. Aucun framework, aucun outil de build.

```
index.html      — structure HTML
style.css       — styles
app.js          — logique SPA, routeur, rendu des pages
data.json       — données (films, réalisateurs, textes FR/EN)
images/         — photos pour la bannière mosaïque (100 images)
```

## Données

Toutes les données sont dans `data.json`, structurées en deux langues (`fr` et `en`), avec pour chaque langue :
- `intro` — texte d'introduction
- `about` — texte de la page À propos
- `decades` — liste des décennies, chacune contenant des années et des films
- `directors` — liste des réalisateurs avec leurs films

Chaque film a un `title`, un `tier` (`top-100`, `top-200`, `top-300`, `top-rest`) et optionnellement une `note`.
