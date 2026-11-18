# Réussir PASS — consignes pour Claude

- Site statique dans `site/` (pas de build) : `index.html` (application), `data.js` (annales), `bank.js` (banques de QCM), `bdq.js` (classement matière/chapitre), `model3d.js` (modèles 3D, three.js à la demande), `sde3d.js` / `cours3d.js` (annales et schémas pour la 3D), `import.js` / `parser.js` (import de documents), `img/`.
- Règle absolue sur le contenu : questions, items et corrections **mot pour mot** des sources ; ne jamais inventer ni reformuler. Signaler les incohérences de la source dans `notes`.
- Façon de travailler demandée par l'utilisateur : une **issue** par demande → une **branche** `feature/...` ou `fix/...` → une **pull request** qui ferme l'issue → fusion dans `main` après accord → mise en ligne automatique (GitHub Pages, `.github/workflows/pages.yml`).
- Les données de l'élève sont dans le `localStorage` (clés `ue4:*`) et IndexedDB : ne jamais changer ces clés sans migration.
- Tester au format iPad (820×1180) avant de proposer la fusion.
