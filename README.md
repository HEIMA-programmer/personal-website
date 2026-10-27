# Yanbin Xu's personal website

**[Live demo — yanbin.pro](https://yanbin.pro/)**

My academic homepage, featuring research interests, publications, tools, daily computational immunology news, and an interactive 3D room.

Built with React, TypeScript, Vite, Joy UI, Spline, and Three.js.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci --legacy-peer-deps
npm run dev
```

For the Mapbox map, add your own public token to the ignored `.env.local` file:

```dotenv
VITE_MAPBOX_TOKEN=pk.YOUR_PUBLIC_TOKEN
```

Run `npm test` to check the project and `npm run build` to create the production site in `dist/`.

## Updates and deployment

Hosted on GitHub Pages at **[yanbin.pro](https://yanbin.pro/)**. Pushes to `main` trigger checks and automatic deployment. Research news is collected daily at **01:23 UTC / 09:23 Beijing time** and published automatically.

See the [News guide](docs/news.md) and [room customization guide](docs/room-customization.md) for maintenance details.

## Acknowledgements and resources

Many thanks to **[Leonard Niehaus](https://github.com/niehaus1301)** for sharing his [personal website](https://github.com/niehaus1301/personal-website). This website is adapted from his project and retains its visual design, interactive Spline room, and many of its original interactions.

- **Cat:** [Tuxedo Cat Animated 2.0](https://sketchfab.com/3d-models/tuxedo-cat-animated-20-783fcb78b55b4394a212c2b6392e1113) by DreamNoms, under CC BY 4.0. [Attribution and modifications](public/cat/tuxedo/LICENSE.md).
- **Photography:** Color landscapes from Wikimedia Commons Featured Pictures. [Photographers and licenses](public/photos/README.md).
- **Travel map:** Based on Leonard's [flightmap](https://github.com/niehaus1301/flightmap), using Mapbox, with MapLibre, OpenStreetMap, and Esri resources. [Map credits](public/travel-map/README.md).
- **Research news:** bioRxiv and Europe PMC / PubMed metadata, with individually credited article figures. [Sources and collection details](docs/news.md).
- **University emblems:** From the RoboMaster university logo collection; ownership remains with the respective universities. [Sources](public/institutions/README.md).

Third-party assets retain their respective licenses. The original website repository does not specify a license; this adaptation does not grant a new license for its inherited code or room assets.
