import time
import select
import threading
import geopandas as gpd
from sqlalchemy import create_engine

DSN_SERVICE = "postgresql+psycopg2:///?service=projets"
DEBOUNCE_SECONDS = 20

EXPORTS = {
    "export_troncons": {
        "sql": "SELECT * FROM sentier.troncons_geotrek WHERE etat IS NOT NULL",
        "path": "/var/www/html/map_infos_sentiers/sentiers.geojson",
        "geom_col": "geom",
        "timer": None,
        "crs": 'EPSG:32632',
    },
    "export_points": {
        "sql": "SELECT * FROM sentier.t_infos_sentiers_ponctuel",
        "path": "/var/www/html/map_infos_sentiers/infos_sentiers_ponctuel.geojson",
        "geom_col": "geom",
        "timer": None,
        "crs": 'EPSG:2154',
    },
}

def do_export(channel):
    config = EXPORTS[channel]
    print(f"[{time.strftime('%H:%M:%S')}] Export {channel}...")
    try:
        engine = create_engine(DSN_SERVICE)
        gdf = gpd.read_postgis(config["sql"], con=engine, geom_col=config["geom_col"], crs=config["crs"]).to_crs(epsg=4326)
        gdf.to_file(config["path"], driver="GeoJSON")
        print(f"[{time.strftime('%H:%M:%S')}] Export OK → {config['path']} ({len(gdf)} objets)")
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Erreur export {channel} : {e}")

def schedule_export(channel):
    config = EXPORTS[channel]
    if config["timer"] is not None:
        config["timer"].cancel()
    config["timer"] = threading.Timer(DEBOUNCE_SECONDS, do_export, args=[channel])
    config["timer"].start()
    print(f"[{time.strftime('%H:%M:%S')}] [{channel}] Export planifié dans {DEBOUNCE_SECONDS}s")

def main():
    engine = create_engine(DSN_SERVICE)
    conn = engine.raw_connection()
    conn.set_isolation_level(0)
    cur = conn.cursor()

    for channel in EXPORTS:
        cur.execute(f"LISTEN {channel};")
        print(f"En écoute sur {channel}...")

    raw_conn = conn.driver_connection
    while True:
        if select.select([raw_conn], [], [], 5) != ([], [], []):
            raw_conn.poll()
            while raw_conn.notifies:
                notif = raw_conn.notifies.pop()
                if notif.channel in EXPORTS:
                    print(f"[{time.strftime('%H:%M:%S')}] Notification reçue sur {notif.channel}")
                    schedule_export(notif.channel)

if __name__ == "__main__":
    main()
