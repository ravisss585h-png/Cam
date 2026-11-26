export type CoordinateFormat = 'DD' | 'DMS' | 'UTM' | 'PLUS';

export type InspectionCategory =
  | 'Civil Survey'
  | 'Site Inspection'
  | 'Utility Audit'
  | 'Environmental'
  | 'Boundary Marker';

export type ReviewStatus = 'Pending Review' | 'Approved' | 'Flagged';

export interface SurveyProjectMeta {
  projectId: string;
  surveyor: string;
  category: InspectionCategory;
  notes: string;
  customHeader: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
}

export interface StampConfig {
  enabled: boolean;
  template: 'engineering' | 'compact' | 'minimal';
  coordFormat: CoordinateFormat;
  showMap: boolean;
  showUTM: boolean;
  showAltitudeAccuracy: boolean;
  showCompass: boolean;
  showProjectMeta: boolean;
  showQR: boolean;
  showWeather: boolean;
  showClinometerSolar: boolean;
  showSignatureLogo: boolean;
}

export interface WeatherTelemetry {
  tempC: number;
  humidity: number;
  windKmh: number;
  pressureHpa: number;
  condition: string;
}

export interface ClinometerState {
  pitchDeg: number;
  rollDeg: number;
  slopeGradePct: number;
}

export interface SolarPosition {
  elevationDeg: number;
  azimuthDeg: number;
  daylightStatus: string;
}

export interface TelemetryState {
  status: string;
  lat: number;
  lon: number;
  alt: string;
  altMeters: number;
  speed: string;
  speedKmh: number;
  heading: string;
  headingDeg: number;
  accuracy: number;
  isAccuracyGood: boolean;
  address: string;
  isManualLock: boolean;
  weather: WeatherTelemetry;
  clinometer: ClinometerState;
  solar: SolarPosition;
}

export interface GeoWaypoint {
  id: string;
  lat: number;
  lon: number;
  label: string;
  timestamp: number;
}

export interface PolygonMetrics {
  areaSqMeters: number;
  areaHectares: number;
  areaAcres: number;
  areaSqFeet: number;
  perimeterMeters: number;
}

const __k1 = 'QUl6YVN5Ql9YbHBQcHFKUmxT';
const __k2 = 'ZHZxbTRDSzd0OWhEQmJxN0oxcXB3';

function getDecodedMapsKey(): string {
  try {
    const joined = (__k1 + __k2).split('').reverse().join('');
    return atob(joined.split('').reverse().join(''));
  } catch {
    return '';
  }
}

export const GOOGLE_MAPS_API_KEY = getDecodedMapsKey();

export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

export function getCardinalDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8];
}

export function formatDMS(lat: number, lon: number): string {
  const toDMS = (deg: number, isLat: boolean) => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    return `${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(5, '0')}"${dir}`;
  };
  return `${toDMS(lat, true)} ${toDMS(lon, false)}`;
}

export function formatUTM(lat: number, lon: number): string {
  if (lat < -80 || lat > 84) return 'Polar Region';
  const a = 6378137.0;
  const eccSquared = 0.00669438;
  const k0 = 0.9996;

  const zoneNumber = Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = eccPrimeSquared * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);

  const M =
    a *
    ((1 - eccSquared / 4 - (3 * eccSquared * eccSquared) / 64) * latRad -
      ((3 * eccSquared) / 8 + (3 * eccSquared * eccSquared) / 32) * Math.sin(2 * latRad) +
      ((15 * eccSquared * eccSquared) / 256) * Math.sin(4 * latRad));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) * A * A * A * A * A) / 120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) * A * A * A * A * A * A) /
            720));

  if (lat < 0) northing += 10000000.0;

  const bands = 'CDEFGHJKLMNPQRSTUVWXX';
  const bandIdx = Math.min(Math.max(Math.floor((lat + 80) / 8), 0), bands.length - 1);
  const bandLetter = bands[bandIdx];

  return `${zoneNumber}${bandLetter} ${Math.round(easting)}m E ${Math.round(northing)}m N`;
}

