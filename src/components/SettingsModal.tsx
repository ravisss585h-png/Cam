import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet } from 'react-native';
import {
  calculateBearing,
  calculateHaversine,
  CoordinateFormat,
  formatDMS,
  formatPlusCode,
  formatUTM,
  getCardinalDirection,
  InspectionCategory,
  StampConfig,
  SurveyProjectMeta,
  TelemetryState,
} from '../services/locationService';

const COORD_FORMATS: CoordinateFormat[] = ['DD', 'DMS', 'UTM', 'PLUS'];
const TEMPLATES: Array<{
  id: 'engineering' | 'compact' | 'minimal';
  title: string;
  desc: string;
}> = [
  {
    id: 'engineering',
    title: '01. Engineering & Civil Survey (Full GIS Block)',
    desc: 'Includes static map/radar box, DD & UTM coordinates, elevation, accuracy, azimuth, project ID, and surveyor remarks.',
  },
  {
    id: 'compact',
    title: '02. Compact Site Inspection',
    desc: 'Streamlined two-row bottom data card without map thumbnail for maximum scene visibility.',
  },
  {
    id: 'minimal',
    title: '03. Minimal Geotag Bar',
    desc: 'Single-line coordinate readout and UTC timestamp for unobtrusive documentation.',
  },
];

const CATEGORIES: InspectionCategory[] = [
  'Civil Survey',
  'Site Inspection',
  'Utility Audit',
  'Environmental',
  'Boundary Marker',
];

interface StampDesignerViewProps {
  stampConfig: StampConfig;
  projectMeta: SurveyProjectMeta;
  onChangeStampConfig: (next: StampConfig) => void;
  onChangeProjectMeta: (next: SurveyProjectMeta) => void;
}

