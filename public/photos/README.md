# Photographs in the room

The two existing picture frames now show two curated archive collections, three photographs per frame. These are historical photographs by Ansel Adams and Dorothea Lange, not photographs taken by Yanbin or of Yanbin's family. The original files are stored unchanged; the Spline planes preserve each image's complete aspect ratio against an ivory mat.

The room reuses the upstream Spline `Start` event, `Transition` actions, and material-alpha states. Each 27-second cycle contains three eight-second displays and one-second crossfades. There is no additional slideshow library. Frame placement, wooden frame meshes, room lighting and camera effects remain as in the source scene.

## Landscape frame: Ansel Adams

NARA's [Ansel Adams research page](https://www.archives.gov/research/ansel-adams) explicitly identifies the listed photographs in series 79-AA as public domain. Its exception for series 79-G does not apply to the selected images. The downloads are the reproductions published by NARA's [official archive blog](https://prologue.blogs.archives.gov/2025/02/05/archiveslandscape-ansel-adams/).

| File | Photograph | Date | Archive record |
| --- | --- | --- | --- |
| `adams-tetons.jpg` | The Tetons — Snake River | 1942 | [NARA 519904 / 79-AAG-1](https://catalog.archives.gov/id/519904) |
| `adams-mcdonald.jpg` | Evening, McDonald Lake, Glacier National Park | 1941 | [NARA 519861 / 79-AAE-6](https://catalog.archives.gov/id/519861) |
| `adams-canyon.jpg` | Canyon de Chelly | 1942 | [NARA 519852 / 79-AAC-2](https://catalog.archives.gov/id/519852) |

Credit: Ansel Adams / Records of the National Park Service / U.S. National Archives and Records Administration.

## Portrait frame: Dorothea Lange

The Library of Congress's [official Migrant Mother guide](https://guides.loc.gov/migrant-mother) states there are no known restrictions on the use of the series. Its [image guide](https://guides.loc.gov/migrant-mother/images) identifies all three selected negatives, their captions, and direct Library of Congress image files. The photographs depict Florence Owens Thompson and her children in Nipomo, California, in March 1936, during Lange's Resettlement Administration assignment; they belong to the FSA/OWI collection.

| File | Photograph / catalog identification | Archive record |
| --- | --- | --- |
| `lange-migrant-mother.jpg` | Migrant Mother, retouched negative; LC-USF34-9058-C | [LOC 2017762891](https://www.loc.gov/item/2017762891/) |
| `lange-family-9095.jpg` | Migrant agricultural worker's family; LC-USF34-9095 | [LOC 2017762905](https://www.loc.gov/item/2017762905/) |
| `lange-family-9097.jpg` | Migrant agricultural worker's family, seated view; LC-USF34-9097-C | [LOC 2017762907](https://www.loc.gov/item/2017762907/) |

Credit: Dorothea Lange / Library of Congress, Prints & Photographs Division, FSA/OWI Collection. The historical negatives' borders and markings have been retained. The archive's retouched Migrant Mother version is identified above; this project has not retouched it.

## Maintenance

`collection.json` records every exact download URL, photographer, source record, rights statement and SHA-256. `scripts/prepare-room.mjs` verifies those hashes before embedding the originals in `public/scene/room.splinecode`; it removes all four former personal-photo textures. Replace the manifest and image files together when intentionally changing the collection. The sources and rights statements were checked on 2026-10-27.

The room's wall-map pins are the source project's dart meshes, reduced to fit the seven supplied cities in Asia. Slight offsets separate nearby pins, especially Osaka and Nara, on the small stylized map. These are decorative approximate positions; the full-screen travel map contains the verified coordinates.
