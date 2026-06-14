# WC2026 Dashboard — Architecture & Documentation

## Vue d'ensemble

Dashboard de suivi de la Coupe du Monde 2026 (USA/Canada/Mexique), déployé en tant que site statique sur **GitHub Pages** avec un backend serverless sur **Cloudflare Workers** et un cache persistant **Cloudflare KV**.

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Pages                                 │
│   https://mguenoun.github.io/wc2026/                           │
│                                                                  │
│   test.html (page principale)                                   │
│   js/                                                           │
│     config.js   fallback.js   api.js      ratings.js           │
│     modal.js    pitch.js      map.js      render.js             │
│     rankings.js state.js                                        │
└──────────────────┬──────────────────────────────────────────────┘
                   │ fetch()
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cloudflare Worker                               │
│   https://wc2026.mguenoun.workers.dev                          │
│   worker.js                                                  │
│                                                                  │
│   Routes HTTP :                                                  │
│   /fd/*              → Proxy football-data.org                  │
│   /as/*              → Proxy api-sports.io                      │
│   /stats/players     → Classement joueurs (depuis KV)           │
│   /stats/keepers     → Classement gardiens (depuis KV)          │
│   /stats/status      → État du pipeline                         │
│   /stats/init        → POST : initialisation ESPN_ID_MAP        │
│   /stats/step1|2|3   → Déclenchement manuel pipeline            │
│                                                                  │
│   Cron Triggers :                                                │
│   */30 * * * *       → step1 : détection nouveaux matchs        │
│   0 */2 * * *        → step2 : fetch URLs joueurs               │
│   10 */2 * * *       → step3 : fetch stats groupe 1             │
│   20 */2 * * *       → step3 : fetch stats groupe 2 (rattrapage)│
└──────────┬──────────────────────┬───────────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌─────────────────────────────────────────┐
│ football-data.org│   │          Cloudflare KV                  │
│ api-sports.io    │   │   WC2026_STATS (namespace)              │
│ ESPN Core API    │   │                                          │
│ (sources données)│   │   espn_map        → mapping M1→760415   │
└──────────────────┘   │   pipeline_queue  → {pending,done,...}  │
                        │   urls:{eid}      → URLs stats joueurs  │
                        │   partial:{eid}:N → stats groupe N      │
                        │   match:{eid}     → stats finales       │
                        └─────────────────────────────────────────┘
```

---

## Composants GitHub Pages

### Structure des fichiers

```
wc2026/
├── test.html              # Page principale (157 lignes)
├── index.html             # Page legacy (à migrer vers test.html)
└── js/
    ├── config.js          # Constantes, maps, utilitaires
    ├── fallback.js        # Données statiques matchs (calendrier complet)
    ├── api.js             # Fetch ESPN/FD, traitement scores
    ├── ratings.js         # Algo rating joueurs v7 + ESPN Core API
    ├── modal.js           # Modales stats match (buts, cartons, remplacements)
    ├── pitch.js           # Terrain SVG, compositions, openLineupESPN
    ├── map.js             # Vue carte stade
    ├── render.js          # renderGrpFilters, timelines, standings
    ├── rankings.js        # Gardiens, buteurs, classement joueurs
    └── state.js           # renderAll, switchView, init, crons
```

### Ordre de chargement des scripts (critique)

```html
<script src="js/config.js"></script>    <!-- 1. Constantes globales -->
<script src="js/fallback.js"></script>  <!-- 2. Données statiques -->
<script src="js/api.js"></script>       <!-- 3. Fetch ESPN/FD -->
<script src="js/ratings.js"></script>   <!-- 4. Algo rating -->
<script src="js/modal.js"></script>     <!-- 5. Modales -->
<script src="js/pitch.js"></script>     <!-- 6. Terrain SVG -->
<script src="js/map.js"></script>       <!-- 7. Carte -->
<script src="js/render.js"></script>    <!-- 8. Rendu groupes -->
<script src="js/rankings.js"></script>  <!-- 9. Classements -->
<script src="js/state.js"></script>     <!-- 10. Init + orchestration -->
```

### Variables globales clés (config.js)

| Variable | Description |
|---|---|
| `PROXY_BASE` | URL du Cloudflare Worker (`https://wc2026.mguenoun.workers.dev`) |
| `ESPN_BASE` | URL ESPN API scores (`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`) |
| `ESPN_ID_MAP` | Mapping matchKey → ESPN event ID (ex: `'M1':'760415'`) |
| `TEAM_MAP` | Noms d'équipes ESPN → noms français |
| `GC` | Couleurs par groupe (`{A:'#color', B:'#color', ...}`) |
| `allMatches` | Array des matchs (peuplé par `loadFallback()` dans fallback.js) |
| `standings` | Classements par groupe (peuplé par `fetchAll()`) |
| `scorers` | Liste des buteurs (peuplé par `fetchScorers()`) |
| `activeFilter` | Filtre groupe actif ('all' ou lettre) |
| `_currentMatch` | Match actuellement ouvert en modale |
| `DISPLAY_TZ` | Timezone d'affichage (`Africa/Casablanca`) |

