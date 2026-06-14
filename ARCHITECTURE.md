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

---

## Diagrammes d'architecture

> Les PNG sont dans `docs/`. Pour régénérer depuis les sources SVG ci-dessous :
> ```bash
> python3 -c "
> from playwright.sync_api import sync_playwright
> import os
> svgs = [('diag1_architecture','/tmp/d1.svg'),('diag2_sequence','/tmp/d2.svg'),('diag3_interactions','/tmp/d3.svg')]
> with sync_playwright() as p:
>     b = p.chromium.launch()
>     for name, path in svgs:
>         svg = open(path).read()
>         html = f'<!DOCTYPE html><html><head><style>body{{margin:0;padding:16px;background:white}}</style></head><body>' + svg + '</body></html>'
>         pg = b.new_page(viewport={'width':950,'height':800})
>         pg.set_content(html); pg.wait_for_load_state('networkidle')
>         h = pg.evaluate('document.body.scrollHeight')
>         pg.set_viewport_size({'width':950,'height':h+32})
>         pg.screenshot(path=f'docs/{name}.png', full_page=True)
>     b.close()
> "
> ```

### Diagramme 1 — Composants et déploiement

![Architecture globale](docs/diag1_architecture.png)

<details>
<summary>Source SVG — Diagramme 1</summary>

