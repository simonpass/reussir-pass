# Réussir PASS

Site de révision pour le PASS (Lyon-Est), pensé pour l'iPad : annales corrigées et banques de QCM interactives, BDQCM par matière, flashcards à répétition espacée, araignée de compétences, modèles 3D d'embryologie.

- **Site en ligne :** GitHub Pages (bientôt `reussir-pass.fr`).
- **Contenu :** tout est dans `site/`. C'est un site statique (HTML, CSS, JavaScript), sans serveur.
- **Mise en ligne :** automatique à chaque modification de la branche `main` (voir `.github/workflows/pages.yml`).

## Façon de travailler

1. Chaque demande de changement est notée dans une **issue** (onglet « Issues »).
2. Le changement est développé dans une **branche** dédiée (`feature/...` ou `fix/...`).
3. Une **pull request** relie la branche à l'issue ; une fois validée, elle est fusionnée dans `main`.
4. La fusion déclenche la **mise en ligne automatique**.

## Contenus

Les questions et corrections sont reprises mot pour mot des annales et banques de QCM du Tutorat Lyon-Est, qui en conservent les droits.
