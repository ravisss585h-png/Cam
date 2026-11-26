import {
  formatDMS,
  formatUTM,
  InspectionCategory,
  ReviewStatus,
  SurveyProjectMeta,
} from './locationService';

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
  weatherSummary?: string;
  clinometerSummary?: string;
  solarSummary?: string;
  reviewStatus?: ReviewStatus;
  reviewer?: string;
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
        weatherSummary: meta?.weatherSummary || '',
        clinometerSummary: meta?.clinometerSummary || '',
        solarSummary: meta?.solarSummary || '',
        reviewStatus: meta?.reviewStatus || 'Pending Review',
        reviewer: meta?.reviewer || '',
      };
      const req = store.add(photo);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveToGalleryDB error:', err);
  }
}

export async function updatePhotoReviewStatus(
  id: number,
  reviewStatus: ReviewStatus,
  reviewer: string
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as SavedPhoto | undefined;
        if (!record) {
          resolve();
          return;
        }
        record.reviewStatus = reviewStatus;
        record.reviewer = reviewer;
        store.put(record);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('updatePhotoReviewStatus error:', err);
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
    'QA_Review_Status',
    'QA_Reviewer',
    'Latitude_DD',
    'Longitude_DD',
    'UTM_Coordinates',
    'DMS_Coordinates',
    'Altitude',
    'Accuracy_m',
    'Heading',
    'Weather_Telemetry',
    'Clinometer_Slope',
    'Solar_Position',
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
    p.reviewStatus || 'Pending Review',
    p.reviewer || '',
    (p.lat ?? 0).toFixed(6),
    (p.lon ?? 0).toFixed(6),
    p.utm || formatUTM(p.lat ?? 0, p.lon ?? 0),
    p.dms || formatDMS(p.lat ?? 0, p.lon ?? 0),
    p.altitude || '0.0m',
    Math.round(p.accuracy ?? 0),
    p.heading || '0°',
    p.weatherSummary || '',
    p.clinometerSummary || '',
    p.solarSummary || '',
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
        reviewStatus: p.reviewStatus || 'Pending Review',
        reviewer: p.reviewer || '',
        utm: p.utm || formatUTM(p.lat ?? 0, p.lon ?? 0),
        dms: p.dms || formatDMS(p.lat ?? 0, p.lon ?? 0),
        altitude: p.altitude || '0.0m',
        accuracy_m: Math.round(p.accuracy ?? 0),
        heading: p.heading || '0°',
        weather: p.weatherSummary || '',
        clinometer: p.clinometerSummary || '',
        solar: p.solarSummary || '',
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

/**
 * Generates a print-ready Multi-Photo Engineering Inspection Dossier (HTML/PDF Printable Report)
 */
export function exportPrintableInspectionDossier(
  photos: SavedPhoto[],
  projectMeta: SurveyProjectMeta
): void {
  const approvedCount = photos.filter((p) => p.reviewStatus === 'Approved').length;
  const flaggedCount = photos.filter((p) => p.reviewStatus === 'Flagged').length;

  const rowsHtml = photos
    .map(
      (p, idx) => `
      <div class="record-card">
        <div class="record-img-col">
          <img src="data:image/jpeg;base64,${p.data}" alt="Record ${idx + 1}" />
        </div>
        <div class="record-meta-col">
          <div class="record-header">
            <span class="record-num">#${String(p.id ?? idx + 1).padStart(3, '0')} · ${
        p.projectId || projectMeta.projectId
      }</span>
            <span class="record-status">${p.reviewStatus || 'Pending Review'}</span>
          </div>
          <h3>${p.address || 'Field Survey Waypoint'}</h3>
          <table class="meta-table">
            <tr><th>Category</th><td>${p.category || 'Civil Survey'}</td><th>Surveyor</th><td>${
        p.surveyor || projectMeta.surveyor
      }</td></tr>
            <tr><th>Decimal Degrees</th><td class="mono">${(p.lat ?? 0).toFixed(6)}, ${(
        p.lon ?? 0
      ).toFixed(6)}</td><th>UTM Grid</th><td class="mono">${
        p.utm || formatUTM(p.lat ?? 0, p.lon ?? 0)
      }</td></tr>
            <tr><th>Elevation / Acc</th><td class="mono">${p.altitude || '0.0m'} (±${Math.round(
        p.accuracy ?? 10
      )}m)</td><th>Timestamp</th><td class="mono">${new Date(
        p.timestamp
      ).toLocaleString()}</td></tr>
            <tr><th>Environment</th><td colspan="3" class="mono">${
              p.weatherSummary || 'Standard Conditions'
            } ${p.clinometerSummary ? `· ${p.clinometerSummary}` : ''}</td></tr>
            <tr><th>Remarks / QA</th><td colspan="3">${p.notes || 'No field remarks'} ${
        p.reviewer ? `· Reviewed by: ${p.reviewer}` : ''
      }</td></tr>
          </table>
        </div>
      </div>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GIS Inspection Dossier - ${projectMeta.projectId}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
  .dossier-container { max-width: 1040px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; padding: 36px; }
  .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
  .header-bar h1 { margin: 0 0 6px 0; font-size: 24px; letter-spacing: -0.3px; }
  .header-bar p { margin: 0; color: #475569; font-size: 13px; }
  .summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 16px; margin-bottom: 28px; }
  .summary-box .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
  .summary-box .val { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
  .record-card { display: flex; gap: 20px; border: 1px solid #cbd5e1; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
  .record-img-col { width: 320px; flex-shrink: 0; background: #000; display: flex; align-items: center; justify-content: center; }
  .record-img-col img { max-width: 100%; max-height: 240px; object-fit: contain; }
  .record-meta-col { flex: 1; }
  .record-header { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
  .record-meta-col h3 { margin: 0 0 12px 0; font-size: 16px; color: #0f172a; }
  .meta-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .meta-table th { text-align: left; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; width: 18%; }
  .meta-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #0f172a; }
  .mono { font-family: monospace; }
  @media print { body { background: #fff; padding: 0; } .dossier-container { border: none; padding: 0; } }
</style>
</head>
<body>
  <div class="dossier-container">
    <div class="header-bar">
      <div>
        <h1>${projectMeta.customHeader || 'GEOSPATIAL FIELD SURVEY & INSPECTION DOSSIER'}</h1>
        <p>Project ID: <strong>${projectMeta.projectId}</strong> · Lead Surveyor: <strong>${
    projectMeta.surveyor
  }</strong> · Category: <strong>${projectMeta.category}</strong></p>
      </div>
      <div style="text-align: right;">
        <p>Generated: <strong>${new Date().toLocaleString()}</strong></p>
        <p>Datum: <strong>WGS84 / UTM</strong></p>
      </div>
    </div>
    <div class="summary-strip">
      <div class="summary-box"><div class="lbl">Total Logged Waypoints</div><div class="val">${
        photos.length
      }</div></div>
      <div class="summary-box"><div class="lbl">QA Approved</div><div class="val">${approvedCount}</div></div>
      <div class="summary-box"><div class="lbl">Flagged for Re-Survey</div><div class="val">${flaggedCount}</div></div>
      <div class="summary-box"><div class="lbl">Project Reference</div><div class="val">${
        projectMeta.projectId
      }</div></div>
    </div>
    ${rowsHtml}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Inspection_Dossier_${projectMeta.projectId || 'Survey'}_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportTeamSyncBundle(
  photos: SavedPhoto[],
  projectMeta: SurveyProjectMeta
): void {
  const bundle = {
    schema: 'GPSMapCameraPro_TeamBundle_v2',
    exportedAt: new Date().toISOString(),
    projectMeta,
    records: photos,
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TeamSync_${projectMeta.projectId || 'Survey'}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importTeamSyncBundle(jsonContent: string): Promise<number> {
  const parsed = JSON.parse(jsonContent);
  const records: SavedPhoto[] = Array.isArray(parsed?.records) ? parsed.records : [];
  let imported = 0;
  for (const rec of records) {
    if (rec && rec.data) {
      await saveToGalleryDB(rec.data, {
        projectId: rec.projectId,
        surveyor: rec.surveyor,
        category: rec.category,
        notes: rec.notes,
        lat: rec.lat,
        lon: rec.lon,
        utm: rec.utm,
        dms: rec.dms,
        altitude: rec.altitude,
        accuracy: rec.accuracy,
        heading: rec.heading,
        address: rec.address,
        weatherSummary: rec.weatherSummary,
        clinometerSummary: rec.clinometerSummary,
        solarSummary: rec.solarSummary,
        reviewStatus: rec.reviewStatus,
        reviewer: rec.reviewer,
      });
      imported++;
    }
  }
  return imported;
}