export const StampDesignerView: React.FC<StampDesignerViewProps> = ({
  stampConfig,
  projectMeta,
  onChangeStampConfig,
  onChangeProjectMeta,
}) => {
  return (
    <ScrollView style={styles.workspace} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>01. Watermark Stamp & Survey Metadata Designer</Text>
        <Text style={styles.pageDesc}>
          Configure the geospatial telemetry overlay and project documentation attributes stamped onto every field report.
        </Text>
      </View>

      <View style={styles.twoColGrid}>
        {/* Left Column: Template & Field Toggles */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Watermark Layout Template</Text>

          {TEMPLATES.map((tpl) => {
            const active = stampConfig.template === tpl.id;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.templateOption, active && styles.templateOptionActive]}
                onPress={() => onChangeStampConfig({ ...stampConfig, template: tpl.id })}
              >
                <Text style={[styles.templateTitle, active && { color: '#00E676' }]}>
                  {tpl.title}
                </Text>
                <Text style={styles.templateDesc}>{tpl.desc}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.divider} />

          <Text style={styles.panelTitle}>Primary Coordinate Notation</Text>
          <View style={styles.segmentedRow}>
            {COORD_FORMATS.map((fmt) => {
              const active = stampConfig.coordFormat === fmt;
              return (
                <TouchableOpacity
                  key={fmt}
                  style={[styles.segBtn, active && styles.segBtnActive]}
                  onPress={() => onChangeStampConfig({ ...stampConfig, coordFormat: fmt })}
                >
                  <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>{fmt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable Watermark Stamping</Text>
            <Switch
              value={stampConfig.enabled}
              onValueChange={(val) => onChangeStampConfig({ ...stampConfig, enabled: val })}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Embed Static Map / Radar Thumbnail</Text>
            <Switch
              value={stampConfig.showMap}
              onValueChange={(val) => onChangeStampConfig({ ...stampConfig, showMap: val })}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Stamp Secondary UTM & DMS Line</Text>
            <Switch
              value={stampConfig.showUTM}
              onValueChange={(val) => onChangeStampConfig({ ...stampConfig, showUTM: val })}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Stamp Elevation & Accuracy (±m)</Text>
            <Switch
              value={stampConfig.showAltitudeAccuracy}
              onValueChange={(val) =>
                onChangeStampConfig({ ...stampConfig, showAltitudeAccuracy: val })
              }
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Stamp Compass Azimuth & Ground Speed</Text>
            <Switch
              value={stampConfig.showCompass}
              onValueChange={(val) => onChangeStampConfig({ ...stampConfig, showCompass: val })}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Stamp Project & Surveyor Attributes</Text>
            <Switch
              value={stampConfig.showProjectMeta}
              onValueChange={(val) =>
                onChangeStampConfig({ ...stampConfig, showProjectMeta: val })
              }
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>
        </View>

        {/* Right Column: Active Project & Surveyor Metadata */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Active Survey Project Metadata</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Stamp Header Title / Organization</Text>
            <input
              type="text"
              value={projectMeta.customHeader}
              onChange={(e) =>
                onChangeProjectMeta({ ...projectMeta, customHeader: e.target.value })
              }
              placeholder="GPS MAP CAMERA PRO · SURVEY TELEMETRY"
              style={{ width: '100%' }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Project / Site Code</Text>
            <input
              type="text"
              value={projectMeta.projectId}
              onChange={(e) => onChangeProjectMeta({ ...projectMeta, projectId: e.target.value })}
              placeholder="PRJ-2026-01"
              style={{ width: '100%' }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Lead Surveyor / Inspector Name</Text>
            <input
              type="text"
              value={projectMeta.surveyor}
              onChange={(e) => onChangeProjectMeta({ ...projectMeta, surveyor: e.target.value })}
              placeholder="Ravi Suryavanshi"
              style={{ width: '100%' }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Inspection Category</Text>
            <View style={styles.segmentedRow}>
              {CATEGORIES.map((cat) => {
                const active = projectMeta.category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.segBtn, active && styles.segBtnActive]}
                    onPress={() => onChangeProjectMeta({ ...projectMeta, category: cat })}
                  >
                    <Text style={[styles.segBtnText, active && styles.segBtnTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Field Remarks / Chainage Note</Text>
            <textarea
              rows={3}
              value={projectMeta.notes}
              onChange={(e) => onChangeProjectMeta({ ...projectMeta, notes: e.target.value })}
              placeholder="e.g., Benchmark Pillar BM-04 verified, clear sky conditions..."
              style={{ width: '100%', resize: 'vertical' }}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

interface CalibrationViewProps {
  telemetry: TelemetryState;
  accuracyLimit: number;
  distanceThrottle: number;
  highRes: boolean;
  showGrid: boolean;
  showHorizon: boolean;
  onChangeAccuracyLimit: (val: number) => void;
  onChangeDistanceThrottle: (val: number) => void;
  onToggleHighRes: (val: boolean) => void;
  onToggleGrid: (val: boolean) => void;
  onToggleHorizon: (val: boolean) => void;
  onManualCoordinateOverride: (lat: number, lon: number, lock: boolean) => void;
  onOpenPrivacyPolicy: () => void;
}

export const CalibrationView: React.FC<CalibrationViewProps> = ({
  telemetry,
  accuracyLimit,
  distanceThrottle,
  highRes,
  showGrid,
  showHorizon,
  onChangeAccuracyLimit,
  onChangeDistanceThrottle,
  onToggleHighRes,
  onToggleGrid,
  onToggleHorizon,
  onManualCoordinateOverride,
  onOpenPrivacyPolicy,
}) => {
  const [targetLat, setTargetLat] = useState<string>('28.612912');
  const [targetLon, setTargetLon] = useState<string>('77.229510');
  const [manualLat, setManualLat] = useState<string>(() => telemetry.lat.toFixed(6));
  const [manualLon, setManualLon] = useState<string>(() => telemetry.lon.toFixed(6));

  const parsedTargetLat = parseFloat(targetLat) || 0;
  const parsedTargetLon = parseFloat(targetLon) || 0;
  const distToBenchmark = calculateHaversine(
    telemetry.lat,
    telemetry.lon,
    parsedTargetLat,
    parsedTargetLon
  );
  const bearingToBenchmark = calculateBearing(
    telemetry.lat,
    telemetry.lon,
    parsedTargetLat,
    parsedTargetLon
  );

  return (
    <ScrollView style={styles.workspace} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerBlock}>
        <Text style={styles.pageTitle}>01. Sensor Calibration & Geodetic Benchmark Computer</Text>
        <Text style={styles.pageDesc}>
          Configure GNSS accuracy thresholds, optical viewfinder aids, manual coordinate locks, and waypoint offset calculations.
        </Text>
      </View>

      <View style={styles.twoColGrid}>
        {/* Left Column: GNSS & Optical Thresholds */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>GNSS & Optical Instrument Thresholds</Text>

          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.switchLabel}>Geocode Movement Trigger</Text>
              <Text style={styles.monoValue}>{accuracyLimit} m</Text>
            </View>
            <input
              type="range"
              min={5}
              max={250}
              step={5}
              value={accuracyLimit}
              onChange={(e) => onChangeAccuracyLimit(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </View>

          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.switchLabel}>Required Horizontal Accuracy Threshold</Text>
              <Text style={styles.monoValue}>±{distanceThrottle} m</Text>
            </View>
            <input
              type="range"
              min={5}
              max={150}
              step={5}
              value={distanceThrottle}
              onChange={(e) => onChangeDistanceThrottle(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>High-Resolution Sensor Capture (1080p)</Text>
            <Switch
              value={highRes}
              onValueChange={onToggleHighRes}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Optical 3×3 Rule-of-Thirds Grid</Text>
            <Switch
              value={showGrid}
              onValueChange={onToggleGrid}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Artificial Horizon & Crosshair Level</Text>
            <Switch
              value={showHorizon}
              onValueChange={onToggleHorizon}
              trackColor={{ false: '#1E293B', true: '#00E676' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.panelTitle}>Manual Benchmark Coordinate Lock</Text>
          <Text style={styles.templateDesc}>
            Lock coordinates to a fixed survey station when operating under dense canopy or inside tunnels.
          </Text>

          <View style={styles.coordInputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Latitude (DD)</Text>
              <input
                type="number"
                step="0.000001"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                style={{ width: '100%' }}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.fieldLabel}>Longitude (DD)</Text>
              <input
                type="number"
                step="0.000001"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                style={{ width: '100%' }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={() =>
                onManualCoordinateOverride(
                  parseFloat(manualLat) || telemetry.lat,
                  parseFloat(manualLon) || telemetry.lon,
                  true
                )
              }
            >
              <Text style={styles.actionBtnPrimaryText}>Lock Station Coordinates</Text>
            </TouchableOpacity>
            {telemetry.isManualLock && (
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={() => onManualCoordinateOverride(telemetry.lat, telemetry.lon, false)}
              >
                <Text style={styles.actionBtnSecondaryText}>Resume Live GNSS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Right Column: Geodetic Datum Matrix & Waypoint Distance Calculator */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Live Geodetic Datum Readout (WGS84)</Text>

          <View style={styles.datumTable}>
            <View style={styles.datumRow}>
              <Text style={styles.datumKey}>Decimal Degrees (DD)</Text>
              <Text style={styles.datumVal}>
                {telemetry.lat.toFixed(6)}°, {telemetry.lon.toFixed(6)}°
              </Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumKey}>Degrees Minutes Seconds</Text>
              <Text style={styles.datumVal}>{formatDMS(telemetry.lat, telemetry.lon)}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumKey}>Universal Transverse Mercator</Text>
              <Text style={styles.datumVal}>{formatUTM(telemetry.lat, telemetry.lon)}</Text>
            </View>
            <View style={styles.datumRow}>
              <Text style={styles.datumKey}>Open Location Plus Code</Text>
              <Text style={styles.datumVal}>{formatPlusCode(telemetry.lat, telemetry.lon)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.panelTitle}>Waypoint Offset & Azimuth Calculator</Text>
          <Text style={styles.templateDesc}>
            Compute real-time Haversine distance and forward azimuth bearing from current position to a target benchmark.
          </Text>

          <View style={styles.coordInputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Target Latitude</Text>
              <input
                type="number"
                step="0.000001"
                value={targetLat}
                onChange={(e) => setTargetLat(e.target.value)}
                style={{ width: '100%' }}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.fieldLabel}>Target Longitude</Text>
              <input
                type="number"
                step="0.000001"
                value={targetLon}
                onChange={(e) => setTargetLon(e.target.value)}
                style={{ width: '100%' }}
              />
            </View>
          </View>

          <View style={styles.metricReadoutGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>HORIZONTAL DISTANCE</Text>
              <Text style={styles.metricBig}>
                {distToBenchmark >= 1000
                  ? `${(distToBenchmark / 1000).toFixed(3)} km`
                  : `${distToBenchmark.toFixed(1)} m`}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>FORWARD AZIMUTH</Text>
              <Text style={styles.metricBig}>
                {bearingToBenchmark.toFixed(1)}° ({getCardinalDirection(bearingToBenchmark)})
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Regulatory & Data Privacy Policy</Text>
            <TouchableOpacity onPress={onOpenPrivacyPolicy}>
              <Text style={{ color: '#00E676', fontWeight: '700', fontSize: 13 }}>
                View Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    backgroundColor: '#07090E',
    padding: 24,
  },
  headerBlock: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 20,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  pageDesc: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  panel: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  templateOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B0E17',
    marginBottom: 10,
  },
  templateOptionActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.06)',
  },
  templateTitle: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segBtn: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 6,
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  segBtnActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  segBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  segBtnTextActive: {
    color: '#00E676',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  switchLabel: {
    color: '#E2E8F0',
    fontSize: 13.5,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  sliderBlock: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monoValue: {
    color: '#00E676',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
  },
  coordInputRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionBtnPrimary: {
    backgroundColor: '#00E676',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    color: '#07090E',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionBtnSecondaryText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  datumTable: {
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
  },
  datumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.5)',
  },
  datumKey: {
    color: '#94A3B8',
    fontSize: 12,
  },
  datumVal: {
    color: '#00E676',
    fontSize: 12,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: '600',
  },
  metricReadoutGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricBig: {
    color: '#06B6D4',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
  },
});