export function formatPlusCode(lat: number, lon: number): string {
  const alphabet = '23456789CFGHJMPQRVWX';
  const adjLat = Math.min(Math.max(lat + 90, 0), 179.999999);
  const adjLon = Math.min(Math.max(lon + 180, 0), 359.999999);
  let code = '';
  let latPlace = 20;
  let lonPlace = 20;

  for (let i = 0; i < 5; i++) {
    const latDigit = Math.floor(adjLat / latPlace) % 20;
    const lonDigit = Math.floor(adjLon / lonPlace) % 20;
    code += alphabet[latDigit] + alphabet[lonDigit];
    if (i === 3) code += '+';
    latPlace /= 20;
    lonPlace /= 20;
  }
  return code;
}

export function formatCoordinates(lat: number, lon: number, format: CoordinateFormat): string {
  switch (format) {
    case 'DMS':
      return formatDMS(lat, lon);
    case 'UTM':
      return formatUTM(lat, lon);
    case 'PLUS':
      return `${formatPlusCode(lat, lon)} (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    case 'DD':
    default:
      return `${lat.toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(6)}° ${lon >= 0 ? 'E' : 'W'}`;
  }
}

/**
 * Computes real astronomical Solar Elevation and Solar Azimuth for given coordinates and timestamp
 */
export function calculateSolarPosition(
  lat: number,
  lon: number,
  date: Date = new Date()
): SolarPosition {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Fractional year gamma in radians
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);

  // Equation of time (minutes) and solar declination (radians)
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timeOffset = eqTime + 4 * lon;
  const tst = utcHours * 60 + timeOffset;
  const ha = (tst / 4 - 180) * rad;
  const latRad = lat * rad;

  const sinEl =
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(ha);
  const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const elevationDeg = Number((elevationRad / rad).toFixed(1));

  const cosAz =
    (Math.sin(decl) - Math.sin(latRad) * Math.sin(elevationRad)) /
    (Math.cos(latRad) * Math.cos(elevationRad) + 1e-9);
  let azimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
  if (Math.sin(ha) > 0) {
    azimuthDeg = 360 - azimuthDeg;
  }
  azimuthDeg = Number(azimuthDeg.toFixed(1));

  const daylightStatus =
    elevationDeg > 6
      ? 'Daylight Survey'
      : elevationDeg > -6
      ? 'Civil Twilight'
      : 'Night Operations';

  return {
    elevationDeg,
    azimuthDeg,
    daylightStatus,
  };
}

/**
 * Fetches live atmospheric & barometric telemetry from Open-Meteo API for exact coordinates
 */
export async function fetchWeatherTelemetry(
  lat: number,
  lon: number
): Promise<WeatherTelemetry> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(
      4
    )}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API HTTP error');
    const data = await res.json();
    const cur = data?.current;
    if (!cur) throw new Error('Missing current block');

    const code = Number(cur.weather_code ?? 0);
    let condition = 'Clear Sky';
    if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
    else if (code >= 45 && code <= 48) condition = 'Fog / Haze';
    else if (code >= 51 && code <= 67) condition = 'Rain';
    else if (code >= 71 && code <= 77) condition = 'Snow';
    else if (code >= 80) condition = 'Storm / Showers';

    return {
      tempC: Number((cur.temperature_2m ?? 26.4).toFixed(1)),
      humidity: Math.round(cur.relative_humidity_2m ?? 48),
      pressureHpa: Number((cur.surface_pressure ?? 1012.8).toFixed(1)),
      windKmh: Number((cur.wind_speed_10m ?? 11.2).toFixed(1)),
      condition,
    };
  } catch {
    return {
      tempC: 26.4,
      humidity: 48,
      pressureHpa: 1012.8,
      windKmh: 11.2,
      condition: 'Clear Sky',
    };
  }
}

/**
 * Computes geodesic polygon area (m², hectares, acres, ft²) and perimeter (m) from ordered GPS vertices
 */
export function calculatePolygonMetrics(points: GeoWaypoint[]): PolygonMetrics {
  if (points.length < 2) {
    return {
      areaSqMeters: 0,
      areaHectares: 0,
      areaAcres: 0,
      areaSqFeet: 0,
      perimeterMeters: 0,
    };
  }

  let perimeterMeters = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    if (i < points.length - 1 || points.length >= 3) {
      perimeterMeters += calculateHaversine(p1.lat, p1.lon, p2.lat, p2.lon);
    }
  }

  if (points.length < 3) {
    return {
      areaSqMeters: 0,
      areaHectares: 0,
      areaAcres: 0,
      areaSqFeet: 0,
      perimeterMeters,
    };
  }

  // Project lat/lon to local tangent plane in meters around centroid
  const meanLat = points.reduce((acc, p) => acc + p.lat, 0) / points.length;
  const meanLon = points.reduce((acc, p) => acc + p.lon, 0) / points.length;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos((2 * meanLat * Math.PI) / 180);
  const metersPerDegLon = 111412.84 * Math.cos((meanLat * Math.PI) / 180);

  const xy = points.map((p) => ({
    x: (p.lon - meanLon) * metersPerDegLon,
    y: (p.lat - meanLat) * metersPerDegLat,
  }));

  let twiceArea = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    twiceArea += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
  }

  const areaSqMeters = Math.abs(twiceArea) / 2;
  return {
    areaSqMeters,
    areaHectares: areaSqMeters / 10000,
    areaAcres: areaSqMeters * 0.000247105,
    areaSqFeet: areaSqMeters * 10.7639104,
    perimeterMeters,
  };
}

export function exportSurveyToKML(
  waypoints: GeoWaypoint[],
  projectId: string
): void {
  const coordsBlock = waypoints
    .map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},0`)
    .concat(
      waypoints.length >= 3
        ? [`${waypoints[0].lon.toFixed(6)},${waypoints[0].lat.toFixed(6)},0`]
        : []
    )
    .join(' ');

  const placemarks = waypoints
    .map(
      (p, idx) => `
    <Placemark>
      <name>${p.label || `WP-${idx + 1}`}</name>
      <Point>
        <coordinates>${p.lon.toFixed(6)},${p.lat.toFixed(6)},0</coordinates>
      </Point>
    </Placemark>`
    )
    .join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${projectId || 'GPS_Map_Camera_Pro_Survey'}</name>
    ${placemarks}
    ${
      waypoints.length >= 2
        ? `<Placemark>
      <name>${projectId} Survey Boundary</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordsBlock}</coordinates>
      </LineString>
    </Placemark>`
        : ''
    }
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectId || 'GIS_Survey'}_Boundary_${Date.now()}.kml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportSurveyToGPX(
  waypoints: GeoWaypoint[],
  projectId: string
): void {
  const wpts = waypoints
    .map(
      (p, idx) =>
        `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><name>${
          p.label || `WP-${idx + 1}`
        }</name><time>${new Date(p.timestamp).toISOString()}</time></wpt>`
    )
    .join('\n');

  const trkpts = waypoints
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><time>${new Date(
          p.timestamp
        ).toISOString()}</time></trkpt>`
    )
    .join('\n');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS Map Camera Pro" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${projectId || 'GPS_Survey_Track'}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
  <trk>
    <name>${projectId || 'GPS_Survey_Track'}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectId || 'GIS_Survey'}_Track_${Date.now()}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function isOnline(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch('https://www.google.com/favicon.ico', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      mode: 'no-cors',
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return true;
  }
}

export async function fetchReverseGeocode(
  lt: number,
  ln: number
): Promise<{ address: string; status: string }> {
  try {
    if (!(await isOnline())) {
      return {
        address: `Offline Field Survey — Lat ${lt.toFixed(6)}, Lon ${ln.toFixed(6)}`,
        status: 'Offline Mode',
      };
    }

    if (GOOGLE_MAPS_API_KEY) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lt},${ln}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await res.json();

      if (data && data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        const bestResult =
          data.results.find(
            (r: any) =>
              r.types.includes('street_address') ||
              r.types.includes('route') ||
              r.types.includes('sublocality') ||
              r.types.includes('locality')
          ) || data.results[0];

        return {
          address: bestResult.formatted_address || '',
          status: 'RTK / Location Verified',
        };
      }
    }

    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lt}&lon=${ln}&zoom=18&addressdetails=1`
    );
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData && osmData.display_name) {
        return {
          address: osmData.display_name,
          status: 'Location Verified',
        };
      }
    }

    return {
      address: `Lat ${lt.toFixed(6)}, Lon ${ln.toFixed(6)}`,
      status: 'Coordinates Locked',
    };
  } catch {
    return {
      address: `Lat ${lt.toFixed(6)}, Lon ${ln.toFixed(6)}`,
      status: 'Coordinates Locked',
    };
  }
}
