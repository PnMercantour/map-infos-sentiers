python3 get_data.py
/usr/local/bin/tippecanoe -o neige.pmtiles -zg --drop-densest-as-needed merged_snow.geojson --force
cp -f neige.pmtiles /var/www/private
