

const enable_snow = true; // Mettre à false pour ne pas afficher la couche neige (données non garanties)

const protocol = new pmtiles.Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))

const ETAT_COLORS = {
    Ouvert: "#2ecc71",
    Désordre: "#f39c12",
    Travaux: "#e67e22",
    Fermé: "#e74c3c",
}

const etatColorExpr = [
    'match', ['get', 'etat'],
    'Ouvert', ETAT_COLORS.Ouvert,
    'Désordres', ETAT_COLORS.Désordre,
    'Travaux', ETAT_COLORS.Travaux,
    'Fermé', ETAT_COLORS.Fermé,
    'transparent'
];

const neigeTooltip = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false
})

const map = new maplibregl.Map({

    container: 'map',

    zoom: 10.29,

    center: [7.1814, 44.1521],

    pitch: 47,

    hash: true,

    antialias: true,

    style: {
        version: 8,

        sources: {

            osmSource: {
                type: 'raster',
                tiles: [
                    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
                ],
                tileSize: 256,
                attribution: '© <a href="https://www.ign.fr/">IGN</a> - Géoportail'
            },

            ignOrthoSource: {
                type: 'raster',
                tiles: [
                    'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
                ],
                tileSize: 256,
                attribution: 'IGN-F/Geoportail'
            },

            terrainSource: {
                type: 'raster-dem',
                url: 'https://tiles.mapterhorn.com/tilejson.json'
            }

        },

        layers: [

            {
                id: 'osm-layer',
                type: 'raster',
                source: 'osmSource',
                layout: {
                    visibility: 'visible'
                }
            },
            {
                id: 'ign-ortho-layer',
                type: 'raster',
                source: 'ignOrthoSource',
                layout: {
                    visibility: 'none'
                }
            }

        ],

        terrain: {
            source: 'terrainSource',
            exaggeration: 1.0
        }
    }
})

map.addControl(
    new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
    })
);

map.addControl(
    new maplibregl.TerrainControl({
        source: 'terrainSource',
        exaggeration: 1
    })
);

map.addControl(
    new maplibregl.FullscreenControl({
        container: document.body
    })
);


function setBasemap(baseMap) {
    const showOsm = baseMap === 'osm'

    map.setLayoutProperty(
        'osm-layer',
        'visibility',
        showOsm ? 'visible' : 'none'
    )

    map.setLayoutProperty(
        'ign-ortho-layer',
        'visibility',
        showOsm ? 'none' : 'visible'
    )

    if (map.getLayer('hillshade')) {
        const terrainEnabled = map.getTerrain() !== null
        map.setLayoutProperty(
            'hillshade',
            'visibility',
            showOsm && terrainEnabled ? 'visible' : 'none'
        )
    }
}

async function loadTrek() {
    const data = await fetch('https://adminrando.marittimemercantour.eu/api/v2/trek/165527/').then(r => r.json());
    map.addSource('trek-gtm', {
        type: 'geojson',
        data: {
            type: 'Feature', geometry: data.geometry, properties: {
                name: data.name['fr']
            }
        }
    });
    map.addLayer({
        id: 'trek-gtm-line', type: 'line', source: 'trek-gtm',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#c020f5', 'line-width': 6, 'line-opacity': 0.9 }
    }, 'sentiers-layer'); // ← toujours sous les sentiers
    map.on('mouseenter', 'trek-gtm-line', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'trek-gtm-line', () => map.getCanvas().style.cursor = '');
}



