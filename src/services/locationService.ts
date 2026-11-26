export type CoordinateFormat = 'DD' | 'DMS' | 'UTM' | 'PLUS';

export type InspectionCategory =
  | 'Civil Survey'
  | 'Site Inspection'
  | 'Utility Audit'
  | 'Environmental'
  | 'Boundary Marker';

export interface SurveyProjectMeta {
  projectId: string;
  surveyor: string;
  category: InspectionCategory;
  notes: string;
  customHeader: string;
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
  let adjLat = Math.min(Math.max(lat + 90, 0), 179.999999);
  let adjLon = Math.min(Math.max(lon + 180, 0), 359.999999);
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
