import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatUTM, SurveyProjectMeta, TelemetryState } from '../services/locationService';

type CadTool = 'arrow' | 'circle' | 'pen' | 'text';

interface CadShape {
  tool: CadTool;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
}

interface SaveModalProps {
  visible: boolean;
  previewUri: string;
  isSaving: boolean;
  telemetry: TelemetryState;
  projectMeta: SurveyProjectMeta;
  onDiscard: () => void;
  onConfirmSave: (finalAnnotatedDataUrl?: string) => void;
}

const CAD_COLORS = ['#00E676', '#F43F5E', '#F59E0B', '#06B6D4'];

export const SaveModal: React.FC<SaveModalProps> = ({
  visible,
  previewUri,
  isSaving,
  telemetry,
  projectMeta,
  onDiscard,
  onConfirmSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  const [activeTool, setActiveTool] = useState<CadTool>('arrow');
  const [activeColor, setActiveColor] = useState<string>('#F43F5E');
  const [calloutText, setCalloutText] = useState<string>('DEFECT / BM-01');
  const [shapes, setShapes] = useState<CadShape[]>([]);
  const [draftShape, setDraftShape] = useState<CadShape | null>(null);

  // Load captured preview image onto interactive CAD canvas
  useEffect(() => {
    if (!visible || !previewUri) {
      setShapes([]);
      setDraftShape(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      baseImageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.width;
        canvas.height = img.height;
        redrawCanvas(canvas, img, [], null);
      }
    };
    img.src = previewUri;
  }, [visible, previewUri]);

  const drawSingleShape = (ctx: CanvasRenderingContext2D, s: CadShape, scale: number) => {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(3, Math.round(3.5 * scale));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.tool === 'arrow') {
      const headLen = Math.max(14, Math.round(18 * scale));
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle - Math.PI / 6),
        s.y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        s.x2 - headLen * Math.cos(angle + Math.PI / 6),
        s.y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (s.tool === 'circle') {
      const r = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, Math.max(8, r), 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.tool === 'pen' && s.points && s.points.length > 1) {
      ctx.beginPath();
      s.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    } else if (s.tool === 'text' && s.text) {
      const fs = Math.max(16, Math.round(22 * scale));
      ctx.font = `700 ${fs}px "JetBrains Mono", monospace`;
      const metrics = ctx.measureText(s.text);
      const pad = Math.round(8 * scale);
      ctx.fillStyle = 'rgba(7, 9, 14, 0.85)';
      ctx.fillRect(s.x1 - pad, s.y1 - fs - pad / 2, metrics.width + pad * 2, fs + pad);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(2, Math.round(2 * scale));
      ctx.strokeRect(s.x1 - pad, s.y1 - fs - pad / 2, metrics.width + pad * 2, fs + pad);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x1, s.y1);
    }
  };

  const redrawCanvas = (
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
    committed: CadShape[],
    current: CadShape | null
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scale = canvas.width / 1000;
    committed.forEach((s) => drawSingleShape(ctx, s, scale));
    if (current) drawSingleShape(ctx, current, scale);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (canvas && img) {
      redrawCanvas(canvas, img, shapes, draftShape);
    }
  }, [shapes, draftShape]);

  if (!visible) return null;

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    if (activeTool === 'text') {
      const label = calloutText.trim() || 'BENCHMARK';
      setShapes((prev) => [
        ...prev,
        { tool: 'text', color: activeColor, x1: x, y1: y, x2: x, y2: y, text: label },
      ]);
      return;
    }

    setDraftShape({
      tool: activeTool,
      color: activeColor,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      points: activeTool === 'pen' ? [{ x, y }] : undefined,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draftShape) return;
    const { x, y } = getCanvasCoords(e);
    if (draftShape.tool === 'pen') {
      setDraftShape({
        ...draftShape,
        x2: x,
        y2: y,
        points: [...(draftShape.points || []), { x, y }],
      });
    } else {
      setDraftShape({ ...draftShape, x2: x, y2: y });
    }
  };

  const handleMouseUp = () => {
    if (!draftShape) return;
    setShapes((prev) => [...prev, draftShape]);
    setDraftShape(null);
  };

  const handleFinalizeAndSave = () => {
    const canvas = canvasRef.current;
    if (canvas && shapes.length > 0) {
      onConfirmSave(canvas.toDataURL('image/jpeg', 0.95));
    } else {
      onConfirmSave();
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.modalBox}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.modalTitle}>
              Verify Field Report & CAD Redline Markup
            </Text>
            <Text style={styles.metaSub}>
              {projectMeta.projectId} · {projectMeta.category} · Draw arrows, defect circles, or
              callout labels directly onto the stamped image
            </Text>
          </View>
        </View>

        {/* CAD Redline Toolbar */}
        <View style={styles.cadToolbar}>
          <View style={styles.toolGroup}>
            {(
              [
                { id: 'arrow', label: 'Arrow' },
                { id: 'circle', label: 'Defect Circle' },
                { id: 'pen', label: 'Redline Pen' },
                { id: 'text', label: 'Place Callout' },
              ] as Array<{ id: CadTool; label: string }>
            ).map((t) => {
              const active = activeTool === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.toolBtn, active && styles.toolBtnActive]}
                  onPress={() => setActiveTool(t.id)}
                >
                  <Text style={[styles.toolBtnText, active && styles.toolBtnTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTool === 'text' && (
            <input
              type="text"
              value={calloutText}
              onChange={(e) => setCalloutText(e.target.value)}
              placeholder="Callout label..."
              style={{ width: 150, padding: '5px 8px', fontSize: 12 }}
            />
          )}

          <View style={styles.colorGroup}>
            {CAD_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setActiveColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  activeColor === c && styles.colorSwatchActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.toolGroup}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setShapes((prev) => prev.slice(0, -1))}
              disabled={shapes.length === 0}
            >
              <Text style={styles.toolBtnText}>Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setShapes([])}
              disabled={shapes.length === 0}
            >
              <Text style={styles.toolBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive CAD Canvas */}
        <View style={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              maxWidth: '100%',
              maxHeight: 340,
              objectFit: 'contain',
              cursor: 'crosshair',
              display: 'block',
            }}
          />
        </View>

        <View style={styles.telemetrySummary}>
          <Text style={styles.summaryMono}>
            DD: {telemetry.lat.toFixed(6)}, {telemetry.lon.toFixed(6)} · UTM:{' '}
            {formatUTM(telemetry.lat, telemetry.lon)} · ENV: {telemetry.weather.tempC}°C (
            {telemetry.weather.pressureHpa} hPa)
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
            onPress={handleFinalizeAndSave}
            disabled={isSaving}
          >
            <Text style={styles.btnSaveText}>
              {isSaving ? 'Recording...' : 'Save Annotated Field Report'}
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
          Geotagged image, CAD annotations, and GIS telemetry stored in local database and downloaded.
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
    backgroundColor: 'rgba(7, 9, 14, 0.9)',
    zIndex: 3000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    width: '96%',
    maxWidth: 680,
  },
  headerRow: {
    marginBottom: 12,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },
  metaSub: {
    color: '#94A3B8',
    fontSize: 12,
  },
  cadToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#0B0E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 6,
    marginBottom: 12,
    gap: 8,
  },
  toolGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  toolBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  toolBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#00E676',
  },
  toolBtnText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  toolBtnTextActive: {
    color: '#00E676',
  },
  colorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  canvasContainer: {
    width: '100%',
    height: 340,
    backgroundColor: '#07090E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  telemetrySummary: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  summaryMono: {
    color: '#00E676',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 3,
  },
  summaryAddress: {
    color: '#94A3B8',
    fontSize: 11.5,
  },
  footer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
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
    fontSize: 13.5,
  },
  btnSaveText: {
    color: '#07090E',
    fontWeight: '700',
    fontSize: 13.5,
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
