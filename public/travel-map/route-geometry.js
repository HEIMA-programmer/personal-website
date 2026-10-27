const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
const dot = (a, b) => a.reduce((total, value, index) => total + value * b[index], 0);
const unit = vector => {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
};
const vector = ([longitude, latitude]) => {
  const lat = radians(latitude), lon = radians(longitude);
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
};
const validPoint = point => Array.isArray(point) && point.length === 2
  && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;

/** A smooth curve on the sphere, with an explicit illustrative sideways bow. */
export function curvedCoordinates(from, to, curvature = 0.18, segments = 96) {
  if (!validPoint(from) || !validPoint(to)) throw new Error('Route coordinates must be valid longitude/latitude pairs.');
  if (!Number.isFinite(curvature) || Math.abs(curvature) > 0.4 || !Number.isInteger(segments) || segments < 8 || segments > 256) throw new Error('Invalid route curvature or segment count.');
  const a = vector(from), b = vector(to);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (angle < 1e-7 || Math.PI - angle < 1e-7) throw new Error('Route endpoints must be distinct and non-antipodal.');
  const normal = unit([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
  return Array.from({ length: segments + 1 }, (_, index) => {
    if (index === 0) return [...from];
    if (index === segments) return [...to];
    const t = index / segments;
    const startWeight = Math.sin((1 - t) * angle) / Math.sin(angle);
    const endWeight = Math.sin(t * angle) / Math.sin(angle);
    const center = unit(a.map((value, axis) => value * startWeight + b[axis] * endWeight));
    const offset = angle * curvature * Math.sin(Math.PI * t);
    const point = unit(center.map((value, axis) => value * Math.cos(offset) + normal[axis] * Math.sin(offset)));
    return [degrees(Math.atan2(point[1], point[0])), degrees(Math.asin(Math.max(-1, Math.min(1, point[2]))))];
  });
}

export function buildIllustrativeRoutes(locations, configuration) {
  if (configuration.kind !== 'illustrative' || !Array.isArray(configuration.routes)) throw new Error('The map only accepts explicitly illustrative route data.');
  const cities = new Map(locations.features.map(feature => [feature.id, feature]));
  const used = new Set();
  return {
    type: 'FeatureCollection',
    features: configuration.routes.map(route => {
      const from = cities.get(route.from), to = cities.get(route.to);
      if (!route.id || used.has(route.id) || !from || !to || route.from === route.to) throw new Error(`Invalid illustrative route: ${route.id || 'unnamed'}`);
      used.add(route.id);
      return {
        type: 'Feature', id: route.id,
        properties: { featureType: 'illustrative-route', from: from.properties.name, to: to.properties.name, description: 'Illustrative route — not a flight record.' },
        geometry: { type: 'LineString', coordinates: curvedCoordinates(from.geometry.coordinates, to.geometry.coordinates, route.curvature) },
      };
    }),
  };
}
