// Same Mapbox GL source/layer approach as niehaus1301/flightmap (6157941).
// Use the owner's public Mapbox token when configured. MapLibre is an explicit
// open-source fallback for installations that have not configured Mapbox yet.
import { buildIllustrativeRoutes } from './route-geometry.js';

const params = new URLSearchParams(location.hash.slice(1));
const token = params.get('token') || '';
const configuredStyle = params.get('style') || 'mapbox://styles/mapbox/light-v11';
const usingMapbox = token.startsWith('pk.');
const loading = document.getElementById('loading');
const errorBox = document.getElementById('map-error');
const errorText = document.getElementById('map-error-text');
const satelliteButton = document.getElementById('satellite-toggle');
let map;
let popup;
let satellite = false;
let GL;
let baseLayerVisibility = [];
let satelliteTimeout;
const globeCamera = () => ({
  center: [113, 30], bearing: 0, pitch: 0, padding: 0,
  // Keep the complete globe inside narrow phone viewports as well as desktops.
  zoom: Math.max(0, Math.min(1.75, 1.75 + Math.log2(Math.min(innerWidth, innerHeight) / 700))),
});

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
  sky: {
    'sky-color': '#071f46', 'horizon-color': '#9ccbf4', 'sky-horizon-blend': 0.45,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  },
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

function showRoute(feature, position) {
  popup?.remove();
  const content = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'city-popup-title';
  title.textContent = `${feature.properties.from} → ${feature.properties.to}`;
  const label = document.createElement('p');
  label.className = 'route-popup-label'; label.textContent = 'Illustrative route';
  const caption = document.createElement('p');
  caption.className = 'city-popup-caption';
  caption.textContent = 'A visual connection between visited cities, not a record of an actual flight or journey.';
  content.append(title, label, caption);
  popup = new GL.Popup({ maxWidth: '280px' }).setLngLat(position).setDOMContent(content).addTo(map);
}

async function loadPin() {
  // Use the same airplane pin and display size as the upstream flightmap.
  const marker = new Image(150, 150);
  await new Promise((resolve, reject) => {
    marker.onload = resolve;
    marker.onerror = () => reject(new Error('The city marker could not be loaded.'));
    marker.src = './airport-marker.svg';
  });
  return marker;
}

async function start() {
  const [response, routeResponse] = await Promise.all([fetch('./locations.json'), fetch('./routes.json')]);
  if (!response.ok || !routeResponse.ok) throw new Error('Travel locations or illustrative routes could not be loaded.');
  const [data, routeConfiguration] = await Promise.all([response.json(), routeResponse.json()]);
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)
    || data.features.some((f) => f.geometry?.type !== 'Point' || !f.properties?.name)) {
    throw new Error('The travel location data is invalid.');
  }
  const routes = buildIllustrativeRoutes(data, routeConfiguration);
  GL = await loadRenderer();
  const marker = await loadPin();
  map = new GL.Map({
    container: 'map-container', style: usingMapbox ? configuredStyle : openStyle,
    ...globeCamera(),
    // Keep the provider logo clear of the room's bottom-left exit sign.
    ...(usingMapbox ? { projection: 'globe', logoPosition: 'bottom-right' } : {}),
    attributionControl: false,
  });
  map.on('style.load', () => {
    if (usingMapbox) map.setFog({
      color: '#b7d9f5', 'high-color': '#387ed6', 'space-color': '#071f46',
      'horizon-blend': 0.15, 'star-intensity': 0.45, range: [0.8, 8],
    });
  });
  map.addControl(new GL.AttributionControl({ compact: true }), 'bottom-right');
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
    // Snapshot only the original base map. The routes added below must stay
    // visible when opaque base fills are hidden for satellite imagery.
    baseLayerVisibility = map.getStyle().layers
      .filter((layer) => layer.type !== 'symbol' && layer.type !== 'slot')
      .map((layer) => [layer.id, layer.layout?.visibility || 'visible']);
    map.addImage('city-marker', marker);
    // Mapbox remains the main renderer/base map. The imagery provider is Esri:
    // Mapbox's satellite tile endpoint returned HTTP 429 during deployment QA.
    map.addSource('satellite-imagery', {
      type: 'raster', tileSize: 256, maxzoom: 18,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imagery &copy; <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
    });
    map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite-imagery', layout: { visibility: 'none' } });
    map.addSource('illustrative-routes', { type: 'geojson', data: routes });
    map.addLayer({
      id: 'illustrative-routes', type: 'line', source: 'illustrative-routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ff6b6b', 'line-width': 1.5, 'line-opacity': 1 },
    });
    map.addLayer({
      id: 'illustrative-route-hit', type: 'line', source: 'illustrative-routes',
      paint: { 'line-color': '#f28da3', 'line-width': 14, 'line-opacity': 0 },
    });
    // The source structure and symbol-layer technique follow the original map.
    map.addSource('flightmap', {
      type: 'geojson', data,
      attribution: 'City locations &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    map.addLayer({
      id: 'visited-cities', type: 'symbol', source: 'flightmap',
      filter: ['==', ['get', 'featureType'], 'city'],
      layout: {
        'icon-image': 'city-marker', 'icon-size': .25, 'icon-anchor': 'bottom',
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
    map.on('click', 'illustrative-route-hit', event => {
      if (map.queryRenderedFeatures(event.point, { layers: ['visited-cities'] }).length) return;
      const route = routes.features.find(feature => feature.id === event.features?.[0]?.id);
      if (route) showRoute(route, event.lngLat);
    });
    map.on('mouseenter', 'illustrative-route-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'illustrative-route-hit', () => { map.getCanvas().style.cursor = ''; });
    satelliteButton.disabled = false;
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
  const firstOverlay = map.getStyle().layers.find((layer) => layer.type === 'symbol' || layer.id === 'illustrative-routes')?.id;
  map.moveLayer('satellite', firstOverlay || 'visited-cities');
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
document.getElementById('retry').addEventListener('click', () => location.reload());
start().catch((error) => showError(error.message || 'The map could not be loaded.'));
