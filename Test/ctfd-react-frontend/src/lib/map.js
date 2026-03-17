export const TALLINN_FALLBACK = { lat: 59.437, lng: 24.7536 };

export function getGeoBounds(geoJson) {
  const coordinates = [];
  const geometry = geoJson?.geometry;
  if (!geometry) return null;

  const collect = (value) => {
    if (Array.isArray(value[0])) {
      value.forEach(collect);
    } else {
      coordinates.push(value);
    }
  };

  collect(geometry.coordinates);

  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

function isPointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

function isPointInPolygon(point, polygon) {
  if (!polygon?.length) return false;
  if (!isPointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (isPointInRing(point, polygon[i])) return false;
  }
  return true;
}

export function isPointOnEstonia(geoJson, lng, lat) {
  const geometry = geoJson?.geometry;
  if (!geometry) return false;
  const point = [lng, lat];

  if (geometry.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => isPointInPolygon(point, polygon));
  }

  return false;
}

export function projectPoint({ lat, lng }, bounds, width = 1000, height = 1500) {
  const x = ((lng - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
  const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
  return { x, y };
}

export function unprojectPoint({ x, y }, bounds, width = 1000, height = 1500) {
  const lng = bounds.minLon + (x / width) * (bounds.maxLon - bounds.minLon);
  const lat = bounds.minLat + ((height - y) / height) * (bounds.maxLat - bounds.minLat);
  return { lat, lng };
}

export function buildSvgPaths(geoJson, bounds, width = 1000, height = 1500) {
  const geometry = geoJson?.geometry;
  if (!geometry) return [];

  const toPath = (ringSet) => ringSet.map((ring) => ring.map(([lon, lat], index) => {
    const { x, y } = projectPoint({ lat, lng: lon }, bounds, width, height);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ") + " Z").join(" ");

  if (geometry.type === "Polygon") {
    return [toPath(geometry.coordinates)];
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => toPath(polygon));
  }

  return [];
}

export function resolveChallengePoint(challenge, geoJson, bounds, width = 1000, height = 1500) {
  const lat = Number(challenge.lat);
  const lng = Number(challenge.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const point = hasCoords ? { lat, lng } : TALLINN_FALLBACK;
  const projected = projectPoint(point, bounds, width, height);

  return {
    ...projected,
    usedTallinnFallback: !hasCoords,
    point
  };
}
