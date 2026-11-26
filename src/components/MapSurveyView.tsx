import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import {
  calculatePolygonMetrics,
  exportSurveyToGPX,
  exportSurveyToKML,
  formatUTM,
  GeoWaypoint,
  SurveyProjectMeta,
  TelemetryState,
} from '../services/locationService';
import { SavedPhoto } from '../services/galleryDb';

interface MapSurveyViewProps {
  telemetry: TelemetryState;
  projectMeta: SurveyProjectMeta;
  photos: SavedPhoto[];
  waypoints: GeoWaypoint[];
  isRecordingTrack: boolean;
  onAddWaypoint: (wp: GeoWaypoint) => void;
  onRemoveWaypoint: (id: string) => void;
  onClearWaypoints: () => void;
  onToggleTrackRecording: () => void;
}

export const MapSurveyView: React.FC<MapSurveyViewProps> = ({
  telemetry,
  projectMeta,
  photos,
  waypoints,
  isRecordingTrack,
  onAddWaypoint,
  onRemoveWaypoint,
  onClearWaypoints,
  onToggleTrackRecording,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPinInfo, setSelectedPinInfo] = useState<string>('');
  const [zoomScale, setZoomScale] = useState<number>(120000); // meters-to-pixels scale factor

  const metrics = calculatePolygonMetrics(waypoints);

  // Convert canvas click to lat/lon offset around current telemetry center
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const dLon = (clickX - cx) / zoomScale;
    const dLat = -(clickY - cy) / zoomScale;

    const newLat = Number((telemetry.lat + dLat).toFixed(6));
    const newLon = Number((telemetry.lon + dLon).toFixed(6));

    // Check if user clicked near an existing photo pin
    for (const p of photos) {
      if (p.lat && p.lon) {
        const px = cx + (p.lon - telemetry.lon) * zoomScale;
        const py = cy - (p.lat - telemetry.lat) * zoomScale;
        if (Math.hypot(clickX - px, clickY - py) < 16) {
          setSelectedPinInfo(
            `Photo Record #${p.id || ''} · ${p.projectId || projectMeta.projectId} · ${p.lat.toFixed(
              6
            )}, ${p.lon.toFixed(6)} · ${p.address || ''}`
          );
          return;
        }
      }
    }

    const wpIndex = waypoints.length + 1;
    onAddWaypoint({
      id: `wp-${Date.now()}-${wpIndex}`,
      lat: newLat,
      lon: newLon,
      label: `BM-${String(wpIndex).padStart(2, '0')}`,
      timestamp: Date.now(),
    });
  };

  const handleAddCurrentGpsPosition = () => {
    const wpIndex = waypoints.length + 1;
    onAddWaypoint({
      id: `wp-${Date.now()}-${wpIndex}`,
      lat: telemetry.lat,
      lon: telemetry.lon,
      label: `GPS-${String(wpIndex).padStart(2, '0')}`,
      timestamp: Date.now(),
    });
  };

  const handleLoadSampleBoundary = () => {
    onClearWaypoints();
    const d = 0.00085;
    const baseLat = telemetry.lat;
    const baseLon = telemetry.lon;
    const samplePts = [
      { lat: baseLat + d, lon: baseLon - d, label: 'BM-01 (NW)' },
      { lat: baseLat + d * 1.1, lon: baseLon + d, label: 'BM-02 (NE)' },
      { lat: baseLat - d * 0.9, lon: baseLon + d * 1.2, label: 'BM-03 (SE)' },
      { lat: baseLat - d, lon: baseLon - d * 0.8, label: 'BM-04 (SW)' },
    ];
    samplePts.forEach((pt, idx) => {
      onAddWaypoint({
        id: `sample-${Date.now()}-${idx}`,
        lat: Number(pt.lat.toFixed(6)),
        lon: Number(pt.lon.toFixed(6)),
        label: pt.label,
        timestamp: Date.now() + idx,
      });
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, w, h);

    // Coordinate Grid Lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const gridSpacing = 60;
    for (let x = cx % gridSpacing; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = cy % gridSpacing; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center Axes
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // Draw Polygon Boundary & Fill if >= 2 waypoints
    if (waypoints.length >= 2) {
      ctx.beginPath();
      waypoints.forEach((wp, idx) => {
        const x = cx + (wp.lon - telemetry.lon) * zoomScale;
        const y = cy - (wp.lat - telemetry.lat) * zoomScale;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (waypoints.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 230, 118, 0.14)';
        ctx.fill();
      }
      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Waypoint Vertices
    waypoints.forEach((wp) => {
      const x = cx + (wp.lon - telemetry.lon) * zoomScale;
      const y = cy - (wp.lat - telemetry.lat) * zoomScale;

      ctx.fillStyle = '#00E676';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#07090E';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(wp.label, x + 10, y + 4);
    });

    // Draw Captured Photo Pins from Field Log
    photos.forEach((p, idx) => {
      if (p.lat === undefined || p.lon === undefined) return;
      const x = cx + (p.lon - telemetry.lon) * zoomScale;
      const y = cy - (p.lat - telemetry.lat) * zoomScale;

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#06B6D4';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`IMG-${p.id ?? idx + 1}`, x, y - 11);
    });

    // Draw Current GNSS Fix Reticle at Center
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Scale Legend
    const scaleMeters = Math.round((100 / zoomScale) * 111320);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `CENTER: ${telemetry.lat.toFixed(6)}, ${telemetry.lon.toFixed(6)} · 100px ≈ ${scaleMeters}m`,
      16,
      h - 16
    );
  }, [waypoints, photos, telemetry.lat, telemetry.lon, zoomScale]);

  return (
    <View style={styles.workspace}>
      {/* Top Toolbar */}
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.sectionTitle}>
            01. GIS Polygon Survey Plotter & Land Area Computer
          </Text>
          <Text style={styles.sectionMeta}>
            Click anywhere on the geodetic plotter to drop boundary benchmarks, or record a live GPS perimeter walk.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              isRecordingTrack && { borderColor: '#F43F5E', backgroundColor: 'rgba(244,63,94,0.12)' },
            ]}
            onPress={onToggleTrackRecording}
          >
            <Text
              style={[
                styles.secondaryBtnText,
                isRecordingTrack && { color: '#F43F5E' },
              ]}
            >
              {isRecordingTrack ? '● Stop GPS Track' : 'Record GPS Track'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddCurrentGpsPosition}>
            <Text style={styles.secondaryBtnText}>+ Drop Current GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleLoadSampleBoundary}>
            <Text style={styles.secondaryBtnText}>Load Sample Parcel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => exportSurveyToGPX(waypoints, projectMeta.projectId)}
            disabled={waypoints.length === 0}
          >
            <Text style={styles.secondaryBtnText}>Export GPX</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => exportSurveyToKML(waypoints, projectMeta.projectId)}
            disabled={waypoints.length === 0}
          >
            <Text style={styles.primaryBtnText}>Export KML</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Split: Left Plotter Canvas + Right Area & Vertex Inspector */}
      <View style={styles.splitGrid}>
        <View style={styles.plotterBox}>
          <View style={styles.plotterOverlayTop}>
            <Text style={styles.legendText}>
              ● Amber: Active GNSS Station  ·  ● Emerald: Parcel Boundary Vertices ({waypoints.length})  ·  ● Cyan: Logged Photos ({photos.length})
            </Text>

            <View style={styles.zoomGroup}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoomScale((s) => Math.min(s * 1.5, 900000))}
              >
                <Text style={styles.zoomBtnText}>+ Zoom In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoomScale((s) => Math.max(s / 1.5, 15000))}
              >
                <Text style={styles.zoomBtnText}>- Zoom Out</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomBtn} onPress={onClearWaypoints}>
                <Text style={[styles.zoomBtnText, { color: '#F43F5E' }]}>Clear Parcel</Text>
              </TouchableOpacity>
            </View>
          </View>

          <canvas
            ref={canvasRef}
            width={820}
            height={500}
            onClick={handleCanvasClick}
            style={{
              width: '100%',
              height: '100%',
              cursor: 'crosshair',
              display: 'block',
            }}
          />

          {selectedPinInfo ? (
            <View style={styles.pinBanner}>
              <Text style={styles.pinBannerText}>{selectedPinInfo}</Text>
            </View>
          ) : null}
        </View>

        {/* Right Column: Computed Geodesic Land Area & Boundary Table */}
        <ScrollView style={styles.metricsPanel} contentContainerStyle={{ padding: 18 }}>
          <Text style={styles.panelTitle}>Computed Parcel Area & Perimeter</Text>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>SURFACE AREA (M²)</Text>
              <Text style={styles.kpiValue}>{metrics.areaSqMeters.toFixed(1)} m²</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>PERIMETER LENGTH</Text>
              <Text style={styles.kpiValue}>{metrics.perimeterMeters.toFixed(1)} m</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>HECTARES / ACRES</Text>
              <Text style={styles.kpiValueCyan}>
                {metrics.areaHectares.toFixed(4)} ha · {metrics.areaAcres.toFixed(4)} ac
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>SQUARE FEET (FT²)</Text>
              <Text style={styles.kpiValueCyan}>{Math.round(metrics.areaSqFeet)} ft²</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.panelTitle}>
            Boundary Benchmark Vertices ({waypoints.length})
          </Text>

          {waypoints.length === 0 ? (
            <Text style={styles.emptyHint}>
              No boundary vertices plotted yet. Click on the coordinate canvas or tap "+ Drop Current GPS" to measure a land parcel.
            </Text>
          ) : (
            waypoints.map((wp, idx) => (
              <View key={wp.id} style={styles.wpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wpTitle}>
                    {idx + 1}. {wp.label}
                  </Text>
                  <Text style={styles.wpMono}>
                    {wp.lat.toFixed(6)}, {wp.lon.toFixed(6)} · {formatUTM(wp.lat, wp.lon)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onRemoveWaypoint(wp.id)}
                  style={styles.removeWpBtn}
                >
                  <Text style={styles.removeWpText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    backgroundColor: '#07090E',
    padding: 20,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#94A3B8',
    fontSize: 12.5,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#07090E',
    fontSize: 12.5,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '600',
  },
  splitGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    overflow: 'hidden',
  },
  plotterBox: {
    flex: 2,
    minWidth: 340,
    height: '100%',
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  plotterOverlayTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(11, 14, 23, 0.88)',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legendText: {
    color: '#CBD5E1',
    fontSize: 11.5,
  },
  zoomGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  zoomBtnText: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '600',
  },
  pinBanner: {
    position: 'absolute',
    bottom: 42,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderWidth: 1,
    borderColor: '#06B6D4',
    borderRadius: 8,
    padding: 10,
  },
  pinBannerText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontFamily: 'JetBrains Mono, monospace',
  },
  metricsPanel: {
    flex: 1,
    minWidth: 300,
    maxWidth: 420,
    height: '100%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 12,
  },
  kpiGrid: {
    gap: 10,
  },
  kpiBox: {
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    color: '#00E676',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
  },
  kpiValueCyan: {
    color: '#06B6D4',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  emptyHint: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 19,
  },
  wpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.6)',
  },
  wpTitle: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '600',
  },
  wpMono: {
    color: '#00E676',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    marginTop: 2,
  },
  removeWpBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeWpText: {
    color: '#F43F5E',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
