# Travel map

The room uses the original project's **Mapbox GL JS** approach: a full-screen GL map, GeoJSON source, blue symbol pins, clickable popups, and a map/satellite switch. The room's exit sign is preserved. The map fits Yanbin's seven visited cities and provides a city selector for the nearby Osaka and Nara points.

Original reference: [niehaus1301/flightmap at 6157941](https://github.com/niehaus1301/flightmap/tree/61579414acbdfd3f18a540944ebfd8a027a3dd15). Its renderer is Mapbox GL JS 3.20.0. The reference's navy controls and source/layer structure informed this adaptation. Its owner-specific flight data, aircraft legend, trip dates, photos, and credentials are not included. This document does not grant an additional license for that repository.

## Mapbox configuration

Set these build environment values (for local development, use the ignored `.env.local`):

```dotenv
VITE_MAPBOX_TOKEN=pk.YOUR_OWN_PUBLIC_MAPBOX_TOKEN
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/light-v11
```

Only `pk.*` public access tokens are accepted. These are client-visible by design. Never use an `sk.*` secret token here. Use a dedicated token with appropriate URL restrictions for the deployed site and local preview. Changes require rebuilding the Vite application; restart a running development server after editing the environment. The GitHub build and Pages workflows read the repository Actions variable `VITE_MAPBOX_TOKEN`; other production hosts must provide the same build value. Tokens are kept outside source control because GitHub push protection also flagged the supplied public token.

With a public token configured, the map loads Mapbox GL JS **3.20.0** and its CSS from Mapbox's official CDN, and Mapbox provides the base map. An optional Mapbox style URL can replace the default light style. The iframe receives configuration in its URL fragment so the public token is not part of the iframe HTTP request. It is still visible in the client, as all public Mapbox tokens are.

The satellite switch uses **Esri World Imagery** in both modes, with its provider attribution displayed on the map. During deployment checks on 2026-10-27, Mapbox's satellite metadata and style endpoints returned HTTP 200 with the owner's token, but satellite tile requests returned HTTP 429; the equivalent Esri tile returned HTTP 200. Using Esri imagery keeps satellite browsing available without requiring an account change. The GL raster source/layer implementation and the Mapbox main map are preserved. Normal base-map fills are hidden while viewing satellite imagery, then restored when switching back, so globe layer batching cannot cover the imagery with an opaque map layer.

If no public token is configured, the same GL source/layer UI runs with the vendored **MapLibre GL JS 6.16.0** renderer, OpenStreetMap tiles and Esri satellite imagery. This is an explicit fallback, not the original Mapbox service. An invalid configured Mapbox token produces an actionable error instead of silently changing the provider.

## Locations

`locations.json` contains only the cities the owner supplied. Each feature is a GeoJSON Point, with English/local names and a country. The points represent cities, not airports or exact personal locations. No flight routes, travel dates or photos are inferred.

Coordinates were checked against OpenStreetMap via the [Nominatim search API](https://nominatim.org/release-docs/latest/api/Search/) on 2026-10-27:

| City | Local name | OpenStreetMap record |
| --- | --- | --- |
| Beijing | 北京 | [relation 912940](https://www.openstreetmap.org/relation/912940) |
| Shanghai | 上海 | [node 778910398](https://www.openstreetmap.org/node/778910398) |
| Changsha | 长沙 | [node 2277730366](https://www.openstreetmap.org/node/2277730366) |
| Osaka | 大阪 | [relation 358674](https://www.openstreetmap.org/relation/358674) |
| Nara | 奈良 | [relation 3227707](https://www.openstreetmap.org/relation/3227707) |
| Dali | 大理 | [relation 2727734](https://www.openstreetmap.org/relation/2727734) |
| Wuhan | 武汉 | [relation 3076268](https://www.openstreetmap.org/relation/3076268) |

## Dependencies and provider terms

- [Mapbox CDN setup](https://docs.mapbox.com/mapbox-gl-js/guides/get-started/use-with-cdn/) and [access tokens](https://docs.mapbox.com/help/dive-deeper/access-tokens/). Mapbox code is loaded from the official CDN when configured; it is not vendored in this repository.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), downloaded from the official npm `maplibre-gl@6.16.0` distribution. The renderer, worker and stylesheet are in `vendor/`; its BSD 3-Clause license and bundled notices are in `vendor/MAPLIBRE-LICENSE.txt`.
- [OpenStreetMap attribution](https://www.openstreetmap.org/copyright) and [standard tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- [Esri World Imagery service and attribution](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer).

Map tiles load on demand and require internet access. This application does not prefetch or persist tiles. Provider and coordinate attributions remain visible on the map.