---

## Cloudflare Worker (worker.js)

### Pipeline de calcul des stats joueurs

Le plan gratuit Cloudflare limite chaque invocation à **50 sous-requêtes HTTP**. Un match ESPN = ~25 sous-requêtes. Le pipeline découpe le traitement en 3 étapes :

#### Step 1 — Découverte (~3 sous-requêtes)
- Lit `espn_map` dans KV
- Compare avec `pipeline_queue`
- Ajoute les ESPN IDs non traités dans `queue.pending`

#### Step 2 — Fetch URLs (~7 sous-requêtes)
- Prend le premier match `pending`
- Fetch ESPN summary (1 appel) + competitors (1) + 2 rosters (2×2)
- Extrait les 22-52 URLs de stats individuelles
- Stocke dans `KV["urls:{eid}"]`
- Déplace le match en `queue.processing`

#### Step 3 — Fetch stats par groupes de 10 (~12-42 sous-requêtes)
- Lit `KV["urls:{eid}"]`
- Fetch les stats de 10 joueurs en SÉQUENCE (pas Promise.all)
- Maximum 4 groupes par invocation (40 appels max)
- Stocke dans `KV["partial:{eid}:{N}"]`
- Quand tous les groupes sont prêts → assemble dans `KV["match:{eid}"]`

### KV Keys

| Clé | Contenu | Durée de vie |
|---|---|---|
| `espn_map` | `{ '760415': { matchKey:'M1', t1:'Mexique', t2:'Afrique du Sud', score:'2 – 0', ... } }` | Permanent |
| `pipeline_queue` | `{ pending:[], processing:[], done:[] }` | Permanent |
| `urls:{eid}` | URLs stats joueurs + infos match | Temporaire (supprimé après assemblage) |
| `partial:{eid}:{N}` | Stats du groupe N de joueurs | Temporaire (supprimé après assemblage) |
| `match:{eid}` | Stats finales de tous les joueurs du match | Permanent |

### Secrets (Cloudflare Dashboard → Settings → Variables and Secrets)

| Nom | Description |
|---|---|
| `API_TOKEN_FD` | Clé API football-data.org |
| `API_TOKEN` | Clé API football-data.org (alias legacy) |
| `API_TOKEN_AS` | Clé API api-sports.io (optionnel) |

### KV Namespace Binding (Cloudflare Dashboard → Bindings)

| Variable name | KV Namespace | Namespace ID |
|---|---|---|
| `STATS_KV` | `WC2026_STATS` | `749700d94d114156a758b14e2e9b6587` |

### Cron Triggers (Cloudflare Dashboard → Settings → Trigger events)

| Expression | Fréquence | Rôle |
|---|---|---|
| `*/30 * * * *` | Toutes les 30min | Step 1 : détection nouveaux matchs |
| `0 */2 * * *` | Toutes les 2h (pile) | Step 2 : fetch URLs du prochain match pending |
| `10 */2 * * *` | Toutes les 2h + 10min | Step 3 : fetch stats (groupes 1-4) |
| `20 */2 * * *` | Toutes les 2h + 20min | Step 3 : rattrapage (groupes 5-6 si nécessaire) |

---

## Sources de données

| Source | Usage | Proxy |
|---|---|---|
| **ESPN** `site.api.espn.com` | Scores live, compositions, stats match | Direct (CORS ok) |
| **ESPN Core** `sports.core.api.espn.com` | Stats détaillées joueurs (xG, tackles, etc.) | Direct (CORS ok) |
| **football-data.org** | Bootstrap scores/standings, buteurs | Via `/fd/*` proxy worker |
| **api-sports.io** | Stats supplémentaires (optionnel) | Via `/as/*` proxy worker |

---

## Algo Rating Joueurs (v7)

Formule par poste avec architecture `base + volScore + offScore` :

