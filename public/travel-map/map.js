// Same Mapbox GL source/layer approach as niehaus1301/flightmap (6157941).
// Use the owner's public Mapbox token when configured. MapLibre is an explicit
// open-source fallback for installations that have not configured Mapbox yet.
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('token') || '';
const configuredStyle = params.get('style') || 'mapbox://styles/mapbox/light-v11';
const usingMapbox = token.startsWith('pk.');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const loading = document.getElementById('loading');
const errorBox = document.getElementById('map-error');
const errorText = document.getElementById('map-error-text');
const satelliteButton = document.getElementById('satellite-toggle');
const citiesToggle = document.getElementById('cities-toggle');
const citiesPanel = document.getElementById('cities-panel');
let map;
let popup;
let satellite = false;
let GL;
let baseLayerVisibility = [];
let satelliteTimeout;

function showError(message) {
  loading.hidden = true;
  errorText.textContent = message;
  errorBox.hidden = false;
}

function stylesheet(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}

async function loadRenderer() {
  if (usingMapbox) {
    stylesheet('https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.css');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.js';
      script.onload = resolve; script.onerror = () => reject(new Error('Mapbox could not be loaded.'));
      document.head.appendChild(script);
    });
    window.mapboxgl.accessToken = token;
    return window.mapboxgl;
  }
  stylesheet('./vendor/maplibre-gl.css');
  const library = await import('./vendor/maplibre-gl.mjs');
  library.setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs', import.meta.url).href);
  return library;
}

const openStyle = {
  version: 8,
  projection: { type: 'globe' },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    streets: {
      type: 'raster', tileSize: 256,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'streets', type: 'raster', source: 'streets' }],
};

function showCity(feature) {
  popup?.remove();
  const content = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'city-popup-title';
  title.textContent = `${feature.properties.name} · ${feature.properties.localName}`;
  const caption = document.createElement('p');
  caption.className = 'city-popup-caption';
  caption.textContent = `${feature.properties.country} · Visited`;
  content.append(title, caption);
  popup = new GL.Popup({ offset: [0, -25], maxWidth: '260px' })
    .setLngLat(feature.geometry.coordinates).setDOMContent(content).addTo(map);
}

function showAll(features) {
  popup?.remove();
  const bounds = new GL.LngLatBounds();
  features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
  map.fitBounds(bounds, { padding: { top: 90, bottom: 110, left: 65, right: 65 }, maxZoom: 4.2, duration: reducedMotion ? 0 : 850 });
}

function populateCities(features) {
  citiesToggle.textContent = `${features.length} cities`;
  const list = document.getElementById('cities-list');
  for (const feature of features) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'city-item';
    const name = document.createElement('strong');
    name.textContent = feature.properties.name;
    const local = document.createElement('span');
    local.textContent = feature.properties.localName;
    button.append(name, local);
    button.addEventListener('click', () => {
      map.flyTo({ center: feature.geometry.coordinates, zoom: 8.5, duration: reducedMotion ? 0 : 1300 });
      showCity(feature);
      if (innerWidth < 640) {
        citiesPanel.hidden = true;
        citiesToggle.setAttribute('aria-expanded', 'false');
      }
    });
    list.append(button);
  }
  document.getElementById('show-all').addEventListener('click', () => showAll(features));
}

