# Erwan Sixty · 60 Tour — Web apps de l'événement

3 web-apps statiques (HTML/CSS/JS vanilla) branchées sur la base Airtable live
`appEkfketa401qQr7`, déployées sur Netlify. Charte « Erwan Sixty » : noir + orange
FC Lorient (`#E87722`), typo Playfair Display / Oswald / Roboto.

| App | URL | Statut |
|---|---|---|
| **Missions « Coup de main »** | `/missions/` | ✅ Sprint 1 |
| Dashboard Pilotage | `/dashboard/` | 🔜 Sprint 2 |
| Quizz Brunch + Album | `/quizz/` · `/album/` | 🔜 Sprint 3 |

## Architecture

```
Navigateur (app statique)
      │  fetch('/.netlify/functions/tasks' | 'claim-task')
      ▼
Netlify Functions ──► process.env.AIRTABLE_TOKEN ──► api.airtable.com
```

Le PAT Airtable ne vit **que** dans les variables d'environnement Netlify.
Aucun secret dans le code livré au navigateur.

- `shared/tokens.css` — design system commun (couleurs, typo, composants).
- `missions/` — App 1. Mode démo automatique (fixtures) si les functions sont injoignables.
- `netlify/functions/tasks.js` — GET missions + invités (noms seulement, RGPD), cache 20 s.
- `netlify/functions/claim-task.js` — POST inscription, anti double-booking
  (relecture de la tâche avant écriture, 409 si complète).

### Règles de capacité (calculées depuis les liens, pas le rollup)

| Format Airtable | Places |
|---|---|
| Seul | 1 |
| En binôme / Seul ou binôme | 2 |
| En équipe | illimité |

Occupation = union dédupliquée de `Invité 1` + `Invité 2` + `Volontaires`.
Quand une mission est complète → `Statut = "Assignée"`.

## Lancer en local

```bash
npx netlify dev        # sert le statique + les functions sur :8888
# sans netlify dev : ouvrir missions/index.html → bascule en mode démo
```

## Déploiement

1. Repo GitHub connecté à Netlify (`git push origin main` = mise en prod).
2. Variables d'environnement Netlify (Site settings → Environment variables) :
   - `AIRTABLE_TOKEN` — PAT avec scopes `data.records:read` + `data.records:write`
     sur la base `appEkfketa401qQr7` **uniquement**
   - `AIRTABLE_BASE_ID` — `appEkfketa401qQr7`

## Données — points de vigilance

- Le rollup `Nb volontaires` renvoie 0 même quand des volontaires sont liés →
  l'app compte depuis les liens.
- Le champ `Statut` était déjà à « Assignée » sur des tâches vides → l'app se base
  sur l'occupation réelle, et remet le statut à jour à chaque inscription.
- `Invités › Statut confirmation` contient des jours de la semaine → à clarifier
  avec Erwan avant le Dashboard (Sprint 2).