```svg
<svg width="900" viewBox="0 0 680 640" xmlns="http://www.w3.org/2000/svg" style="background:white;font-family:Arial,sans-serif">
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M2 1L8 5L2 9" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</marker>
</defs>

<!-- GitHub Pages -->
<rect x="30" y="20" width="300" height="220" rx="14" fill="#e6f1fb" stroke="#378ADD" stroke-width="1"/>
<text x="180" y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#0C447C">GitHub Pages</text>
<text x="180" y="62" text-anchor="middle" font-size="10" fill="#185FA5">mguenoun.github.io/wc2026</text>

<rect x="50" y="76" width="120" height="36" rx="6" fill="#CECBF6" stroke="#534AB7" stroke-width="0.8"/>
<text x="110" y="90" text-anchor="middle" font-size="11" font-weight="bold" fill="#26215C">index.html</text>
<text x="110" y="104" text-anchor="middle" font-size="9" fill="#3C3489">Page principale</text>

<rect x="190" y="76" width="120" height="36" rx="6" fill="#CECBF6" stroke="#534AB7" stroke-width="0.8"/>
<text x="250" y="90" text-anchor="middle" font-size="11" font-weight="bold" fill="#26215C">test.html</text>
<text x="250" y="104" text-anchor="middle" font-size="9" fill="#3C3489">Page dev/test</text>

<rect x="50" y="128" width="260" height="94" rx="6" fill="#CECBF6" stroke="#534AB7" stroke-width="0.8"/>
<text x="180" y="148" text-anchor="middle" font-size="11" font-weight="bold" fill="#26215C">js/ (10 fichiers)</text>
<text x="180" y="168" text-anchor="middle" font-size="9" fill="#3C3489">config · fallback · api · ratings</text>
<text x="180" y="184" text-anchor="middle" font-size="9" fill="#3C3489">modal · pitch · map · render</text>
<text x="180" y="200" text-anchor="middle" font-size="9" fill="#3C3489">rankings · state</text>

<!-- Cloudflare Worker -->
<rect x="30" y="268" width="300" height="210" rx="14" fill="#e1f5ee" stroke="#1D9E75" stroke-width="1"/>
<text x="180" y="294" text-anchor="middle" font-size="13" font-weight="bold" fill="#085041">Cloudflare Worker</text>
<text x="180" y="310" text-anchor="middle" font-size="10" fill="#0F6E56">wc2026.mguenoun.workers.dev</text>

<rect x="50" y="322" width="118" height="36" rx="6" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.8"/>
<text x="109" y="336" text-anchor="middle" font-size="9" font-weight="bold" fill="#04342C">Proxy /fd/</text>
<text x="109" y="350" text-anchor="middle" font-size="9" fill="#04342C">football-data.org</text>

<rect x="192" y="322" width="118" height="36" rx="6" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.8"/>
<text x="251" y="336" text-anchor="middle" font-size="9" font-weight="bold" fill="#04342C">/stats/players</text>
<text x="251" y="350" text-anchor="middle" font-size="9" fill="#04342C">/stats/keepers</text>

<rect x="50" y="374" width="260" height="88" rx="6" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.8"/>
<text x="180" y="394" text-anchor="middle" font-size="11" font-weight="bold" fill="#04342C">Pipeline KV (3 étapes)</text>
<text x="180" y="413" text-anchor="middle" font-size="9" fill="#085041">Step 1 · Découverte matchs terminés</text>
<text x="180" y="431" text-anchor="middle" font-size="9" fill="#085041">Step 2 · Fetch URLs joueurs (~7 req)</text>
<text x="180" y="449" text-anchor="middle" font-size="9" fill="#085041">Step 3 · Stats x10 séquentiels (~40 req)</text>

<!-- Cloudflare KV -->
<rect x="380" y="268" width="270" height="210" rx="14" fill="#FAEEDA" stroke="#BA7517" stroke-width="1"/>
<text x="515" y="294" text-anchor="middle" font-size="13" font-weight="bold" fill="#412402">Cloudflare KV</text>
<text x="515" y="310" text-anchor="middle" font-size="10" fill="#633806">WC2026_STATS (persistant)</text>

<rect x="400" y="322" width="230" height="140" rx="6" fill="#FAC775" stroke="#BA7517" stroke-width="0.8"/>
<text x="515" y="342" text-anchor="middle" font-size="9" fill="#412402">espn_map → matchKey: ESPN ID</text>
<text x="515" y="362" text-anchor="middle" font-size="9" fill="#412402">pipeline_queue → {pending...}</text>
<text x="515" y="382" text-anchor="middle" font-size="9" fill="#412402">urls:{eid} → URLs stats (temp)</text>
<text x="515" y="402" text-anchor="middle" font-size="9" fill="#412402">partial:{eid}:N → groupe N (temp)</text>
<text x="515" y="422" text-anchor="middle" font-size="9" fill="#412402">match:{eid} → stats finales ✓</text>
<text x="515" y="442" text-anchor="middle" font-size="9" fill="#633806">Lecture &lt; 200ms</text>

<!-- Crons -->
<rect x="380" y="20" width="270" height="220" rx="14" fill="#f1f5f9" stroke="#888780" stroke-width="1"/>
<text x="515" y="46" text-anchor="middle" font-size="13" font-weight="bold" fill="#2C2C2A">Cron Triggers</text>
<text x="515" y="62" text-anchor="middle" font-size="10" fill="#5F5E5A">Cloudflare (4 crons)</text>

<rect x="400" y="76" width="230" height="148" rx="6" fill="#D3D1C7" stroke="#888780" stroke-width="0.8"/>
<text x="515" y="96" text-anchor="middle" font-size="9" font-family="Courier,monospace" fill="#2C2C2A">*/30 * * * *   → step 1</text>
<text x="515" y="116" text-anchor="middle" font-size="9" font-family="Courier,monospace" fill="#2C2C2A">0 */2 * * *    → step 2</text>
<text x="515" y="136" text-anchor="middle" font-size="9" font-family="Courier,monospace" fill="#2C2C2A">10 */2 * * *   → step 3</text>
<text x="515" y="156" text-anchor="middle" font-size="9" font-family="Courier,monospace" fill="#2C2C2A">20 */2 * * *   → step 3</text>
<text x="515" y="176" text-anchor="middle" font-size="9" fill="#5F5E5A">Plan gratuit · 50 req/invocation</text>
<text x="515" y="196" text-anchor="middle" font-size="9" fill="#5F5E5A">Logs → Observability → scheduled</text>

<!-- Sources données -->
<rect x="30" y="510" width="180" height="100" rx="10" fill="#FAECE7" stroke="#D85A30" stroke-width="1"/>
<text x="120" y="534" text-anchor="middle" font-size="12" font-weight="bold" fill="#4A1B0C">ESPN APIs</text>
<text x="120" y="552" text-anchor="middle" font-size="9" fill="#712B13">Scores · Compos</text>
<text x="120" y="568" text-anchor="middle" font-size="9" fill="#712B13">Stats (Core API)</text>
<text x="120" y="584" text-anchor="middle" font-size="9" fill="#712B13">Direct · CORS ok</text>

<rect x="228" y="510" width="180" height="100" rx="10" fill="#FAECE7" stroke="#D85A30" stroke-width="1"/>
<text x="318" y="534" text-anchor="middle" font-size="12" font-weight="bold" fill="#4A1B0C">football-data.org</text>
<text x="318" y="552" text-anchor="middle" font-size="9" fill="#712B13">Scores · Standings</text>
<text x="318" y="568" text-anchor="middle" font-size="9" fill="#712B13">Buteurs</text>
<text x="318" y="584" text-anchor="middle" font-size="9" fill="#712B13">Via proxy /fd/</text>

<rect x="426" y="510" width="224" height="100" rx="10" fill="#f1f5f9" stroke="#888780" stroke-width="1"/>
<text x="538" y="534" text-anchor="middle" font-size="12" font-weight="bold" fill="#2C2C2A">Navigateur</text>
<text x="538" y="552" text-anchor="middle" font-size="9" fill="#5F5E5A">Init one-shot (POST)</text>
<text x="538" y="568" text-anchor="middle" font-size="9" fill="#5F5E5A">/stats/init + forceReset</text>
<text x="538" y="584" text-anchor="middle" font-size="9" fill="#5F5E5A">Pipeline manuel (debug)</text>

<!-- Flèches -->
<line x1="180" y1="240" x2="180" y2="266" stroke="#378ADD" stroke-width="1.5" marker-end="url(#arrow)"/>
<text x="192" y="257" font-size="9" fill="#666">fetch()</text>

<line x1="330" y1="373" x2="378" y2="373" stroke="#1D9E75" stroke-width="1.5" marker-end="url(#arrow)"/>
<text x="334" y="366" font-size="9" fill="#666">KV put/get</text>

<line x1="515" y1="240" x2="515" y2="266" stroke="#888" stroke-width="1.5" marker-end="url(#arrow)"/>
<text x="524" y="257" font-size="9" fill="#666">déclenche</text>

<line x1="120" y1="478" x2="120" y2="508" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>
<path d="M180 478 L180 495 L280 495 L280 508" fill="none" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>
<path d="M538 508 L538 490 L332 490 L332 270" fill="none" stroke="#aaa" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#arrow)"/>
<text x="410" y="486" font-size="9" fill="#666">one-shot init</text>
</svg>

```

