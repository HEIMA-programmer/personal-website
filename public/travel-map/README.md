# Travel map

The original room embeds `https://niehaus1301.github.io/flightmap`, which always loads its owner's travel data. Its source does not provide an empty-data embed option and its Mapbox style requires that owner's configuration. This local map replaces that embedded document, retains the full-screen interactive map and map/satellite toggle, and keeps the room's original exit sign.

No travel locations are included. Add your own GeoJSON Point features to `locations.json`; each optional `properties.name` is displayed as plain text in a popup. LineString features can represent routes.

Leaflet 1.9.4 is vendored from its official documented release URLs. No additional package installation or API key is required. Its BSD 2-Clause license is in `LEAFLET-LICENSE.txt`.

- Leaflet: https://leafletjs.com/download.html
- Leaflet source: https://github.com/Leaflet/Leaflet/tree/v1.9.4
- OpenStreetMap data and attribution: https://www.openstreetmap.org/copyright
- OpenStreetMap standard tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- Satellite imagery and attribution: https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
- Original embedded map reviewed: https://github.com/niehaus1301/flightmap/blob/61579414acbdfd3f18a540944ebfd8a027a3dd15/src/App.tsx

Map tiles are loaded on demand from their providers; the local application does not prefetch or cache tiles. Map imagery needs an internet connection. Provider attributions remain visible on the map.
