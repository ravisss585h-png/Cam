import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  formatCoordinates,
  formatDMS,
  formatUTM,
  getCardinalDirection,
  StampConfig,
  SurveyProjectMeta,
  TelemetryState,
} from '../services/locationService';

interface DataOverlayProps {
  telemetry: TelemetryState;
  stampConfig: StampConfig;
  projectMeta: SurveyProjectMeta;
}

export const DataOverlay: React.FC<DataOverlayProps> = ({
  telemetry,
  stampConfig,
  projectMeta,
}) => {
  const [timeStr, setTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  );
  const [dateStr, setDateStr] = useState<string>(() => new Date().toLocaleDateString('en-GB'));

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setDateStr(now.toLocaleDateString('en-GB'));
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!stampConfig.enabled) {
    return null;
  }

  const primaryCoords = formatCoordinates(telemetry.lat, telemetry.lon, stampConfig.coordFormat);
  const utmCoords = formatUTM(telemetry.lat, telemetry.lon);
  const dmsCoords = formatDMS(telemetry.lat, telemetry.lon);
  const cardinal = getCardinalDirection(telemetry.headingDeg);

  if (stampConfig.template === 'minimal') {
    return (
      <View style={styles.overlayWrapper} pointerEvents="none">
        <View style={styles.minimalBar}>
          <Text style={styles.monoPrimary} numberOfLines={1}>
            {primaryCoords}
          </Text>
          <Text style={styles.monoSecondary} numberOfLines={1}>
            {dateStr} · {timeStr}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlayWrapper} pointerEvents="none">
      <View style={styles.card}>
        {/* Header Bar */}
        <View style={styles.headerStrip}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {projectMeta.customHeader || 'GPS Map Camera Pro · Survey Telemetry'}
          </Text>
          <Text style={styles.headerTimestamp} numberOfLines={1}>
            {dateStr} · {timeStr}
          </Text>
        </View>

        <View style={styles.bodyRow}>
          {/* Radar / Map Thumbnail Box */}
          {stampConfig.showMap && stampConfig.template === 'engineering' && (
            <View style={styles.radarBox}>
              <View style={styles.radarRingOuter}>
                <View style={styles.radarRingInner}>
                  <View style={styles.radarPin} />
                </View>
              </View>
              <Text style={styles.radarCoordText} numberOfLines={1}>
                {telemetry.lat.toFixed(3)}, {telemetry.lon.toFixed(3)}
              </Text>
            </View>
          )}

          {/* Main Telemetry Column */}
          <View style={styles.telemetryCol}>
            <Text style={styles.addressPrimary} numberOfLines={1}>
              {telemetry.address}
            </Text>

            <Text style={styles.monoPrimary} numberOfLines={1}>
              {primaryCoords}
            </Text>

            {stampConfig.showUTM && (
              <Text style={styles.monoCyan} numberOfLines={1}>
                UTM {utmCoords} · {dmsCoords}
              </Text>
            )}

            {(stampConfig.showAltitudeAccuracy || stampConfig.showCompass) && (
              <Text style={styles.monoMeta} numberOfLines={1}>
                {stampConfig.showAltitudeAccuracy
                  ? `ALT ${telemetry.alt} · ACC ±${
                      telemetry.accuracy >= 999 ? '--' : Math.round(telemetry.accuracy)
                    }m`
                  : ''}
                {stampConfig.showAltitudeAccuracy && stampConfig.showCompass ? ' · ' : ''}
                {stampConfig.showCompass
                  ? `AZM ${telemetry.heading} ${cardinal} · SPD ${telemetry.speed}`
                  : ''}
              </Text>
            )}

            {stampConfig.showProjectMeta && (
              <Text style={styles.projectMetaLine} numberOfLines={1}>
                {projectMeta.projectId} · {projectMeta.category} · {projectMeta.surveyor}
                {projectMeta.notes ? ` · ${projectMeta.notes}` : ''}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    bottom: 108,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 15,
  },
  minimalBar: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: 'rgba(7, 9, 14, 0.86)',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: 'rgba(7, 9, 14, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerStrip: {
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerTimestamp: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  bodyRow: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  radarBox: {
    width: 78,
    height: 78,
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  radarRingOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRingInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPin: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  radarCoordText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontFamily: 'JetBrains Mono, monospace',
    marginTop: 4,
  },
  telemetryCol: {
    flex: 1,
    justifyContent: 'center',
  },
  addressPrimary: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  monoPrimary: {
    color: '#00E676',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 2,
  },
  monoSecondary: {
    color: '#F8FAFC',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  monoCyan: {
    color: '#06B6D4',
    fontSize: 10.5,
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 2,
  },
  monoMeta: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 2,
  },
  projectMetaLine: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
});
