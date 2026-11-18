# Reprise du projet (passage de relais entre sessions Claude)

À lire en premier, avec `CLAUDE.md`. État au 18/11/2026.

## Le projet
- Site de révision PASS (Lyon-Est) pour Christophe Pierre, ami de Simon Guerra (propriétaire).
- Dépôt : https://github.com/simonpass/reussir-pass (branche `main`, site statique dans `site/`).
- Mise en ligne : GitHub Pages via `.github/workflows/pages.yml`. URL technique : https://simonpass.github.io/reussir-pass.
- Domaine : `reussir-pass.fr`, acheté chez OVH (compte de Simon ; Simon se connecte lui-même, ne jamais saisir de mot de passe ni de code).
- Ancien hébergement : Netlify, https://medecine-facile.netlify.app (site id `217e40f1-6bde-4f65-8ad8-1c67db02ba9f`). Christophe l'utilise encore, et ses progrès sont dans le navigateur (localStorage).

## Déjà fait
- Le site est complet : annales UE1–UE5 (UE6 masquée par `HIDDEN_UE`), banques de QCM, BDQCM par matière, import de documents, flashcards (touches C/V/B/N), araignée de compétences et modèles 3D des 4 semaines (DSE) avec schémas du cours et annales.
- La zone DNS OVH a été remplacée le 18/11/2026 :
  - A @ → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 ;
  - CNAME www → simonpass.github.io. ;
  - MX et SPF OVH conservés.
- Le domaine personnalisé GitHub Pages est réglé sur `reussir-pass.fr`, HTTPS forcé.
- Ajouts du 18/11 : frise des 4 semaines (PR #6), retrait de « BRAVO CHRISTOPHE ! » (PR #8).
- Ticket OVH CS17180422 : annulation de la commande en double n° 263780401 (5,99 €), à suivre. La commande gardée est la n° 263780358.

## Reste à faire, dans l'ordre
1. HTTPS actif et forcé (certificat approuvé le 18/11/2026, expire le 16/02/2027, renouvelé automatiquement par GitHub).
2. Déménagement : MOVE_TO activé (PR #4) et publié sur Netlify le 18/11 ; transfert testé de bout en bout. Reste : Christophe ouvre l’ancien lien et touche « Emporter ma progression », puis ajoute https://reussir-pass.fr à son écran d’accueil.
3. Ensuite, désactiver ou supprimer le site Netlify (issue #2), avec l'accord de Simon.
4. En attente :
   - jeu « reconnaître la coupe » en histologie (issue #3), qui attend les cours d'histologie de Christophe ;
   - mail au Tutorat Lyon-Est envoyé le 18/11 depuis simon.guerra69@gmail.com (texte dans `mail-tutorat.md`), attendre la réponse ;
   - idées d'abonnement payant et d'application mobile.

## Méthode de travail
- Une issue, puis une branche `feature/...` ou `fix/...`, puis une PR, puis la fusion après accord de Simon.
- Contenu toujours **mot pour mot** des sources.
- Tester en 820×1180 (format iPad).
- Simon veut des messages courts, sans commentaire sur chaque étape.
- Ne jamais envoyer de mail ou de ticket sans l'accord explicite de Simon sur le texte.
