import requests
import geopandas as gpd
import pandas as pd

# ============================================
# CONFIG
# ============================================

TOKEN = "" # A remplacer par le token d'accès à l'API Snow Map
BASE_URL = "" # A remplacer par l'URL de base de l'API Snow Map

TILES = [
    "T32TLP",
    "T32TLQ",
    "T31TGK",
    "T31TGJ"
]

OUTPUT_FILE = "merged_snow.geojson"

# ============================================
# DOWNLOAD + LOAD IN MEMORY
# ============================================

gdfs = []

for tile in TILES:
    url = f"{BASE_URL}/{tile}_snow_map_date.geojson?token={TOKEN}"
    print(f"Downloading {tile}...")

    response = requests.get(url)
    response.raise_for_status()

    geojson_data = response.json()
    gdf = gpd.GeoDataFrame.from_features(geojson_data["features"], crs="EPSG:4326")

    if "snow" not in gdf.columns:
        raise ValueError(f"Le champ 'snow' est absent dans la tuile {tile}")

    gdf = gdf[gdf.geometry.notnull()].copy()
    gdf["geometry"] = gdf.geometry.buffer(0)
    gdf = gdf[~gdf.geometry.is_empty].copy()
    gdf["snow_date"] = pd.to_datetime(gdf["snow"], errors="coerce", utc=True)

    print(f"Loaded {tile}: {len(gdf)} features")
    gdfs.append(gdf)

merged = gpd.GeoDataFrame(
    pd.concat(gdfs, ignore_index=True),
    crs=gdfs[0].crs
)

merc = gpd.read_file("limites_mercantour.geojson")

merged.clip(merc).to_file(OUTPUT_FILE, driver="GeoJSON")
