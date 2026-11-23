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
- Ajouts du 18/11 : frise des 4 semaines (#6), retrait de « BRAVO CHRISTOPHE ! » (#8), jeu des coupes d'histologie (120 coupes), menu ☰, Planning, écrans de chargement et animations (#9), style « cahier » sobre (#10), demandes personnalisées (rubrique « Mes demandes »).
- 23/11 : modèle 3D à part « Appareil circulatoire » (PR #22, issue #21), d’après le cours du Dr Benchaib (`cours christophe/cours-embryo/UE5 EmBryo/05_Mise en place…`) : 7 étapes J18 → J28, 20 schémas du cours (`img/cours/cv-*.webp`, clé `cv` de `cours3d.js`), rubrique « Mise en place des organes » des Modèles 3D. Outils d’extraction des schémas : `layout.mjs`, `render-pages.ps1` et `cvfigs.js` (dans le dossier temporaire de l’ancienne session, à refaire si besoin).
- Ticket OVH CS17180422 : annulation de la commande en double n° 263780401 (5,99 €), à suivre. La commande gardée est la n° 263780358.

## Reste à faire, dans l'ordre
1. HTTPS actif et forcé (certificat approuvé le 18/11/2026, expire le 16/02/2027, renouvelé automatiquement par GitHub).
2. Déménagement : MOVE_TO activé (PR #4) et publié sur Netlify le 18/11 ; transfert testé de bout en bout. Reste : Christophe ouvre l’ancien lien et touche « Emporter ma progression », puis ajoute https://reussir-pass.fr à son écran d’accueil.
3. Netlify : Christophe a emporté sa progression ; le site Netlify redirige (301) vers reussir-pass.fr depuis le 18/11 (issue #2 fermée).
4. En attente :
   - jeu « reconnaître la coupe » en histologie (issue #3), qui attend les cours d'histologie de Christophe ;
   - mail au Tutorat Lyon-Est envoyé le 18/11 depuis simon.guerra69@gmail.com (texte dans `mail-tutorat.md`). Au 23/11 : aucune réponse ; l’adresse univ-lyon1 a renvoyé un message anti-spam (CAPTCHA) que **Simon doit valider lui-même** dans Gmail, sinon le mail n’est pas transmis. La copie à tutoratpaceslyonest@gmail.com est partie normalement.
   - idées d'abonnement payant et d'application mobile.

## Comptes (Supabase, projet « pass-facile », réf. uwliytqqfbgxvnnqaadl, organisation pass-facile du compte Supabase de Simon)
- Site : `site/config.js` (URL + clé publishable, publique par conception) et `site/compte.js` (inscription prénom/nom/e-mail/mot de passe, connexion, mot de passe oublié, progression synchronisée = clés `ue4:*` + épreuves importées, table `progress`).
- Base : `supabase/schema.sql` (profiles, progress, demandes, bucket privé « demandes » ; RLS : chacun ne voit que ses lignes). Déjà exécuté le 18/11.
- Auth : Site URL https://reussir-pass.fr ; redirections https://reussir-pass.fr/** et http://localhost:8777/** ; confirmation par e-mail activée (envoi gratuit limité à quelques e-mails/heure).
- Clé de service : `tools/.supabase.json` (non versionné), **à coller par Simon** (Settings → API Keys → Secret key, ou legacy service_role). Claude ne doit pas la lire depuis le tableau de bord.

## Corrections de réponses et tickets
- Chaque élève peut corriger la réponse attendue d'une question (lien « ✎ Corriger la réponse attendue » sous la correction) : clé `ue4:fix`, personnelle.
- Connecté, sa correction est aussi envoyée dans la table `corrections` (une ligne par élève et par question). Dès que **2 élèves** ont corrigé la même question, un ticket apparaît dans le menu ☰ → « Tickets de correction » (visible seulement par les admins : table `admins`, Simon). « Valider pour tous » écrit dans `corrections_validees` (lecture publique) : la réponse s'applique à tous les comptes ; la correction perso de chacun reste prioritaire. SQL : `supabase/corrections.sql` (exécuté le 19/11).

## Traiter les demandes (quand Simon dit « traite les demandes »)
Rubrique « Mes demandes » : réservée aux comptes ; document (texte extrait dans le navigateur, ou photo) + consigne, rangés dans la table `demandes` ; la réponse n'est visible que par son auteur.
1. `node tools/demandes.js list` : télécharge les demandes « envoyée » dans `.demandes/<id>/` (non versionné).
2. Écrire le résultat dans un fichier JSON (hors dépôt, par ex. `.demandes/<id>/resultat.json`), en s'appuyant UNIQUEMENT sur le document :
   - flashcards : `{ "type": "flashcards", "title": "…", "ue": "UE5", "message": "facultatif", "cards": [{ "recto": "…", "verso": "…" }] }`
   - QCM : `{ "type": "qcm", "title": "…", "ue": "…", "exam": { "questions": [ format des imports : num, type QRM/QRU, stem, items [{letter,text}], answer [lettres], corrections {A:{verdict,text}}, general ] } }`
   - fiche : `{ "type": "fiche", "title": "…", "fiche": { "sections": [{ "titre": "…", "points": ["…"], "texte": "…" }] } }`
   - impossible : `{ "type": "autre", "message": "explication" }`
3. `node tools/demandes.js publish <id> .demandes/<id>/resultat.json` : la personne le reçoit à la prochaine ouverture du site (pas de déploiement).
4. `node tools/demandes.js done <id>` : efface le texte et la photo envoyés (le résultat reste dans son compte).
L'ancien formulaire Netlify « demande » n'est plus utilisé (Netlify : crédits gratuits épuisés le 18/11, déploiements bloqués jusqu'au mois suivant ; la redirection fonctionne).

## Méthode de travail
- Une issue, puis une branche `feature/...` ou `fix/...`, puis une PR, puis la fusion après accord de Simon.
- Contenu toujours **mot pour mot** des sources.
- Tester en 820×1180 (format iPad).
- Simon veut des messages courts, sans commentaire sur chaque étape.
- Ne jamais envoyer de mail ou de ticket sans l'accord explicite de Simon sur le texte.