</details>

---

### Diagramme 2 — Séquence au chargement de la page

![Séquence chargement](docs/diag2_sequence.png)

<details>
<summary>Source SVG — Diagramme 2</summary>

```svg
<svg width="900" viewBox="0 0 680 600" xmlns="http://www.w3.org/2000/svg" style="background:white;font-family:Arial,sans-serif">
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M2 1L8 5L2 9" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</marker>
</defs>

<text x="340" y="26" text-anchor="middle" font-size="15" font-weight="bold" fill="#0369a1">Séquence au chargement de la page</text>
<text x="340" y="44" text-anchor="middle" font-size="10" fill="#475569">Exécuté dans state.js (chargé en dernier)</text>

<!-- Numéros étapes -->
<text x="26" y="90" font-size="11" fill="#888">①</text>
<text x="26" y="142" font-size="11" fill="#888">②</text>
<text x="26" y="210" font-size="11" fill="#888">③</text>
<text x="26" y="300" font-size="11" fill="#888">④</text>
<text x="26" y="368" font-size="11" fill="#888">⑤</text>
<text x="26" y="430" font-size="11" fill="#888">⑥</text>
<text x="26" y="498" font-size="11" fill="#888">⑦</text>

<!-- ① loadFallback -->
<rect x="48" y="68" width="580" height="44" rx="8" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="68" y="86" font-size="11" font-weight="bold" fill="#26215C">loadFallback()</text>
<text x="68" y="102" font-size="9" fill="#3C3489">fallback.js → peuple allMatches (données statiques calendrier complet)</text>

<line x1="340" y1="112" x2="340" y2="128" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>
<text x="350" y="123" font-size="8" fill="#888">instantané</text>

<!-- ② renderAll -->
<rect x="48" y="128" width="580" height="44" rx="8" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="68" y="146" font-size="11" font-weight="bold" fill="#26215C">renderAll()</text>
<text x="68" y="162" font-size="9" fill="#3C3489">Affichage immédiat du calendrier statique · filtres · timeline KO</text>

<line x1="340" y1="172" x2="340" y2="188" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>
<text x="350" y="183" font-size="8" fill="#888">async</text>

<!-- ③ fetchAll + sous-étapes -->
<rect x="48" y="188" width="580" height="158" rx="8" fill="#e6f1fb" stroke="#378ADD" stroke-width="0.8"/>
<text x="68" y="208" font-size="11" font-weight="bold" fill="#042C53">fetchAll()</text>
<text x="68" y="224" font-size="9" fill="#0C447C">api.js → fetch scores + standings + buteurs en parallèle</text>

<rect x="66" y="232" width="172" height="100" rx="6" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.6"/>
<text x="152" y="252" text-anchor="middle" font-size="10" font-weight="bold" fill="#042C53">ESPN scoreboard</text>
<text x="152" y="270" text-anchor="middle" font-size="9" fill="#0C447C">Scores live</text>
<text x="152" y="288" text-anchor="middle" font-size="9" fill="#0C447C">Statuts matchs</text>
<text x="152" y="306" text-anchor="middle" font-size="9" fill="#0C447C">Direct · CORS ok</text>

<rect x="254" y="232" width="172" height="100" rx="6" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.6"/>
<text x="340" y="252" text-anchor="middle" font-size="10" font-weight="bold" fill="#042C53">Proxy /fd/ → FD</text>
<text x="340" y="270" text-anchor="middle" font-size="9" fill="#0C447C">Standings groupes</text>
<text x="340" y="288" text-anchor="middle" font-size="9" fill="#0C447C">Bootstrap scores</text>
<text x="340" y="306" text-anchor="middle" font-size="9" fill="#0C447C">Via Worker</text>

<rect x="442" y="232" width="172" height="100" rx="6" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.6"/>
<text x="528" y="252" text-anchor="middle" font-size="10" font-weight="bold" fill="#042C53">fetchScorers()</text>
<text x="528" y="270" text-anchor="middle" font-size="9" fill="#0C447C">Buteurs /fd/</text>
<text x="528" y="288" text-anchor="middle" font-size="9" fill="#0C447C">Liste complète</text>
<text x="528" y="306" text-anchor="middle" font-size="9" fill="#0C447C">Via Worker</text>

<line x1="340" y1="346" x2="340" y2="362" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- ④ renderAll update -->
<rect x="48" y="362" width="580" height="44" rx="8" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="68" y="380" font-size="11" font-weight="bold" fill="#26215C">renderAll()</text>
<text x="68" y="396" font-size="9" fill="#3C3489">Mise à jour scores live · standings · statuts matchs</text>

<line x1="340" y1="406" x2="340" y2="418" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- ⑤ scheduleRefresh -->
<rect x="48" y="418" width="580" height="44" rx="8" fill="#f1f5f9" stroke="#888780" stroke-width="0.8"/>
<text x="68" y="436" font-size="11" font-weight="bold" fill="#2C2C2A">scheduleRefresh()</text>
<text x="68" y="452" font-size="9" fill="#5F5E5A">Calcule délai jusqu'au prochain match · relance fetchAll() automatiquement</text>

<line x1="340" y1="462" x2="340" y2="474" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- ⑥ startESPNLiveRefresh -->
<rect x="48" y="474" width="580" height="44" rx="8" fill="#f1f5f9" stroke="#888780" stroke-width="0.8"/>
<text x="68" y="492" font-size="11" font-weight="bold" fill="#2C2C2A">startESPNLiveRefresh()</text>
<text x="68" y="508" font-size="9" fill="#5F5E5A">Si match en cours → setInterval 60s → fetchESPNLiveScores() pour le minuteur</text>

<line x1="340" y1="518" x2="340" y2="530" stroke="#aaa" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- ⑦ setInterval -->
<rect x="48" y="530" width="580" height="44" rx="8" fill="#f1f5f9" stroke="#888780" stroke-width="0.8"/>
<text x="68" y="548" font-size="11" font-weight="bold" fill="#2C2C2A">setInterval 30s</text>
<text x="68" y="564" font-size="9" fill="#5F5E5A">Si match live → re-render timelines (minuteur affiché)</text>
</svg>

```

