import { formatDMS, formatUTM, InspectionCategory } from './locationService';

export interface SavedPhoto {
  id?: number;
  data: string;
  date: string;
  timestamp: number;
  projectId?: string;
  surveyor?: string;
  category?: InspectionCategory;
  notes?: string;
  lat?: number;
  lon?: number;
  utm?: string;
  dms?: string;
  altitude?: string;
  accuracy?: number;
  heading?: string;
  address?: string;
}

const DB_NAME = 'GPSCamDB';
const STORE_NAME = 'photos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e: Event) => {
      resolve((e.target as IDBOpenDBRequest).result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveToGalleryDB(
  base64Data: string,
  meta?: Omit<SavedPhoto, 'id' | 'data' | 'date' | 'timestamp'>
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const lat = meta?.lat ?? 0;
      const lon = meta?.lon ?? 0;
      const photo: SavedPhoto = {
        data: base64Data,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        projectId: meta?.projectId || 'PRJ-2026-01',
        surveyor: meta?.surveyor || 'Field Engineer',
        category: meta?.category || 'Civil Survey',
        notes: meta?.notes || '',
        lat,
        lon,
        utm: meta?.utm || formatUTM(lat, lon),
        dms: meta?.dms || formatDMS(lat, lon),
        altitude: meta?.altitude || '0.0m',
        accuracy: meta?.accuracy ?? 12,
        heading: meta?.heading || '0°',
        address: meta?.address || '',
      };
      const req = store.add(photo);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveToGalleryDB error:', err);
  }
}

export async function getAllGalleryPhotos(): Promise<SavedPhoto[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const photos = (req.result as SavedPhoto[]) || [];
        resolve(photos.slice().reverse());
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('getAllGalleryPhotos error:', err);
    return [];
  }
}

export async function deleteGalleryPhoto(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);
      transaction.oncomplete = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('deleteGalleryPhoto error:', err);
  }
}

export function exportPhotosToCSV(photos: SavedPhoto[]): void {
  const headers = [
    'Record_ID',
    'ISO_Timestamp',
    'Project_ID',
    'Surveyor',
    'Category',
    'Latitude_DD',
    'Longitude_DD',
    'UTM_Coordinates',
    'DMS_Coordinates',
    'Altitude',
    'Accuracy_m',
    'Heading',
    'Address',
    'Field_Notes',
  ];

  const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = photos.map((p, idx) => [
    p.id ?? idx + 1,
    p.date || new Date(p.timestamp).toISOString(),
    p.projectId || 'PRJ-2026-01',
    p.surveyor || 'Field Engineer',
    p.category || 'Civil Survey',
    (p.lat ?? 0).toFixed(6),
    (p.lon ?? 0).toFixed(6),
    p.utm || formatUTM(p.lat ?? 0, p.lon ?? 0),
    p.dms || formatDMS(p.lat ?? 0, p.lon ?? 0),
    p.altitude || '0.0m',
    Math.round(p.accuracy ?? 0),
    p.heading || '0°',
    p.address || '',
    p.notes || '',
  ]);

  const csvContent =
    headers.join(',') + '\n' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GIS_Survey_Export_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPhotosToGeoJSON(photos: SavedPhoto[]): void {
  const geojson = {
    type: 'FeatureCollection',
    name: 'GPS_Map_Camera_Pro_Survey',
    features: photos.map((p, idx) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lon ?? 0, p.lat ?? 0],
      },
      properties: {
        id: p.id ?? idx + 1,
        timestamp: p.date || new Date(p.timestamp).toISOString(),
        projectId: p.projectId || 'PRJ-2026-01',
        surveyor: p.surveyor || 'Field Engineer',
        category: p.category || 'Civil Survey',
        utm: p.utm || formatUTM(p.lat ?? 0, p.lon ?? 0),
        dms: p.dms || formatDMS(p.lat ?? 0, p.lon ?? 0),
        altitude: p.altitude || '0.0m',
        accuracy_m: Math.round(p.accuracy ?? 0),
        heading: p.heading || '0°',
        address: p.address || '',
        notes: p.notes || '',
      },
    })),
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], {
    type: 'application/geo+json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GIS_Survey_Waypoints_${Date.now()}.geojson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
