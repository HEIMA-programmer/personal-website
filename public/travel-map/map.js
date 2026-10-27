/* Leaflet is vendored locally; only the base-map tiles use external services. */
const map = L.map('map', { zoomControl: false, minZoom: 2 }).setView([36.988069, 27.218754], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);

const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
});
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Imagery &copy; <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics, GIS User Community',
});

const errorMessage = document.getElementById('map-error');
for (const layer of [streets, satellite]) {
  layer.on('tileerror', () => { errorMessage.hidden = false; });
  layer.on('tileload', () => { errorMessage.hidden = true; });
}
streets.addTo(map);

let satelliteVisible = false;
document.getElementById('satellite-toggle').addEventListener('click', (event) => {
  map.removeLayer(satelliteVisible ? satellite : streets);
  satelliteVisible = !satelliteVisible;
  (satelliteVisible ? satellite : streets).addTo(map);
  event.currentTarget.textContent = satelliteVisible ? 'Map' : 'Satellite';
  event.currentTarget.setAttribute('aria-pressed', String(satelliteVisible));
  errorMessage.hidden = true;
});

// Add future visits as GeoJSON points and routes as LineStrings in locations.json.
// The initial collection is intentionally empty: no previous owner's travel data.
fetch('./locations.json')
  .then((response) => {
    if (!response.ok) throw new Error('Travel locations could not be loaded.');
    return response.json();
  })
  .then((data) => {
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      throw new Error('Travel locations must be a GeoJSON FeatureCollection.');
    }
    L.geoJSON(data, {
      style: { color: '#4b9ef1', weight: 2 },
      pointToLayer: (_feature, coordinates) => L.circleMarker(coordinates, {
        radius: 6, fillColor: '#4b9ef1', color: '#fff', weight: 2, fillOpacity: 1,
      }),
      onEachFeature: (feature, layer) => {
        if (typeof feature.properties?.name === 'string') {
          const label = document.createElement('span');
          label.textContent = feature.properties.name;
          layer.bindPopup(label);
        }
      },
    }).addTo(map);
    const visits = data.features.filter((feature) => feature.geometry?.type === 'Point').length;
    document.getElementById('travel-status').textContent = visits
      ? `${visits} travel ${visits === 1 ? 'location' : 'locations'}`
      : 'No travel locations added yet.';
  })
  .catch(() => {
    document.getElementById('travel-status').textContent = 'Travel locations are temporarily unavailable.';
  });
