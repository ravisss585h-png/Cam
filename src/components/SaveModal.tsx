import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { formatUTM, SurveyProjectMeta, TelemetryState } from '../services/locationService';

interface SaveModalProps {
  visible: boolean;
  previewUri: string;
  isSaving: boolean;
  telemetry: TelemetryState;
  projectMeta: SurveyProjectMeta;
  onDiscard: () => void;
  onConfirmSave: () => void;
}

export const SaveModal: React.FC<SaveModalProps> = ({
  visible,
  previewUri,
  isSaving,
  telemetry,
  projectMeta,
  onDiscard,
  onConfirmSave,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.modalBox}>
        <View style={styles.headerRow}>
          <Text style={styles.modalTitle}>Verify Survey Field Report</Text>
          <Text style={styles.metaSub}>
            {projectMeta.projectId} · {projectMeta.category}
          </Text>
        </View>

        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" />
        ) : null}

        <View style={styles.telemetrySummary}>
          <Text style={styles.summaryMono}>
            DD: {telemetry.lat.toFixed(6)}, {telemetry.lon.toFixed(6)} · UTM:{' '}
            {formatUTM(telemetry.lat, telemetry.lon)}
          </Text>
          <Text style={styles.summaryAddress} numberOfLines={1}>
            {telemetry.address}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDiscard]}
            onPress={onDiscard}
            disabled={isSaving}
          >
            <Text style={styles.btnDiscardText}>Discard Capture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnSave]}
            onPress={onConfirmSave}
            disabled={isSaving}
          >
            <Text style={styles.btnSaveText}>
              {isSaving ? 'Recording...' : 'Save to Field Log'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

interface SuccessModalProps {
  visible: boolean;
  onShare: () => void;
  onViewLog: () => void;
  onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  onShare,
  onViewLog,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.overlay, { zIndex: 20002 }]}>
      <View style={styles.successBox}>
        <span
          className="material-icons"
          style={{
            fontSize: 48,
            color: '#00E676',
            marginBottom: 12,
          }}
        >
          verified
        </span>

        <Text style={styles.successTitle}>Field Record Logged</Text>
        <Text style={styles.successSubtitle}>
          Geotagged image and GIS telemetry stored in local database and downloaded.
        </Text>

        <View style={styles.successFooter}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={onViewLog}>
            <Text style={styles.primaryActionBtnText}>Open Field Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>Share Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Continue Surveying</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 9, 14, 0.88)',
    zIndex: 3000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    width: '95%',
    maxWidth: 520,
  },
  headerRow: {
    marginBottom: 14,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  previewImg: {
    width: '100%',
    height: 280,
    backgroundColor: '#07090E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  telemetrySummary: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 18,
  },
  summaryMono: {
    color: '#00E676',
    fontSize: 11.5,
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 4,
  },
  summaryAddress: {
    color: '#94A3B8',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDiscard: {
    backgroundColor: '#1E293B',
    marginRight: 8,
  },
  btnSave: {
    backgroundColor: '#00E676',
    marginLeft: 8,
  },
  btnDiscardText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSaveText: {
    color: '#07090E',
    fontWeight: '700',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    width: '92%',
    maxWidth: 360,
  },
  successTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
    textAlign: 'center',
  },
  successFooter: {
    width: '100%',
  },
  primaryActionBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  primaryActionBtnText: {
    color: '#07090E',
    fontWeight: '700',
    fontSize: 14,
  },
  shareBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  shareBtnText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  closeBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