- **Base** : 6.3 pour tous les postes
- **Per90 atténué** : `1 + (90/min - 1) × 0.2` (évite la distorsion sur peu de minutes)
- **progCarries** plafonné à 6 avant normalisation
- **volScore** (métriques de volume/défense) : plafonné selon poste (1.2 CM → 1.8 DEF/FB/AM)
- **offScore** (buts, assists, xG, xA) : plafonné à 2.5 (2.8 pour FW)
- **Carton rouge** : -1.0 / **Carton jaune** : -0.3
- **Plage** : [4.0 — 9.5]

Calibré sur 3 matchs vs SofaScore et FotMob (écart moyen ±0.4).

---

## Initialisation (one-shot depuis la console navigateur)

À lancer une seule fois après le déploiement d'un nouveau worker, ou après `forceReset` :

```js
// Étape 1 : envoyer le mapping ESPN au worker
(async function() {
  var mapping = {};
  allMatches.filter(m => m.isFT && ESPN_ID_MAP[m.id]).forEach(function(m) {
    mapping[ESPN_ID_MAP[m.id]] = {
      espnId: ESPN_ID_MAP[m.id], matchKey: m.id,
      t1: m.t1, t2: m.t2, score: m.score, dayKey: m.dayKey
    };
  });
  var r = await fetch('https://wc2026.mguenoun.workers.dev/stats/init', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapping, forceReset: true })  // forceReset: vide le KV
  });
  console.log('Init:', await r.json());
})();
```

```js
// Étape 2 : pipeline complet (si les crons ne suffisent pas)
(async function runPipeline() {
  var base = 'https://wc2026.mguenoun.workers.dev';
  for (var i = 0; i < 200; i++) {
    var status = await fetch(base + '/stats/status').then(r => r.json());
    var q = status.queue;
    if (q.pending.length === 0 && q.processing.length === 0) { console.log('✅ Terminé'); break; }
    if (q.processing.length > 0) await fetch(base + '/stats/step3');
    else await fetch(base + '/stats/step2');
    await new Promise(res => setTimeout(res, 300));
  }
})();
```

---

## Monitoring

```js
// État du pipeline KV
fetch('https://wc2026.mguenoun.workers.dev/stats/status')
  .then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)));
```

Cloudflare Dashboard → worker `wc2026` → **Observability** → **Logs** : filtrer sur `scheduled` pour voir l'historique des crons avec leurs résultats (`step1/2/3 result: {...}`).

---

## Structure du repo GitHub

```
mguenoun/wc2026 (repo)
├── test.html              # Page principale
├── index.html             # Legacy (à migrer)
├── js/
│   ├── config.js
│   ├── fallback.js
│   ├── api.js
│   ├── ratings.js
│   ├── modal.js
│   ├── pitch.js
│   ├── map.js
│   ├── render.js
│   ├── rankings.js
│   └── state.js
└── worker/
    └── worker.js       # Code Cloudflare Worker (déployé manuellement)
```

> Le worker n'est pas déployé automatiquement depuis GitHub — il est copié manuellement dans l'éditeur Cloudflare. Pour automatiser le déploiement avec Wrangler CLI, voir la section suivante.

---

## Mise en place VSCode + Wrangler (workflow local)

### Prérequis
- Node.js ≥ 18
- Git
- VSCode avec GitHub Copilot installé

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/mguenoun/wc2026.git
cd wc2026

# 2. Installer Wrangler CLI (déploiement Cloudflare)
npm install -g wrangler

# 3. S'authentifier sur Cloudflare
wrangler login

# 4. Créer wrangler.toml à la racine
```

### wrangler.toml

```toml
name = "wc2026"
main = "worker/worker.js"
compatibility_date = "2026-06-11"

[[kv_namespaces]]
binding = "STATS_KV"
id = "749700d94d114156a758b14e2e9b6587"

[triggers]
crons = ["*/30 * * * *", "0 */2 * * *", "10 */2 * * *", "20 */2 * * *"]
```

### Déploiement depuis VSCode

```bash
# Déployer le worker
wrangler deploy

# Tester en local (avec les crons simulables)
wrangler dev --local

# Voir les logs en temps réel
wrangler tail
```

### Variables secrètes (à configurer une seule fois)

```bash
wrangler secret put API_TOKEN_FD
# → entrer la clé football-data.org

wrangler secret put API_TOKEN_AS
# → entrer la clé api-sports.io
```

---

## URLs de production

| Service | URL |
|---|---|
| Dashboard | https://mguenoun.github.io/wc2026/test.html |
| Worker | https://wc2026.mguenoun.workers.dev |
| Status pipeline | https://wc2026.mguenoun.workers.dev/stats/status |
| Classement joueurs | https://wc2026.mguenoun.workers.dev/stats/players |
| Classement gardiens | https://wc2026.mguenoun.workers.dev/stats/keepers |