</details>

---

### Diagramme 3 — Interactions UI par clic

![Interactions UI](docs/diag3_interactions.png)

<details>
<summary>Source SVG — Diagramme 3</summary>

```svg
<svg width="900" viewBox="0 0 680 720" xmlns="http://www.w3.org/2000/svg" style="background:white;font-family:Arial,sans-serif">
<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path d="M2 1L8 5L2 9" fill="none" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</marker>
</defs>

<text x="340" y="26" text-anchor="middle" font-size="15" font-weight="bold" fill="#0369a1">Interactions UI — actions déclenchées par clic</text>

<!-- Barre onglets -->
<rect x="30" y="40" width="620" height="52" rx="10" fill="#e6f1fb" stroke="#378ADD" stroke-width="1"/>
<text x="340" y="58" text-anchor="middle" font-size="12" font-weight="bold" fill="#042C53">Barre d'onglets principale</text>
<text x="340" y="74" text-anchor="middle" font-size="9" fill="#185FA5">switchView(v) → showView() → masque tous les onglets · affiche v</text>

<!-- Onglets -->
<rect x="38"  y="100" width="76" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="76"  y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">📋 Groupes</text>
<rect x="122" y="100" width="82" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="163" y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">📊 Classements</text>
<rect x="212" y="100" width="72" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="248" y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">🏆 KO</text>
<rect x="292" y="100" width="70" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="327" y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">⚽ Buteurs</text>
<rect x="370" y="100" width="70" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="405" y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">🥅 Gardiens</text>
<rect x="448" y="100" width="68" height="28" rx="5" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="482" y="118" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">⭐ Joueurs</text>

<!-- Flèches onglets -->
<line x1="163" y1="128" x2="163" y2="156" stroke="#378ADD" stroke-width="1.2" marker-end="url(#arrow)"/>
<line x1="248" y1="128" x2="248" y2="156" stroke="#378ADD" stroke-width="1.2" marker-end="url(#arrow)"/>
<line x1="405" y1="128" x2="405" y2="196" stroke="#378ADD" stroke-width="1.2" marker-end="url(#arrow)"/>
<line x1="482" y1="128" x2="482" y2="156" stroke="#378ADD" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- Rang 1 actions onglets -->
<rect x="80"  y="156" width="150" height="44" rx="6" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.8"/>
<text x="155" y="174" text-anchor="middle" font-size="10" font-weight="bold" fill="#04342C">renderStandings()</text>
<text x="155" y="190" text-anchor="middle" font-size="9" fill="#085041">standings en mémoire</text>

<rect x="248" y="156" width="154" height="44" rx="6" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.8"/>
<text x="325" y="174" text-anchor="middle" font-size="10" font-weight="bold" fill="#04342C">renderKOTimeline()</text>
<text x="325" y="190" text-anchor="middle" font-size="9" fill="#085041">allMatches filtré ko:true</text>

<rect x="420" y="156" width="146" height="44" rx="6" fill="#FAC775" stroke="#BA7517" stroke-width="0.8"/>
<text x="493" y="174" text-anchor="middle" font-size="10" font-weight="bold" fill="#412402">fetchPlayerRankings()</text>
<text x="493" y="190" text-anchor="middle" font-size="9" fill="#633806">1 appel /stats/players</text>

<!-- Rang 2 décalé Gardiens -->
<rect x="340" y="196" width="130" height="44" rx="6" fill="#FAC775" stroke="#BA7517" stroke-width="0.8"/>
<text x="405" y="214" text-anchor="middle" font-size="10" font-weight="bold" fill="#412402">fetchKeepers()</text>
<text x="405" y="230" text-anchor="middle" font-size="9" fill="#633806">1 appel /stats/keepers</text>

<!-- Séparateur -->
<line x1="30" y1="260" x2="650" y2="260" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="4 3"/>
<text x="340" y="276" text-anchor="middle" font-size="10" fill="#475569">Interactions sur un match (clic sur une ligne du calendrier)</text>

<!-- Ligne match — 2 boutons seulement : Stats + Compos -->
<rect x="30" y="286" width="620" height="40" rx="8" fill="#f1f5f9" stroke="#888780" stroke-width="0.8"/>
<text x="200" y="311" text-anchor="middle" font-size="12" font-weight="bold" fill="#2C2C2A">🟢 USA – Paraguay  4–1  FT</text>
<rect x="466" y="293" width="56" height="26" rx="4" fill="#B5D4F4" stroke="#378ADD" stroke-width="0.7"/>
<text x="494" y="310" text-anchor="middle" font-size="9" font-weight="bold" fill="#042C53">📊 Stats</text>
<rect x="534" y="293" width="64" height="26" rx="4" fill="#CECBF6" stroke="#534AB7" stroke-width="0.7"/>
<text x="566" y="310" text-anchor="middle" font-size="9" font-weight="bold" fill="#26215C">👕 Compos</text>

<!-- Flèches boutons match -->
<line x1="494" y1="319" x2="220" y2="356" stroke="#666" stroke-width="1.2" marker-end="url(#arrow)"/>
<line x1="566" y1="319" x2="490" y2="356" stroke="#666" stroke-width="1.2" marker-end="url(#arrow)"/>

<!-- Col gauche : Stats -->
<rect x="30" y="356" width="340" height="56" rx="6" fill="#FAECE7" stroke="#D85A30" stroke-width="0.8"/>
<text x="200" y="376" text-anchor="middle" font-size="10" font-weight="bold" fill="#4A1B0C">openMatchInfo()</text>
<text x="200" y="394" text-anchor="middle" font-size="9" fill="#712B13">ESPN summary → stats équipes</text>
<text x="200" y="410" text-anchor="middle" font-size="9" fill="#712B13">buts · cartons · remplacements</text>

<!-- Col droite : Compos -->
<rect x="388" y="356" width="180" height="56" rx="6" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="478" y="376" text-anchor="middle" font-size="10" font-weight="bold" fill="#26215C">openLineupESPN()</text>
<text x="478" y="394" text-anchor="middle" font-size="9" fill="#3C3489">ESPN rosters</text>
<text x="478" y="410" text-anchor="middle" font-size="9" fill="#3C3489">Phase 1 : terrain SVG immédiat</text>

<!-- Suite compos phase 2 -->
<line x1="478" y1="412" x2="478" y2="432" stroke="#534AB7" stroke-width="1.2" marker-end="url(#arrow)"/>
<rect x="388" y="432" width="180" height="56" rx="6" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="478" y="452" text-anchor="middle" font-size="10" font-weight="bold" fill="#26215C">loadMatchPlayerStats()</text>
<text x="478" y="470" text-anchor="middle" font-size="9" fill="#3C3489">ESPN Core API × 22 joueurs</text>
<text x="478" y="486" text-anchor="middle" font-size="9" fill="#3C3489">Ratings injectés ~1.5s</text>

<line x1="478" y1="488" x2="478" y2="508" stroke="#534AB7" stroke-width="1.2" marker-end="url(#arrow)"/>
<rect x="388" y="508" width="180" height="44" rx="6" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.8"/>
<text x="478" y="526" text-anchor="middle" font-size="10" font-weight="bold" fill="#26215C">renderPitch() / renderPlayerList()</text>
<text x="478" y="542" text-anchor="middle" font-size="9" fill="#3C3489">Onglet Terrain · Liste</text>

<!-- Filtres groupes -->
<line x1="30" y1="572" x2="650" y2="572" stroke="#cbd5e1" stroke-width="0.5" stroke-dasharray="4 3"/>
<text x="340" y="588" text-anchor="middle" font-size="10" fill="#475569">Filtres groupes (onglet Groupes)</text>

<rect x="30" y="598" width="620" height="40" rx="8" fill="#EAF3DE" stroke="#3B6D11" stroke-width="0.8"/>
<text x="76"  y="622" text-anchor="middle" font-size="9" font-weight="bold" fill="#173404">Tous</text>
<text x="152" y="622" text-anchor="middle" font-size="9" font-weight="bold" fill="#173404">Gr.A</text>
<text x="228" y="622" text-anchor="middle" font-size="9" font-weight="bold" fill="#173404">Gr.B</text>
<text x="304" y="622" text-anchor="middle" font-size="9" font-weight="bold" fill="#173404">Gr.C</text>
<text x="380" y="622" text-anchor="middle" font-size="9" font-weight="bold" fill="#173404">Gr.D ...</text>
<text x="530" y="614" text-anchor="middle" font-size="9" fill="#27500A">activeFilter = grp</text>
<text x="530" y="630" text-anchor="middle" font-size="9" fill="#27500A">→ renderAll()</text>

<!-- Légende -->
<rect x="30" y="654" width="14" height="12" rx="2" fill="#9FE1CB" stroke="#1D9E75" stroke-width="0.6"/>
<text x="50" y="664" font-size="8" fill="#475569">Depuis mémoire : allMatches / standings / scorers</text>
<rect x="30" y="672" width="14" height="12" rx="2" fill="#FAC775" stroke="#BA7517" stroke-width="0.6"/>
<text x="50" y="682" font-size="8" fill="#475569">Lazy load (1 seule fois) → Worker KV /stats/players ou /stats/keepers</text>
<rect x="30" y="690" width="14" height="12" rx="2" fill="#FAECE7" stroke="#D85A30" stroke-width="0.6"/>
<text x="50" y="700" font-size="8" fill="#475569">Appel ESPN live au clic → modale stats</text>
<rect x="30" y="708" width="14" height="12" rx="2" fill="#EEEDFE" stroke="#534AB7" stroke-width="0.6"/>
<text x="50" y="718" font-size="8" fill="#475569">ESPN Core API → compositions + ratings (~1.5s chargement progressif)</text>
</svg>

```

</details>