function createPin() {
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 112;
  const ctx = canvas.getContext('2d');
  // Retain the original map's blue pin / pale center treatment for cities.
  ctx.fillStyle = '#0488db'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 109); ctx.bezierCurveTo(38, 85, 13, 62, 13, 39);
  ctx.arc(48, 39, 35, Math.PI, 0); ctx.bezierCurveTo(83, 62, 58, 85, 48, 109);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(48, 39, 23, 0, Math.PI * 2); ctx.fillStyle = '#e3f6ff'; ctx.fill();
  ctx.beginPath(); ctx.arc(48, 39, 8, 0, Math.PI * 2); ctx.fillStyle = '#0488db'; ctx.fill();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function start() {
  const response = await fetch('./locations.json');
  if (!response.ok) throw new Error('Travel locations could not be loaded.');
  const data = await response.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)
    || data.features.some((f) => f.geometry?.type !== 'Point' || !f.properties?.name)) {
    throw new Error('The travel location data is invalid.');
  }
  GL = await loadRenderer();
  map = new GL.Map({
    container: 'map-container', style: usingMapbox ? configuredStyle : openStyle,
    zoom: 2.8, center: [118, 34],
    // Keep the provider logo clear of the room's bottom-left exit sign.
    ...(usingMapbox ? { projection: 'globe', logoPosition: 'bottom-right' } : {}),
    attributionControl: false,
  });
  map.addControl(new GL.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new GL.NavigationControl({ showCompass: true }), 'bottom-right');
  populateCities(data.features);
  const loadTimeout = setTimeout(() => showError('The map is taking longer than expected. Check your connection and try again.'), 20000);
  map.on('error', (event) => {
    if (event.error?.status === 401 || event.error?.status === 403) {
      clearTimeout(loadTimeout);
      showError('Mapbox could not authorize this map. Please check the configured public access token.');
    }
    if (satellite && event.sourceId === 'satellite-imagery') {
      clearTimeout(satelliteTimeout);
      showError('Satellite imagery could not be loaded. You can switch back to Map or retry.');
    }
  });
  map.on('sourcedata', (event) => {
    if (satellite && event.sourceId === 'satellite-imagery' && event.isSourceLoaded) {
      clearTimeout(satelliteTimeout);
      loading.hidden = true;
      errorBox.hidden = true;
    }
  });
  map.on('load', () => {
    clearTimeout(loadTimeout); errorBox.hidden = true; loading.hidden = true;
    requestAnimationFrame(() => map.resize());
    baseLayerVisibility = map.getStyle().layers
      .filter((layer) => layer.type !== 'symbol' && layer.type !== 'slot')
      .map((layer) => [layer.id, layer.layout?.visibility || 'visible']);
    map.addImage('city-marker', createPin(), { pixelRatio: 2 });
    // Mapbox remains the main renderer/base map. The imagery provider is Esri:
    // Mapbox's satellite tile endpoint returned HTTP 429 during deployment QA.
    map.addSource('satellite-imagery', {
      type: 'raster', tileSize: 256, maxzoom: 18,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagery &copy; <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
    });
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite-imagery', layout: { visibility: 'none' } });
    // The source structure and symbol-layer technique follow the original map.
    map.addSource('flightmap', {
      type: 'geojson', data,
      attribution: 'City locations &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    map.addLayer({
      id: 'visited-cities', type: 'symbol', source: 'flightmap',
      filter: ['==', ['get', 'featureType'], 'city'],
      layout: {
        'icon-image': 'city-marker', 'icon-size': .68, 'icon-anchor': 'bottom',
        'icon-allow-overlap': true, 'text-field': ['get', 'name'],
        'text-font': usingMapbox ? ['Open Sans Semibold', 'Arial Unicode MS Regular'] : ['Noto Sans Regular'],
        'text-size': 13, 'text-anchor': 'top', 'text-offset': [0, .3],
        'text-optional': true,
      },
      paint: { 'text-color': '#fff', 'text-halo-color': '#213547', 'text-halo-width': 1.4 },
    });
    map.on('click', 'visited-cities', (event) => {
      const id = event.features?.[0]?.id;
      const feature = data.features.find((f) => f.id === id);
      if (feature) showCity(feature);
    });
    map.on('mouseenter', 'visited-cities', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'visited-cities', () => { map.getCanvas().style.cursor = ''; });
    satelliteButton.disabled = false;
    showAll(data.features);
  });
  window.addEventListener('resize', () => map.resize());
  window.addEventListener('pagehide', () => {
    clearTimeout(loadTimeout); clearTimeout(satelliteTimeout); map.remove();
  }, { once: true });
}

satelliteButton.addEventListener('click', () => {
  satellite = !satellite;
  // Globe draping may reorder raster/fill layers. Remove opaque base-map layers
  // while viewing imagery, then restore the style's original visibility exactly.
  for (const [id, visibility] of baseLayerVisibility) {
    map.setLayoutProperty(id, 'visibility', satellite ? 'none' : visibility);
  }
  const firstLabel = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
  map.moveLayer('satellite', firstLabel || 'visited-cities');
  map.setLayoutProperty('satellite', 'visibility', satellite ? 'visible' : 'none');
  satelliteButton.textContent = satellite ? 'Map' : 'Satellite';
  satelliteButton.setAttribute('aria-pressed', String(satellite));
  clearTimeout(satelliteTimeout);
  errorBox.hidden = true;
  loading.hidden = !satellite || map.isSourceLoaded('satellite-imagery');
  if (!loading.hidden) {
    loading.querySelector('span:last-child').textContent = 'Loading satellite imagery…';
    satelliteTimeout = setTimeout(() => showError('Satellite imagery is taking longer than expected. You can switch back to Map or retry.'), 20000);
  }
});
citiesToggle.addEventListener('click', () => {
  citiesPanel.hidden = !citiesPanel.hidden;
  citiesToggle.setAttribute('aria-expanded', String(!citiesPanel.hidden));
});
document.getElementById('retry').addEventListener('click', () => location.reload());
start().catch((error) => showError(error.message || 'The map could not be loaded.'));
