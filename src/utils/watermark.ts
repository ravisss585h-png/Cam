import {
  formatCoordinates,
  formatDMS,
  formatUTM,
  getCardinalDirection,
  GOOGLE_MAPS_API_KEY,
  StampConfig,
  SurveyProjectMeta,
  TelemetryState,
} from '../services/locationService';

export interface CaptureOptions {
  video: HTMLVideoElement | null;
  facing: 'user' | 'environment';
  zoomLevel: number;
  aspectRatio: '4:3' | '16:9' | '1:1';
  stampConfig: StampConfig;
  projectMeta: SurveyProjectMeta;
  telemetry: TelemetryState;
}

function drawTacticalRadarMapFallback(
  ctx: CanvasRenderingContext2D,
  mapX: number,
  mapY: number,
  mapSize: number,
  telemetry: TelemetryState
) {
  ctx.fillStyle = '#0B0E17';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);

  ctx.strokeStyle = 'rgba(0, 230, 118, 0.16)';
  ctx.lineWidth = 1;
  const step = Math.round(mapSize / 4);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(mapX + i * step, mapY);
    ctx.lineTo(mapX + i * step, mapY + mapSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mapX, mapY + i * step);
    ctx.lineTo(mapX + mapSize, mapY + i * step);
    ctx.stroke();
  }

  // Concentric radar rings
  const cx = mapX + mapSize / 2;
  const cy = mapY + mapSize / 2;
  [0.22, 0.38].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, mapSize * r, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);

  // Pin marker
  ctx.fillStyle = '#00E676';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(5, mapSize * 0.045), 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${Math.max(9, Math.round(mapSize * 0.075))}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${telemetry.lat.toFixed(3)}, ${telemetry.lon.toFixed(3)}`,
    cx,
    mapY + mapSize - 10
  );
}

function renderIndustryStamp(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  mapImg: HTMLImageElement | null,
  stampConfig: StampConfig,
  projectMeta: SurveyProjectMeta,
  telemetry: TelemetryState
) {
  const padding = Math.round(canvasWidth * 0.028);
  const cardW = canvasWidth - padding * 2;
  const cardX = padding;
  const baseFS = Math.max(12, Math.round(canvasWidth * 0.022));

  if (stampConfig.template === 'minimal') {
    const barH = Math.round(baseFS * 3.4);
    const barY = canvasHeight - barH - padding;
    ctx.fillStyle = 'rgba(7, 9, 14, 0.82)';
    ctx.fillRect(cardX, barY, cardW, barH);
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cardX, barY, cardW, barH);

    ctx.fillStyle = '#00E676';
    ctx.font = `700 ${baseFS}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    const coordStr = formatCoordinates(telemetry.lat, telemetry.lon, stampConfig.coordFormat);
    ctx.fillText(coordStr, cardX + 16, barY + barH * 0.62);

    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`,
      cardX + cardW - 16,
      barY + barH * 0.62
    );
    return;
  }

  const showMap = stampConfig.showMap && stampConfig.template === 'engineering';
  const mapSize = showMap ? Math.round(canvasWidth * 0.21) : 0;
  const innerPad = Math.round(canvasWidth * 0.018);
  const cardH = showMap
    ? mapSize + innerPad * 2
    : Math.round(baseFS * (stampConfig.template === 'compact' ? 6.5 : 8.5));
  const cardY = canvasHeight - cardH - padding;

  // Card Background & Border
  ctx.fillStyle = 'rgba(7, 9, 14, 0.84)';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  // Top Header Strip inside Stamp Card
  const headerH = Math.round(baseFS * 1.65);
  ctx.fillStyle = 'rgba(17, 24, 39, 0.95)';
  ctx.fillRect(cardX + 1, cardY + 1, cardW - 2, headerH);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#00E676';
  ctx.font = `700 ${Math.round(baseFS * 0.8)}px "Plus Jakarta Sans", sans-serif`;
  const titleHeader =
    projectMeta.customHeader?.trim() || 'GPS MAP CAMERA PRO · SURVEY TELEMETRY';
  ctx.fillText(titleHeader.toUpperCase(), cardX + innerPad, cardY + headerH * 0.7);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${Math.round(baseFS * 0.75)}px "JetBrains Mono", monospace`;
  const now = new Date();
  const isoDate = now.toLocaleDateString('en-GB');
  const isoTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  ctx.fillText(`${isoDate} · ${isoTime}`, cardX + cardW - innerPad, cardY + headerH * 0.7);

  const bodyY = cardY + headerH + innerPad * 0.75;
  const mapX = cardX + innerPad;
  const mapY = bodyY;
  const mapBoxSize = cardH - headerH - innerPad * 1.5;

  if (showMap && mapBoxSize > 40) {
    if (mapImg) {
      try {
        ctx.drawImage(mapImg, mapX, mapY, mapBoxSize, mapBoxSize);
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX, mapY, mapBoxSize, mapBoxSize);
      } catch {
        drawTacticalRadarMapFallback(ctx, mapX, mapY, mapBoxSize, telemetry);
      }
    } else {
      drawTacticalRadarMapFallback(ctx, mapX, mapY, mapBoxSize, telemetry);
    }
  }

  const textX = showMap ? mapX + mapBoxSize + innerPad : cardX + innerPad;
  const maxTextW = cardX + cardW - textX - innerPad;
  let curY = bodyY + baseFS * 0.9;

  // Row 1: Location Summary / Address
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = `700 ${Math.round(baseFS * 1.05)}px "Plus Jakarta Sans", sans-serif`;
  const addrParts = (telemetry.address || 'Field Survey Location').split(',');
  const primaryLoc = addrParts.slice(0, 2).join(',').trim() || 'Field Survey Location';
  ctx.fillText(primaryLoc, textX, curY, maxTextW);

  // Row 2: Secondary Address line
  curY += baseFS * 1.15;
  ctx.fillStyle = '#CBD5E1';
  ctx.font = `400 ${Math.round(baseFS * 0.8)}px "Plus Jakarta Sans", sans-serif`;
  const fullAddr =
    telemetry.address.length > 85 ? telemetry.address.substring(0, 82) + '...' : telemetry.address;
  ctx.fillText(fullAddr, textX, curY, maxTextW);

  // Row 3: Primary Coordinates (DD / DMS / Plus)
  curY += baseFS * 1.25;
  ctx.fillStyle = '#00E676';
  ctx.font = `600 ${Math.round(baseFS * 0.88)}px "JetBrains Mono", monospace`;
  const primaryCoords = formatCoordinates(telemetry.lat, telemetry.lon, stampConfig.coordFormat);
  ctx.fillText(`COORD: ${primaryCoords}`, textX, curY, maxTextW);

  // Row 4: UTM & DMS Line
  if (stampConfig.showUTM) {
    curY += baseFS * 1.15;
    ctx.fillStyle = '#06B6D4';
    ctx.font = `500 ${Math.round(baseFS * 0.8)}px "JetBrains Mono", monospace`;
    ctx.fillText(
      `UTM: ${formatUTM(telemetry.lat, telemetry.lon)}  ·  DMS: ${formatDMS(
        telemetry.lat,
        telemetry.lon
      )}`,
      textX,
      curY,
      maxTextW
    );
  }

  // Row 5: Altitude, Accuracy, Azimuth
  if (stampConfig.showAltitudeAccuracy || stampConfig.showCompass) {
    curY += baseFS * 1.15;
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `500 ${Math.round(baseFS * 0.8)}px "JetBrains Mono", monospace`;
    const parts: string[] = [];
    if (stampConfig.showAltitudeAccuracy) {
      parts.push(`ALT: ${telemetry.alt}`);
      parts.push(
        `ACC: ±${telemetry.accuracy >= 999 ? '--' : Math.round(telemetry.accuracy)}m`
      );
    }
    if (stampConfig.showCompass) {
      const cardDir = getCardinalDirection(telemetry.headingDeg);
      parts.push(`AZIMUTH: ${telemetry.heading} (${cardDir})`);
      parts.push(`SPD: ${telemetry.speed}`);
    }
    ctx.fillText(parts.join('  ·  '), textX, curY, maxTextW);
  }

  // Row 6: Project Metadata (Project ID, Surveyor, Category, Notes)
  if (stampConfig.showProjectMeta) {
    curY += baseFS * 1.2;
    ctx.fillStyle = '#94A3B8';
    ctx.font = `600 ${Math.round(baseFS * 0.78)}px "Plus Jakarta Sans", sans-serif`;
    const metaLine = [
      projectMeta.projectId ? `PROJECT: ${projectMeta.projectId}` : '',
      projectMeta.category ? `TYPE: ${projectMeta.category}` : '',
      projectMeta.surveyor ? `SURVEYOR: ${projectMeta.surveyor}` : '',
      projectMeta.notes ? `NOTE: ${projectMeta.notes}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ');
    ctx.fillText(metaLine, textX, curY, maxTextW);
  }
}

export async function captureGeotaggedPhoto(options: CaptureOptions): Promise<{
  previewUrl: string;
  fullDataUrl: string;
}> {
  const { video, facing, zoomLevel, aspectRatio, stampConfig, projectMeta, telemetry } = options;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const hasLiveVideo = video && video.videoWidth > 0 && video.videoHeight > 0;
  const baseW = hasLiveVideo ? video!.videoWidth : 1600;
  let targetW = baseW;
  let targetH = Math.round((baseW * 3) / 4);

  if (aspectRatio === '16:9') {
    targetH = Math.round((baseW * 9) / 16);
  } else if (aspectRatio === '1:1') {
    targetH = baseW;
  }

  canvas.width = targetW;
  canvas.height = targetH;

  if (hasLiveVideo && video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = vw / zoomLevel;
    const cropH = vh / zoomLevel;
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;

    if (facing === 'user') {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    }
  } else {
    // High-precision simulated optical survey frame when no webcam is attached
    const grad = ctx.createLinearGradient(0, 0, 0, targetH);
    grad.addColorStop(0, '#0B111E');
    grad.addColorStop(0.5, '#111A2E');
    grad.addColorStop(1, '#070A12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetW, targetH);

    // Fine survey grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.lineWidth = 1;
    const gridStep = Math.round(targetW / 16);
    for (let x = 0; x < targetW; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, targetH);
      ctx.stroke();
    }
    for (let y = 0; y < targetH; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(targetW, y);
      ctx.stroke();
    }

    // Center optical crosshair
    const cx = targetW / 2;
    const cy = targetH * 0.38;
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 64, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 95, cy);
    ctx.lineTo(cx + 95, cy);
    ctx.moveTo(cx, cy - 95);
    ctx.lineTo(cx, cy + 95);
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = `600 ${Math.round(targetW * 0.018)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `OPTICAL BENCHMARK FRAME · ${projectMeta.projectId || 'PRJ-2026-01'} · ${zoomLevel}X`,
      cx,
      cy + 110
    );
  }

  if (!stampConfig.enabled) {
    return {
      previewUrl: canvas.toDataURL('image/jpeg', 0.88),
      fullDataUrl: canvas.toDataURL('image/jpeg', 0.95),
    };
  }

  if (!stampConfig.showMap || stampConfig.template !== 'engineering') {
    renderIndustryStamp(ctx, canvas.width, canvas.height, null, stampConfig, projectMeta, telemetry);
    return {
      previewUrl: canvas.toDataURL('image/jpeg', 0.88),
      fullDataUrl: canvas.toDataURL('image/jpeg', 0.95),
    };
  }

  await new Promise<void>((resolve) => {
    let isMapHandled = false;
    const mapImg = new Image();
    mapImg.crossOrigin = 'anonymous';

    const mapTimeout = setTimeout(() => {
      if (!isMapHandled) {
        isMapHandled = true;
        renderIndustryStamp(
          ctx,
          canvas.width,
          canvas.height,
          null,
          stampConfig,
          projectMeta,
          telemetry
        );
        resolve();
      }
    }, 3000);

    mapImg.onload = () => {
      if (isMapHandled) return;
      isMapHandled = true;
      clearTimeout(mapTimeout);
      renderIndustryStamp(
        ctx,
        canvas.width,
        canvas.height,
        mapImg,
        stampConfig,
        projectMeta,
        telemetry
      );
      resolve();
    };

    mapImg.onerror = () => {
      if (isMapHandled) return;
      isMapHandled = true;
      clearTimeout(mapTimeout);
      renderIndustryStamp(
        ctx,
        canvas.width,
        canvas.height,
        null,
        stampConfig,
        projectMeta,
        telemetry
      );
      resolve();
    };

    mapImg.src = `https://maps.googleapis.com/maps/api/staticmap?center=${telemetry.lat.toFixed(
      6
    )},${telemetry.lon.toFixed(
      6
    )}&zoom=16&size=300x300&scale=2&maptype=roadmap&markers=color:green|${telemetry.lat.toFixed(
      6
    )},${telemetry.lon.toFixed(6)}&key=${GOOGLE_MAPS_API_KEY}`;
  });

  return {
    previewUrl: canvas.toDataURL('image/jpeg', 0.88),
    fullDataUrl: canvas.toDataURL('image/jpeg', 0.95),
  };
}