map.on('load', () => {






    // =========================
    // SOURCES
    // =========================

    map.addSource('zones', {
        type: 'geojson',
        data: 'https://www.data.gouv.fr/api/1/datasets/r/abd73679-5a9f-4f29-91a0-69f692b11a1b'
    });

    if (enable_snow) {
        map.addSource('neige', {
            type: 'vector',
            url: 'pmtiles://https://media.mercantour.eu/api/pmtiles/neige'
        });
    }

    map.addSource('sentiers', { type: 'geojson', data: `sentiers.geojson?v=${Date.now()}` });

    map.addSource('infos_ponctuelles', { type: 'geojson', data: `infos_sentiers_ponctuel.geojson?v=${Date.now()}` });


    // =========================
    // LAYERS (ordre = z-index)
    // =========================

    map.addLayer({
        id: 'zones-layer', type: 'fill', source: 'zones',
        paint: { 'fill-color': '#145a32', 'fill-opacity': 0.2 }
    });

    map.addLayer({
        id: 'zones-outline-layer', type: 'line', source: 'zones',
        paint: { 'line-color': '#0b3d0b', 'line-width': 2.5 }
    });

    if (enable_snow) {
        map.addLayer({
            id: 'neige-layer', type: 'fill', source: 'neige', 'source-layer': 'merged_snow',
            paint: { 'fill-color': '#2980b9', 'fill-opacity': 0.7 }
        });
    }


    map.addLayer({
        id: 'sentiers-layer', type: 'line', source: 'sentiers',
        paint: { 'line-color': etatColorExpr, 'line-width': 4 }
    });

    map.addLayer({
        id: 'infos_ponctuelles-layer', type: 'circle', source: 'infos_ponctuelles',
        paint: {
            'circle-color': etatColorExpr,
            'circle-radius': 6,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
        }
    });


    // =========================
    // EVENTS
    // =========================

    const prop = (props, ...keys) => keys.reduce((v, k) => v ?? props[k] ?? props[k.toUpperCase()], undefined);
    let clickHandled = false;

    map.on('click', 'sentiers-layer', (e) => {
        clickHandled = true;
        const props = e.features?.[0]?.properties ?? {};
        const etat = prop(props, 'etat', 'Etat') ?? 'Non renseigné';
        const nom = prop(props, 'tooltip_name') ?? '';
        const desc = prop(props, 'tooltip_description') ?? '';
        new maplibregl.Popup().setLngLat(e.lngLat).setHTML(
            `${nom ? `<b>${nom}</b><br>` : ''}État : ${etat}${desc ? `<br>${desc}` : ''}`
        ).addTo(map);
    });

    map.on('click', 'infos_ponctuelles-layer', ({ features, lngLat }) => {
        const props = features?.[0]?.properties ?? {};
        new maplibregl.Popup().setLngLat(lngLat).setHTML(
            `<b>${prop(props, 'nom', 'name') ?? ''}</b><br>${prop(props, 'description') ?? ''}`
        ).addTo(map);
    });

    map.on('click', 'trek-gtm-line', (e) => {
        if (clickHandled) { clickHandled = false; return; }
        const props = e.features?.[0]?.properties ?? {};
        new maplibregl.Popup().setLngLat(e.lngLat)
            .setHTML(props.name ? `<b>${props.name}</b>` : 'Grande traversée du Mercantour')
            .addTo(map);
    });

    // Curseur pointer sur les layers interactifs
    ['sentiers-layer', 'infos_ponctuelles-layer'].forEach(id => {
        map.on('mouseenter', id, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', id, () => map.getCanvas().style.cursor = '');
    });

    // Tooltip neige
    if (enable_snow) {
        map.on('mousemove', 'neige-layer', ({ features, lngLat }) => {
            const props = features?.[0]?.properties ?? {};
            map.getCanvas().style.cursor = 'pointer';
            neigeTooltip.setLngLat(lngLat)
                .setHTML(`<b>Dernière actualisation neige</b><br>${prop(props, 'snow', 'SNOW') ?? 'Non renseignée'}`)
                .addTo(map);
        });
        map.on('mouseleave', 'neige-layer', () => {
            map.getCanvas().style.cursor = '';
            neigeTooltip.remove();
        });
    }


    // =========================
    // INIT
    // =========================

    loadTrek();
    buildLegend();


})


// ====================================
// TOGGLE COUCHES
// ====================================

document
    .getElementById('basemapSelect')
    .addEventListener('change', (e) => {
        setBasemap(e.target.value)
    })

document
    .getElementById('sentiersCheck')
    .addEventListener('change', (e) => {

        map.setLayoutProperty(
            'sentiers-layer',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )

        map.setLayoutProperty(
            'infos_ponctuelles-layer',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )
    })



document
    .getElementById('zonesCheck')
    .addEventListener('change', (e) => {

        map.setLayoutProperty(
            'zones-layer',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )

        map.setLayoutProperty(
            'zones-outline-layer',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )
    })

const neigeCheck = document.getElementById('neigeCheck')

if (!enable_snow) {
    neigeTooltip.remove()
    if (neigeCheck) {
        const neigeLabel = neigeCheck.closest('label')
        if (neigeLabel) {
            neigeLabel.style.display = 'none'
        }
    }
} else if (neigeCheck) {
    neigeCheck.addEventListener('change', (e) => {

        map.setLayoutProperty(
            'neige-layer',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )

        if (!e.target.checked) {
            neigeTooltip.remove()
        }
    })
}


document
    .getElementById('trekCheck')
    .addEventListener('change', (e) => {

        map.setLayoutProperty(
            'trek-gtm-line',
            'visibility',
            e.target.checked ? 'visible' : 'none'
        )
    })


map.on('terrain', () => {
    if (!map.getLayer('hillshade')) return; // ← ajoute ça
    const terrainEnabled = map.getTerrain() !== null
    const basemapSelect = document.getElementById('basemapSelect')
    const showHillshade = basemapSelect.value === 'osm' && terrainEnabled
    map.setLayoutProperty('hillshade', 'visibility', showHillshade ? 'visible' : 'none')
})



function buildLegend() {

    const legend = document.getElementById('legend-content')

    legend.innerHTML = ''

    Object.entries(ETAT_COLORS).forEach(([label, color]) => {

        const div = document.createElement('div')
        div.className = 'legend-item'

        div.innerHTML = `
            <span class="box" style="background:${color}"></span>
            ${label}
        `

        legend.appendChild(div)
    })

    const zoneDiv = document.createElement('div')
    zoneDiv.className = 'legend-item'
    zoneDiv.innerHTML = `
            <span class="box" style="background:rgba(20, 90, 50, 0.12); border:2px solid #0b3d0b"></span>
            Coeur du Parc national du Mercantour
        `
    legend.appendChild(zoneDiv)

    const trekDiv = document.createElement('div')
    trekDiv.className = 'legend-item'
    trekDiv.innerHTML = `
            <span class="box" style="background:#c020f5;#ccc "></span>
            Grande traversée du Mercantour
        `
    legend.appendChild(trekDiv)

    if (enable_snow) {
        const neigeDiv = document.createElement('div')
        neigeDiv.className = 'legend-item'
        neigeDiv.innerHTML = `
            <span class="box" style="background:#2980b9; #ccc"></span>
            Neige au sol (données non garanties)
        `
        legend.appendChild(neigeDiv)
    }




}