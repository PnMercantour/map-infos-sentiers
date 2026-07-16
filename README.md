# Carte "Infos Sentiers" - media.mercantour.eu/map_infos_sentiers

Documentation de la carte 3D MapLibre publiée sur `media.mercantour.eu/map_infos_sentiers`.

## Vue d'ensemble

La page est une carte web MapLibre GL (rendu 3D, fonds de plan IGN) qui superpose plusieurs couches d'information à destination du public et des agents du Parc :

- Fond de carte : **Plan IGN** / **Orthophoto IGN**
- **Coeur du Parc national du Mercantour** (zonage réglementaire)
- **Neige** (couverture neigeuse, via Sentineige)
- **Sentiers** (état des tronçons + informations ponctuelles, via Geotrek/GeoNature)
- **Grande traversée du Mercantour (GTM)** (tracé de l'itinéraire, via l'API Geotrek)

Chaque couche a sa propre chaîne d'alimentation, décrite ci-dessous.

---

## 1. Couche des sentiers (état des tronçons + points d'info)

### Origine des données

- Les tronçons Geotrek sont importés dans `bd_pnm` via un **Foreign Data Wrapper (FDW)**, schéma `geotrek`, table `core_path`.
- La vue `sentier.troncon_geotrek` enrichit `geotrek.core_path` avec les champs `etat`, `tooltip_name` et `tooltip_description`, provenant de la table `sentier.t_troncons_geotrek_extra`.
- Les informations ponctuelles (points d'info sur les sentiers) sont stockées dans `sentier.t_infos_sentiers_ponctuel`.
- Un projet QGIS intitulé ``

### Déclenchement des mises à jour (notifications Postgres)

- Un **pg_cron** s'exécute toutes les 2 minutes sur `geotrek.core_path` (bd_pnm) : s'il détecte qu'un tronçon a été modifié depuis la dernière vérification, il envoie la notification `export_troncons`.
- Un **trigger** sur `sentier.t_troncons_geotrek_extra` envoie `export_troncons` à chaque INSERT / UPDATE / DELETE.
- Un **trigger** sur `sentier.t_infos_sentiers_ponctuel` envoie `export_points` à chaque INSERT / UPDATE / DELETE.

### Génération des GeoJSON

- Sur le serveur `media.mercantour.eu`, un script Python écoute en boucle (`LISTEN`) ces notifications :
  - Service systemd : `pg-export-geojson` (`systemctl status pg-export-geojson`)
  - Script : `/home/map-infos-sentiers-data/export_map_infos_from_bd_pnm.py`
- À réception d'une notification, le script exécute les requêtes suivantes et régénère les fichiers correspondants (avec reprojection en EPSG:4326 côté Python) :
  - `SELECT * FROM sentier.troncons_geotrek WHERE etat IS NOT NULL` → `/var/www/html/map_infos_sentiers/sentiers.geojson`
  - `SELECT * FROM sentier.t_infos_sentiers_ponctuel` → `/var/www/html/map_infos_sentiers/infos_sentiers_ponctuel.geojson`

### ⚠️ Point de vigilance - Maintenance

**Le certificat d'accès à la base de données (bd_pnm) doit être renouvelé tous les 2 ans.** Sans renouvellement, le script `export_map_infos_from_bd_pnm.py` ne peut plus se connecter et les GeoJSON ne sont plus rafraîchis (silencieusement - aucune erreur visible côté carte, les données deviennent simplement obsolètes). À ajouter à un calendrier de maintenance / suivi.

---

## 2. Couche neige (Sentineige)

### Récupération quotidienne des données

- Un **cron** tourne tous les jours à **7h00** sur le serveur (chez le PNM) :
  ```bash
  python3 get_data.py
  /usr/local/bin/tippecanoe -o neige.pmtiles -zg --drop-densest-as-needed merged_snow.geojson --force
  cp -f neige.pmtiles /var/www/private
  ```

### `get_data.py`

- Récupère 4 GeoJSON quotidiens depuis le serveur HTTP de Sentineige, authentifié par un `TOKEN`.
- Dalles récupérées pour le Parc national du Mercantour (tuiles Sentinel) : `T32TLP`, `T32TLQ`, `T31TGK`, `T31TGJ`.
- Fusionne le tout dans `merged_snow.geojson`.

### Conversion et publication

- `tippecanoe` convertit `merged_snow.geojson` en `neige.pmtiles` (zoom auto `-zg`, simplification `--drop-densest-as-needed`). C'est ce fichier qui est lu dans le code Javascript.

### ⚠️ Points de vigilance

- Dépendance à la disponibilité du serveur Sentineige : si celui-ci est indisponible à 7h, la couche neige n'est pas mise à jour ce jour-là (pas de retry automatique à ce stade).

---

## 3. Couche Grande Traversée du Mercantour (GTM)

- Récupérée **en direct côté client** (pas de cache serveur), à chaque chargement de page, depuis l'API Geotrek public :
  ```js
  const data = await fetch('https://adminrando.marittimemercantour.eu/api/v2/trek/165527/').then(r => r.json());
  map.addSource('trek-gtm', {
      type: 'geojson',
      data: {
          type: 'Feature',
          geometry: data.geometry,
          properties: { name: data.name['fr'] }
      }
  });
  ```
- L'ID de l'itinéraire (`165527`) est actuellement **codé en dur**.

### TODO

- Remplacer l'ID en dur par une recherche de l'itinéraire par son nom (plus robuste si l'ID change côté Geotrek).

---

## Récapitulatif des flux

| Couche | Source | Fréquence de mise à jour | Mécanisme |
|---|---|---|---|
| Sentiers (état + points) | `bd_pnm` (FDW Geotrek + tables PNM) | quasi temps réel (événementiel) | pg_cron (2 min) + triggers PG → NOTIFY → script Python `pg-export-geojson` |
| Neige | Sentineige (API HTTP) | quotidienne (7h) | cron + `get_data.py` + tippecanoe → PMTiles |
| GTM | API Geotrek (adminrando) | temps réel | fetch côté client au chargement de la page |
| Coeur de Parc / fonds IGN | IGN Géoplateforme (WMTS) | statique / service tiers | chargé directement côté client |

## Composants serveur à connaître

- Service systemd `pg-export-geojson` (écoute LISTEN/NOTIFY, génère les GeoJSON sentiers/points)
- Script `/home/map-infos-sentiers-data/export_map_infos_from_bd_pnm.py`
- Fichiers servis : `/var/www/html/map_infos_sentiers/sentiers.geojson`, `/var/www/html/map_infos_sentiers/infos_sentiers_ponctuel.geojson`, `/var/www/private/neige.pmtiles`
- Cron neige (7h, hôte PNM) : `get_data.py` + `tippecanoe`
- Connexion à `bd_pnm` : certificat à renouveler tous les 2 ans

## Pistes d'amélioration identifiées

- [ ] Rechercher l'itinéraire GTM par nom plutôt que par ID codé en dur.
- [ ] Ajouter une alerte de suivi/expiration pour le certificat d'accès à `bd_pnm`.
- [ ] Envisager une gestion d'erreur/retry si le serveur Sentineige est indisponible au moment du cron 7h.
