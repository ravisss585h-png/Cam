import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Media } from '@capacitor-community/media';
import { SplashScreen } from './components/SplashScreen';
import { PermissionScreen } from './components/PermissionScreen';
import { DataOverlay } from './components/DataOverlay';
import { StampDesignerView, CalibrationView } from './components/SettingsModal';
import { SaveModal, SuccessModal } from './components/SaveModal';
import { FieldLogView, PrivacyPolicyModal } from './components/GalleryModal';
import { MapSurveyView } from './components/MapSurveyView';
import {
  calculateHaversine,
  calculateSolarPosition,
  ClinometerState,
  CoordinateFormat,
  fetchReverseGeocode,
  fetchWeatherTelemetry,
  formatDMS,
  formatPlusCode,
  formatUTM,
  GeoWaypoint,
  getCardinalDirection,
  InspectionCategory,
  ReviewStatus,
  StampConfig,
  SurveyProjectMeta,
  TelemetryState,
} from './services/locationService';
import {
  deleteGalleryPhoto,
  exportPhotosToCSV,
  getAllGalleryPhotos,
  SavedPhoto,
  saveToGalleryDB,
  updatePhotoReviewStatus,
} from './services/galleryDb';
import { captureGeotaggedPhoto } from './utils/watermark';

const SHUTTER_WAV =
  'data:audio/wav;base64,UklGRiIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

type ActiveTab = 'viewfinder' | 'map' | 'log' | 'designer' | 'calibration';

const CATEGORIES: InspectionCategory[] = [
  'Civil Survey',
  'Site Inspection',
  'Utility Audit',
  'Environmental',
  'Boundary Marker',
];

const COORD_FORMATS: CoordinateFormat[] = ['DD', 'DMS', 'UTM', 'PLUS'];

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isReady, setIsReady] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isReady') === 'true';
    } catch {
      return false;
    }
  });
  const [permDenied, setPermDenied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('viewfinder');
  const [windowWidth, setWindowWidth] = useState<number>(() => Dimensions.get('window').width);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isDesktop = windowWidth >= 1024;

  // Camera & Optical State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const capWatchIdRef = useRef<string | null>(null);
  const lastOrientationUpdateRef = useRef<number>(0);

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState<boolean>(false);
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [cameraSimulated, setCameraSimulated] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<'4:3' | '16:9' | '1:1'>('4:3');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showHorizon, setShowHorizon] = useState<boolean>(true);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  // Calibration & Stamp Config
  const [accuracyLimit, setAccuracyLimit] = useState<number>(30);
  const [distanceThrottle, setDistanceThrottle] = useState<number>(50);
  const [highRes, setHighRes] = useState<boolean>(true);

  const [stampConfig, setStampConfig] = useState<StampConfig>({
    enabled: true,
    template: 'engineering',
    coordFormat: 'DD',
    showMap: true,
    showUTM: true,
    showAltitudeAccuracy: true,
    showCompass: true,
    showProjectMeta: true,
    showQR: true,
    showWeather: true,
    showClinometerSolar: true,
    showSignatureLogo: true,
  });

  const [projectMeta, setProjectMeta] = useState<SurveyProjectMeta>({
    projectId: 'PRJ-2026-01',
    surveyor: 'Ravi Suryavanshi',
    category: 'Civil Survey',
    notes: 'Benchmark verification & site documentation',
    customHeader: 'GPS MAP CAMERA PRO · SURVEY TELEMETRY',
    logoDataUrl: '',
    signatureDataUrl: '',
  });

  // Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryState>(() => ({
    status: 'Calibrating GNSS...',
    lat: 28.613939,
    lon: 77.209021,
    alt: '216.0m',
    altMeters: 216.0,
    speed: '0.0 km/h',
    speedKmh: 0,
    heading: '90°',
    headingDeg: 90,
    accuracy: 8,
    isAccuracyGood: true,
    address: 'Connaught Place, New Delhi, Delhi 110001, India',
    isManualLock: false,
    weather: {
      tempC: 26.4,
      humidity: 48,
      pressureHpa: 1012.8,
      windKmh: 11.2,
      condition: 'Clear Sky',
    },
    clinometer: {
      pitchDeg: 1.5,
      rollDeg: 0.0,
      slopeGradePct: 2.6,
    },
    solar: calculateSolarPosition(28.613939, 77.209021),
  }));

  // GIS Parcel & Track Waypoints
  const [waypoints, setWaypoints] = useState<GeoWaypoint[]>(() => {
    const baseLat = 28.613939;
    const baseLon = 77.209021;
    const d = 0.00075;
    return [
      { id: 'wp-1', lat: Number((baseLat + d).toFixed(6)), lon: Number((baseLon - d).toFixed(6)), label: 'BM-01 (NW)', timestamp: Date.now() - 3000 },
      { id: 'wp-2', lat: Number((baseLat + d).toFixed(6)), lon: Number((baseLon + d).toFixed(6)), label: 'BM-02 (NE)', timestamp: Date.now() - 2000 },
      { id: 'wp-3', lat: Number((baseLat - d).toFixed(6)), lon: Number((baseLon + d).toFixed(6)), label: 'BM-03 (SE)', timestamp: Date.now() - 1000 },
      { id: 'wp-4', lat: Number((baseLat - d).toFixed(6)), lon: Number((baseLon - d).toFixed(6)), label: 'BM-04 (SW)', timestamp: Date.now() },
    ];
  });
  const [isRecordingTrack, setIsRecordingTrack] = useState<boolean>(false);
  const isRecordingTrackRef = useRef<boolean>(false);
  isRecordingTrackRef.current = isRecordingTrack;

  const lastGeocodeRef = useRef<{
    lat: number;
    lon: number;
    time: number;
    accuracy: number;
    locked: boolean;
  }>({
    lat: 0,
    lon: 0,
    time: 0,
    accuracy: 999,
    locked: false,
  });

  // Modals & Gallery
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string>('');
  const [capturedFullDataUrl, setCapturedFullDataUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successModalVisible, setSuccessModalVisible] = useState<boolean>(false);
  const [lastSavedDataUrl, setLastSavedDataUrl] = useState<string>('');
  const [galleryPhotos, setGalleryPhotos] = useState<SavedPhoto[]>([]);
  const [privacyVisible, setPrivacyVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3200);
  }, []);

  const refreshGallery = useCallback(async () => {
    const photos = await getAllGalleryPhotos();
    setGalleryPhotos(photos);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
      trackRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user', useHighRes: boolean): Promise<boolean> => {
      stopCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSimulated(true);
        return true;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: targetFacing },
          aspectRatio: 4 / 3,
          width: { ideal: useHighRes ? 1600 : 1280 },
          height: { ideal: useHighRes ? 1200 : 960 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      try {
        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        streamRef.current = mediaStream;
        const videoTrack = mediaStream.getVideoTracks()[0];
        trackRef.current = videoTrack;
        setCameraSimulated(false);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }

        try {
          const capabilities = (videoTrack as any).getCapabilities?.() || {};
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            await videoTrack.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any],
            });
          }
        } catch {
          // ignore
        }

        return true;
      } catch {
        setCameraSimulated(true);
        return true;
      }
    },
    [stopCamera]
  );

  const triggerGeocodeAndEnvironment = useCallback(async (lt: number, ln: number) => {
    const [geoRes, weatherRes] = await Promise.all([
      fetchReverseGeocode(lt, ln),
      fetchWeatherTelemetry(lt, ln),
    ]);
    const solarRes = calculateSolarPosition(lt, ln);
    setTelemetry((prev) => ({
      ...prev,
      address: geoRes.address,
      status: prev.isManualLock ? 'Station Benchmark Locked' : geoRes.status,
      weather: weatherRes,
      solar: solarRes,
    }));
  }, []);

  // Device orientation listener for live Pitch & Roll Clinometer (throttled to avoid 60Hz re-render storms)
  useEffect(() => {
    if (showSplash) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const now = Date.now();
      if (now - lastOrientationUpdateRef.current < 300) return;
      lastOrientationUpdateRef.current = now;

      const pitchDeg = Number(Math.max(-45, Math.min(45, e.beta - 90)).toFixed(1));
      const rollDeg = Number(Math.max(-30, Math.min(30, e.gamma)).toFixed(1));
      const slopeGradePct = Number((Math.tan((Math.abs(pitchDeg) * Math.PI) / 180) * 100).toFixed(1));
      setTelemetry((prev) => {
        if (
          Math.abs(prev.clinometer.pitchDeg - pitchDeg) < 0.5 &&
          Math.abs(prev.clinometer.rollDeg - rollDeg) < 0.5
        ) {
          return prev;
        }
        return {
          ...prev,
          clinometer: { pitchDeg, rollDeg, slopeGradePct },
        };
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [showSplash]);

  const applyGpsCoords = useCallback(
    (coords: {
      latitude: number;
      longitude: number;
      accuracy: number;
      altitude: number | null;
      speed: number | null;
      heading: number | null;
    }) => {
      setTelemetry((prev) => {
        if (prev.isManualLock) return prev;

        const acc = coords.accuracy;
        const lt = coords.latitude;
        const ln = coords.longitude;
        const altM = coords.altitude ?? 216.0;
        const spdKmh = coords.speed ? coords.speed * 3.6 : 0;
        const hdgDeg =
          coords.heading !== null && !isNaN(coords.heading)
            ? Math.round(coords.heading)
            : prev.headingDeg;

        const now = Date.now();
        const last = lastGeocodeRef.current;
        const distMoved = calculateHaversine(lt, ln, last.lat, last.lon);
        const accuracyImproved = acc < last.accuracy - 5;
        const isGood = acc <= distanceThrottle;

        if (
          (acc <= 15 && !last.locked) ||
          distMoved > accuracyLimit ||
          now - last.time > 60000 ||
          accuracyImproved
        ) {
          last.locked = true;
          last.lat = lt;
          last.lon = ln;
          last.time = now;
          last.accuracy = acc;
          triggerGeocodeAndEnvironment(lt, ln);
        }

        if (isRecordingTrackRef.current && distMoved > 3) {
          setWaypoints((wpts) => [
            ...wpts,
            {
              id: `trk-${Date.now()}`,
              lat: Number(lt.toFixed(6)),
              lon: Number(ln.toFixed(6)),
              label: `TRK-${wpts.length + 1}`,
              timestamp: Date.now(),
            },
          ]);
        }

        return {
          ...prev,
          lat: lt,
          lon: ln,
          alt: `${altM.toFixed(1)}m`,
          altMeters: altM,
          speed: `${spdKmh.toFixed(1)} km/h`,
          speedKmh: spdKmh,
          heading: `${hdgDeg}°`,
          headingDeg: hdgDeg,
          accuracy: acc,
          isAccuracyGood: isGood,
          solar: calculateSolarPosition(lt, ln),
          status: acc <= 15 ? 'RTK / Location Locked' : 'GNSS Tracking Active',
        };
      });
    },
    [accuracyLimit, distanceThrottle, triggerGeocodeAndEnvironment]
  );

  const startGPS = useCallback(async () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {
        // ignore
      }
      watchIdRef.current = null;
    }
    if (capWatchIdRef.current !== null && Capacitor.isNativePlatform()) {
      try {
        await Geolocation.clearWatch({ id: capWatchIdRef.current });
      } catch {
        // ignore
      }
      capWatchIdRef.current = null;
    }

    // Fetch initial weather & solar for default coordinates
    triggerGeocodeAndEnvironment(telemetry.lat, telemetry.lon);

    if (Capacitor.isNativePlatform()) {
      try {
        const cId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (pos) => {
            if (pos && pos.coords) {
              applyGpsCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                altitude: pos.coords.altitude,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
              });
            }
          }
        );
        capWatchIdRef.current = cId;
      } catch {
        // Fallback to web geolocation below
      }
    }

    if (!navigator.geolocation) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        applyGpsCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
        });
      },
      () => {
        // Keep default benchmark coordinates in preview if geolocation permission denied
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }, [applyGpsCoords, triggerGeocodeAndEnvironment]);

  const requestNativeAndroidPermissions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    } catch {
      // ignore
    }
    try {
      await Geolocation.requestPermissions();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!showSplash && isReady) {
      (async () => {
        await requestNativeAndroidPermissions();
        await startCamera(facing, highRes);
        await startGPS();
        await refreshGallery();
      })();
    }
    return () => {
      stopCamera();
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (capWatchIdRef.current !== null && Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: capWatchIdRef.current }).catch(() => {});
      }
    };
  }, [showSplash, isReady]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleAcceptPermissions = async () => {
    await requestNativeAndroidPermissions();
    try {
      localStorage.setItem('policyAccepted', 'true');
      localStorage.setItem('isReady', 'true');
    } catch {
      // ignore
    }
    setPermDenied(false);
    setIsReady(true);
  };

  const handleManualCoordinateOverride = (lat: number, lon: number, lock: boolean) => {
    setTelemetry((prev) => ({
      ...prev,
      lat,
      lon,
      isManualLock: lock,
      solar: calculateSolarPosition(lat, lon),
      status: lock ? 'Station Benchmark Locked' : 'GNSS Tracking Active',
    }));
    triggerGeocodeAndEnvironment(lat, lon);
    showToast(lock ? 'Coordinates locked to benchmark station.' : 'Live GNSS tracking resumed.');
  };

  const handleChangeClinometer = (nextClinometer: ClinometerState) => {
    setTelemetry((prev) => ({
      ...prev,
      clinometer: nextClinometer,
    }));
  };

  const handleSwitchCamera = () => {
    setIsSwitchingCamera(true);
    const nextFacing = facing === 'user' ? 'environment' : 'user';
    setTimeout(async () => {
      setFacing(nextFacing);
      await startCamera(nextFacing, highRes);
      setIsSwitchingCamera(false);
    }, 220);
  };

  const handleToggleFlash = async () => {
    const track = trackRef.current;
    if (!track) {
      showToast('Torch unavailable on active optical stream.');
      return;
    }
    try {
      const capabilities = (track as any).getCapabilities?.() || {};
      if (!capabilities.torch) {
        showToast('Torch unavailable on active lens.');
        return;
      }
      const nextFlash = !isFlashOn;
      await track.applyConstraints({ advanced: [{ torch: nextFlash } as any] });
      setIsFlashOn(nextFlash);
    } catch {
      showToast('Torch unavailable on active lens.');
      setIsFlashOn(false);
    }
  };

  const handleCapture = async () => {
    try {
      const audio = new Audio(SHUTTER_WAV);
      audio.play().catch(() => {});

      const { previewUrl, fullDataUrl } = await captureGeotaggedPhoto({
        video: videoRef.current,
        facing,
        zoomLevel,
        aspectRatio,
        stampConfig,
        projectMeta,
        telemetry,
      });

      setCapturedPreviewUrl(previewUrl);
      setCapturedFullDataUrl(fullDataUrl);
      setSaveModalVisible(true);
    } catch (err) {
      console.error('Capture failed:', err);
      showToast('Failed to capture field report.');
    }
  };

  const handleConfirmSave = async (annotatedDataUrl?: string) => {
    const targetDataUrl = annotatedDataUrl || capturedFullDataUrl;
    if (!targetDataUrl) return;
    setIsSaving(true);
    try {
      const base64Data = targetDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const w = telemetry.weather;
      const cl = telemetry.clinometer;
      const sol = telemetry.solar;

      await saveToGalleryDB(base64Data, {
        projectId: projectMeta.projectId,
        surveyor: projectMeta.surveyor,
        category: projectMeta.category,
        notes: projectMeta.notes,
        lat: telemetry.lat,
        lon: telemetry.lon,
        utm: formatUTM(telemetry.lat, telemetry.lon),
        dms: formatDMS(telemetry.lat, telemetry.lon),
        altitude: telemetry.alt,
        accuracy: telemetry.accuracy,
        heading: telemetry.heading,
        address: telemetry.address,
        weatherSummary: `${w.tempC}°C · RH ${w.humidity}% · ${w.pressureHpa} hPa · ${w.condition}`,
        clinometerSummary: `Pitch ${cl.pitchDeg >= 0 ? '+' : ''}${cl.pitchDeg.toFixed(1)}° · Roll ${
          cl.rollDeg >= 0 ? '+' : ''
        }${cl.rollDeg.toFixed(1)}° · Slope ${cl.slopeGradePct.toFixed(1)}%`,
        solarSummary: `Sun EL ${sol.elevationDeg}° · AZ ${sol.azimuthDeg}°`,
        reviewStatus: 'Pending Review',
      });
      await refreshGallery();
      setLastSavedDataUrl(targetDataUrl);

      const fileName = `${projectMeta.projectId || 'GPS_PRO'}_${Date.now()}.jpg`;
      if (Capacitor.isNativePlatform()) {
        try {
          const tempFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });
          try {
            await Media.savePhoto({ path: tempFile.uri });
          } catch {
            await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Documents,
            });
          }
        } catch (nativeErr) {
          console.warn('Native gallery save fallback:', nativeErr);
        }
      } else {
        const a = document.createElement('a');
        a.href = targetDataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setSaveModalVisible(false);
      setTimeout(() => {
        setSuccessModalVisible(true);
      }, 160);
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to save field report.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGalleryPhoto = async (id: number) => {
    await deleteGalleryPhoto(id);
    await refreshGallery();
    showToast('Field record deleted.');
  };

  const handleUpdateReviewStatus = async (id: number, status: ReviewStatus, reviewer: string) => {
    await updatePhotoReviewStatus(id, status, reviewer);
    await refreshGallery();
    showToast(`Record marked as ${status}.`);
  };

  const handleSharePhoto = async (base64OrDataUrl?: string) => {
    const targetDataUrl = base64OrDataUrl
      ? base64OrDataUrl.startsWith('data:')
        ? base64OrDataUrl
        : `data:image/jpeg;base64,${base64OrDataUrl}`
      : lastSavedDataUrl;

    if (!targetDataUrl) {
      showToast('Capture and save a field report first.');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = targetDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const fileName = `GPS_SURVEY_${Date.now()}.jpg`;
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `Field Report · ${projectMeta.projectId}`,
          text: `Geotagged Survey Report (${telemetry.lat.toFixed(6)}, ${telemetry.lon.toFixed(6)})\n${telemetry.address}`,
          url: savedFile.uri,
          dialogTitle: 'Share Geotagged Survey Photo',
        });
        return;
      } catch (e) {
        console.warn('Native share fallback:', e);
      }
    }

    try {
      if (navigator.share) {
        const res = await fetch(targetDataUrl);
        const blob = await res.blob();
        const file = new File([blob], `GPS_SURVEY_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await navigator.share({
          title: `Field Report · ${projectMeta.projectId}`,
          text: `Geotagged Survey Report (${telemetry.lat.toFixed(6)}, ${telemetry.lon.toFixed(6)})`,
          files: [file],
        });
        return;
      }
    } catch {
      // fallback
    }

    const a = document.createElement('a');
    a.href = targetDataUrl;
    a.download = `GPS_SURVEY_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Stamped report downloaded.');
  };

  const handleTapFocus = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusRing({ x, y, visible: true });

    const track = trackRef.current;
    if (track) {
      try {
        const capabilities = (track as any).getCapabilities?.() || {};
        if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'manual' } as any] });
          setTimeout(async () => {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
          }, 500);
        }
      } catch {
        // ignore
      }
    }

    setTimeout(() => {
      setFocusRing((prev) => ({ ...prev, visible: false }));
    }, 900);
  };

  return (
    <View style={styles.root}>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {!showSplash && !isReady && (
        <PermissionScreen
          denied={permDenied}
          onAccept={handleAcceptPermissions}
          onRetry={() => setPermDenied(false)}
          onOpenPrivacyPolicy={() => setPrivacyVisible(true)}
        />
      )}

      {/* Top Bar Contract: Desktop 1 Row 3 Zones; Mobile Compact 2-Tier Header + All 5 Tabs */}
      <View style={[styles.topBar, !isDesktop && styles.topBarMobile]}>
        <View style={!isDesktop ? styles.mobileBrandRow : undefined}>
          <TouchableOpacity onPress={() => setActiveTab('viewfinder')}>
            <Text style={styles.brandWordmark} numberOfLines={1}>
              GPS Map Camera Pro
            </Text>
          </TouchableOpacity>

          {!isDesktop && (
            <TouchableOpacity
              style={styles.topCtaBtnMobile}
              onPress={() => {
                if (galleryPhotos.length === 0) {
                  showToast('No logged records yet — capture a photo first.');
                  return;
                }
                exportPhotosToCSV(galleryPhotos);
                showToast('Exported GIS Survey CSV.');
              }}
            >
              <Text style={styles.topCtaTextMobile} numberOfLines={1}>
                Export CSV
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.navLinksRow, !isDesktop && styles.navLinksRowMobile]}>
          {(
            [
              { id: 'viewfinder', label: isDesktop ? 'Viewfinder' : 'Camera' },
              { id: 'map', label: isDesktop ? 'Map & Parcel' : 'Map' },
              { id: 'log', label: isDesktop ? `Field Log (${galleryPhotos.length})` : `Log (${galleryPhotos.length})` },
              { id: 'designer', label: isDesktop ? 'Stamp Designer' : 'Stamp' },
              { id: 'calibration', label: isDesktop ? 'Calibration' : 'Sensors' },
            ] as Array<{ id: ActiveTab; label: string }>
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setActiveTab(item.id)}
                style={[styles.navLinkBtn, !isDesktop && styles.navLinkBtnMobile, active && !isDesktop && styles.navLinkBtnMobileActive]}
              >
                <Text style={[styles.navLinkText, !isDesktop && styles.navLinkTextMobile, active && styles.navLinkTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isDesktop && (
          <TouchableOpacity
            style={styles.topCtaBtn}
            onPress={() => {
              if (galleryPhotos.length === 0) {
                showToast('No logged records yet — capture a photo first.');
                return;
              }
              exportPhotosToCSV(galleryPhotos);
              showToast('Exported GIS Survey CSV.');
            }}
          >
            <Text style={styles.topCtaText} numberOfLines={1}>
              Export Survey CSV
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toast Notification */}
      {toastMessage ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Main Workspace Area */}
      {activeTab === 'viewfinder' && (
        <View style={styles.viewfinderSplitLayout}>
          {/* Left / Main Stage: Optical Camera Viewfinder */}
          <View style={styles.cameraStage}>
            {/* Optical Toolbar Overlay (Status, Clinometer Slope, Zoom, Aspect Ratio) */}
            <View style={styles.opticalTopHud}>
              <Text
                style={[
                  styles.telemetryStatusLabel,
                  telemetry.isAccuracyGood ? { color: '#00E676' } : { color: '#F59E0B' },
                ]}
              >
                {telemetry.isAccuracyGood ? '● ' : '▲ '}
                {telemetry.status} · ±
                {telemetry.accuracy >= 999 ? '--' : Math.round(telemetry.accuracy)}m ·{' '}
                {telemetry.weather.tempC}°C · SLOPE {telemetry.clinometer.slopeGradePct.toFixed(1)}%
              </Text>

              <View style={styles.opticalControlsGroup}>
                {([1, 2, 4] as const).map((z) => (
                  <TouchableOpacity
                    key={z}
                    style={[styles.hudChipBtn, zoomLevel === z && styles.hudChipBtnActive]}
                    onPress={() => setZoomLevel(z)}
                  >
                    <Text
                      style={[styles.hudChipText, zoomLevel === z && styles.hudChipTextActive]}
                    >
                      {z}x
                    </Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.hudDivider} />

                {(['4:3', '16:9', '1:1'] as const).map((ratio) => (
                  <TouchableOpacity
                    key={ratio}
                    style={[styles.hudChipBtn, aspectRatio === ratio && styles.hudChipBtnActive]}
                    onPress={() => setAspectRatio(ratio)}
                  >
                    <Text
                      style={[
                        styles.hudChipText,
                        aspectRatio === ratio && styles.hudChipTextActive,
                      ]}
                    >
                      {ratio}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Interactive Optical Surface */}
            <div
              onClick={handleTapFocus}
              style={{
                position: 'relative',
                flex: 1,
                width: '100%',
                height: '100%',
                backgroundColor: '#07090E',
                overflow: 'hidden',
                cursor: 'crosshair',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#07090E',
                  transform: `${facing === 'user' ? 'scaleX(-1)' : 'scaleX(1)'} scale(${
                    isSwitchingCamera ? 0.96 : zoomLevel
                  })`,
                  opacity: isSwitchingCamera ? 0 : 1,
                  transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
                  display: cameraSimulated ? 'none' : 'block',
                }}
              />

              {cameraSimulated && (
                <View style={styles.simulatedStage}>
                  <View style={styles.simulatedTelemetryFrame}>
                    <span
                      className="material-icons"
                      style={{ fontSize: 32, color: '#00E676', marginBottom: 8 }}
                    >
                      my_location
                    </span>
                    <Text style={styles.simulatedHeading}>
                      Optical Survey Viewfinder ({aspectRatio} · {zoomLevel}x)
                    </Text>
                    <Text style={styles.simulatedSub}>
                      {projectMeta.projectId} · {projectMeta.category} · Tap anywhere to focus or
                      press shutter to open CAD Redline & Stamp verification
                    </Text>
                  </View>
                </View>
              )}

              {/* Rule of Thirds 3x3 Optical Grid */}
              {showGrid && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '33.33%',
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: '66.66%',
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '33.33%',
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '66.66%',
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    }}
                  />
                </div>
              )}

              {/* Artificial Horizon & Clinometer Pitch/Roll Reticle */}
              {showHorizon && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '40%',
                    transform: `translate(-50%, -50%) rotate(${telemetry.clinometer.rollDeg}deg)`,
                    width: 150,
                    height: 150,
                    pointerEvents: 'none',
                    zIndex: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease-out',
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      border: '1px solid rgba(0, 230, 118, 0.4)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      width: 120,
                      height: 1.5,
                      backgroundColor: 'rgba(0, 230, 118, 0.55)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 72,
                      backgroundColor: 'rgba(0, 230, 118, 0.45)',
                    }}
                  />
                </div>
              )}

              {/* Tap-to-Focus Reticle */}
              {focusRing.visible && (
                <div
                  style={{
                    position: 'absolute',
                    left: focusRing.x,
                    top: focusRing.y,
                    width: 68,
                    height: 68,
                    border: '2px solid #F59E0B',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    zIndex: 30,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}

              {/* Live Watermark Stamp Preview Overlay */}
              <DataOverlay
                telemetry={telemetry}
                stampConfig={stampConfig}
                projectMeta={projectMeta}
              />
            </div>

            {/* Bottom Ergonomic Shutter & Quick Action Bar */}
            <View style={styles.shutterBar}>
              <TouchableOpacity
                style={styles.controlCircleBtn}
                onPress={() => setActiveTab('log')}
              >
                <span className="material-icons" style={{ color: '#F8FAFC', fontSize: 22 }}>
                  collections
                </span>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlCircleBtn} onPress={handleSwitchCamera}>
                <span className="material-icons" style={{ color: '#F8FAFC', fontSize: 22 }}>
                  cameraswitch
                </span>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shutterBtnOuter}
                onPress={handleCapture}
                activeOpacity={0.85}
              >
                <View style={styles.shutterBtnInner} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlCircleBtn, isFlashOn && styles.controlCircleBtnActive]}
                onPress={handleToggleFlash}
              >
                <span
                  className="material-icons"
                  style={{ color: isFlashOn ? '#00E676' : '#F8FAFC', fontSize: 22 }}
                >
                  flash_on
                </span>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlCircleBtn, showGrid && styles.controlCircleBtnActive]}
                onPress={() => setShowGrid(!showGrid)}
              >
                <span
                  className="material-icons"
                  style={{ color: showGrid ? '#00E676' : '#F8FAFC', fontSize: 22 }}
                >
                  grid_on
                </span>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right Desktop Inspector Column: Live Geodetic, Environmental & Project Tagging */}
          {isDesktop && (
            <ScrollView style={styles.inspectorSidebar} contentContainerStyle={{ padding: 20 }}>
              {/* Section 1: Geodetic Datum Telemetry */}
              <Text style={styles.sidebarSectionTitle}>01. GNSS & Environmental Telemetry</Text>
              <View style={styles.coordFormatTabs}>
                {COORD_FORMATS.map((fmt) => {
                  const active = stampConfig.coordFormat === fmt;
                  return (
                    <TouchableOpacity
                      key={fmt}
                      style={[styles.formatTabBtn, active && styles.formatTabBtnActive]}
                      onPress={() => setStampConfig({ ...stampConfig, coordFormat: fmt })}
                    >
                      <Text style={[styles.formatTabText, active && styles.formatTabTextActive]}>
                        {fmt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.telemetryList}>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>Latitude / Longitude</Text>
                  <Text style={styles.telemetryMono}>
                    {telemetry.lat.toFixed(6)}, {telemetry.lon.toFixed(6)}
                  </Text>
                </View>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>UTM Zone / Grid</Text>
                  <Text style={styles.telemetryMonoCyan}>
                    {formatUTM(telemetry.lat, telemetry.lon)}
                  </Text>
                </View>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>DMS Notation</Text>
                  <Text style={styles.telemetryMono}>
                    {formatDMS(telemetry.lat, telemetry.lon)}
                  </Text>
                </View>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>Plus Code · Azimuth · Elevation</Text>
                  <Text style={styles.telemetryMono}>
                    {formatPlusCode(telemetry.lat, telemetry.lon)} · {telemetry.heading} (
                    {getCardinalDirection(telemetry.headingDeg)}) · {telemetry.alt}
                  </Text>
                </View>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>Weather & Barometric Pressure</Text>
                  <Text style={styles.telemetryMonoAmber}>
                    {telemetry.weather.tempC}°C · RH {telemetry.weather.humidity}% ·{' '}
                    {telemetry.weather.pressureHpa} hPa · {telemetry.weather.windKmh} km/h
                  </Text>
                </View>
                <View style={styles.telemetryItemRow}>
                  <Text style={styles.telemetryKey}>Clinometer Slope · Solar Position</Text>
                  <Text style={styles.telemetryMonoCyan}>
                    Grade {telemetry.clinometer.slopeGradePct.toFixed(1)}% (P{' '}
                    {telemetry.clinometer.pitchDeg >= 0 ? '+' : ''}
                    {telemetry.clinometer.pitchDeg.toFixed(1)}°) · Sun EL{' '}
                    {telemetry.solar.elevationDeg}° AZ {telemetry.solar.azimuthDeg}°
                  </Text>
                </View>
              </View>

              <View style={styles.sidebarDivider} />

              {/* Section 2: Quick Survey Project Metadata */}
              <Text style={styles.sidebarSectionTitle}>02. Active Survey Project Tagging</Text>

              <View style={styles.sidebarField}>
                <Text style={styles.sidebarLabel}>Project / Site ID</Text>
                <input
                  type="text"
                  value={projectMeta.projectId}
                  onChange={(e) => setProjectMeta({ ...projectMeta, projectId: e.target.value })}
                  style={{ width: '100%' }}
                />
              </View>

              <View style={styles.sidebarField}>
                <Text style={styles.sidebarLabel}>Surveyor / Engineer</Text>
                <input
                  type="text"
                  value={projectMeta.surveyor}
                  onChange={(e) => setProjectMeta({ ...projectMeta, surveyor: e.target.value })}
                  style={{ width: '100%' }}
                />
              </View>

              <View style={styles.sidebarField}>
                <Text style={styles.sidebarLabel}>Inspection Category</Text>
                <View style={styles.categoryWrap}>
                  {CATEGORIES.map((cat) => {
                    const active = projectMeta.category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catBtn, active && styles.catBtnActive]}
                        onPress={() => setProjectMeta({ ...projectMeta, category: cat })}
                      >
                        <Text style={[styles.catBtnText, active && styles.catBtnTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.sidebarField}>
                <Text style={styles.sidebarLabel}>Field Remarks / Chainage</Text>
                <input
                  type="text"
                  value={projectMeta.notes}
                  onChange={(e) => setProjectMeta({ ...projectMeta, notes: e.target.value })}
                  placeholder="Enter benchmark or inspection remark..."
                  style={{ width: '100%' }}
                />
              </View>

              <View style={styles.sidebarDivider} />

              {/* Section 3: Watermark Template Quick Selector */}
              <Text style={styles.sidebarSectionTitle}>03. Stamp Layout Preset</Text>
              <View style={styles.coordFormatTabs}>
                {(
                  [
                    { id: 'engineering', label: 'GIS Block' },
                    { id: 'compact', label: 'Compact' },
                    { id: 'minimal', label: 'Minimal' },
                  ] as const
                ).map((t) => {
                  const active = stampConfig.template === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.formatTabBtn, active && styles.formatTabBtnActive]}
                      onPress={() => setStampConfig({ ...stampConfig, template: t.id })}
                    >
                      <Text style={[styles.formatTabText, active && styles.formatTabTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === 'map' && (
        <MapSurveyView
          telemetry={telemetry}
          projectMeta={projectMeta}
          photos={galleryPhotos}
          waypoints={waypoints}
          isRecordingTrack={isRecordingTrack}
          onAddWaypoint={(wp) => setWaypoints((prev) => [...prev, wp])}
          onRemoveWaypoint={(id) => setWaypoints((prev) => prev.filter((w) => w.id !== id))}
          onClearWaypoints={() => setWaypoints([])}
          onToggleTrackRecording={() => {
            setIsRecordingTrack((prev) => {
              const next = !prev;
              showToast(
                next
                  ? 'GPS Perimeter Track Recording started.'
                  : 'GPS Track Recording paused.'
              );
              return next;
            });
          }}
        />
      )}

      {activeTab === 'log' && (
        <FieldLogView
          photos={galleryPhotos}
          projectMeta={projectMeta}
          onDeletePhoto={handleDeleteGalleryPhoto}
          onSharePhoto={(b64) => handleSharePhoto(b64)}
          onUpdateReviewStatus={handleUpdateReviewStatus}
          onRefreshPhotos={refreshGallery}
          onBackToCamera={() => setActiveTab('viewfinder')}
        />
      )}

      {activeTab === 'designer' && (
        <StampDesignerView
          stampConfig={stampConfig}
          projectMeta={projectMeta}
          onChangeStampConfig={setStampConfig}
          onChangeProjectMeta={setProjectMeta}
        />
      )}

      {activeTab === 'calibration' && (
        <CalibrationView
          telemetry={telemetry}
          accuracyLimit={accuracyLimit}
          distanceThrottle={distanceThrottle}
          highRes={highRes}
          showGrid={showGrid}
          showHorizon={showHorizon}
          onChangeAccuracyLimit={setAccuracyLimit}
          onChangeDistanceThrottle={setDistanceThrottle}
          onToggleHighRes={async (val) => {
            setHighRes(val);
            await startCamera(facing, val);
          }}
          onToggleGrid={setShowGrid}
          onToggleHorizon={setShowHorizon}
          onChangeClinometer={handleChangeClinometer}
          onManualCoordinateOverride={handleManualCoordinateOverride}
          onOpenPrivacyPolicy={() => setPrivacyVisible(true)}
        />
      )}

      {/* Save Field Report & CAD Redline Markup Modal */}
      <SaveModal
        visible={saveModalVisible}
        previewUri={capturedPreviewUrl}
        isSaving={isSaving}
        telemetry={telemetry}
        projectMeta={projectMeta}
        onDiscard={() => {
          setSaveModalVisible(false);
          setCapturedPreviewUrl('');
          setCapturedFullDataUrl('');
        }}
        onConfirmSave={handleConfirmSave}
      />

      {/* Saved Confirmation Modal */}
      <SuccessModal
        visible={successModalVisible}
        onShare={() => handleSharePhoto()}
        onViewLog={() => {
          setSuccessModalVisible(false);
          setActiveTab('log');
        }}
        onClose={() => setSuccessModalVisible(false)}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#07090E',
    overflow: 'hidden',
  },
  topBar: {
    height: 54,
    backgroundColor: '#0B0E17',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 200,
  },
  topBarMobile: {
    height: 'auto' as any,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 6,
  },
  mobileBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  brandWordmark: {
    color: '#F8FAFC',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  navLinksRowMobile: {
    width: '100%',
    justifyContent: 'space-between',
    gap: 4,
  },
  navLinkBtn: {
    paddingVertical: 6,
  },
  navLinkBtnMobile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  navLinkBtnMobileActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  navLinkText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  navLinkTextMobile: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  navLinkTextActive: {
    color: '#00E676',
  },
  topCtaBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  topCtaText: {
    color: '#07090E',
    fontSize: 12.5,
    fontWeight: '700',
  },
  topCtaBtnMobile: {
    backgroundColor: '#00E676',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  topCtaTextMobile: {
    color: '#07090E',
    fontSize: 11,
    fontWeight: '700',
  },
  toastBanner: {
    position: 'absolute',
    top: 66,
    alignSelf: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#00E676',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    zIndex: 30000,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '600',
  },
  viewfinderSplitLayout: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cameraStage: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#07090E',
    justifyContent: 'space-between',
  },
  opticalTopHud: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryStatusLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
    backgroundColor: 'rgba(7, 9, 14, 0.82)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  opticalControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 9, 14, 0.82)',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 3,
  },
  hudChipBtn: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 5,
  },
  hudChipBtnActive: {
    backgroundColor: '#1E293B',
  },
  hudChipText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono, monospace',
  },
  hudChipTextActive: {
    color: '#00E676',
  },
  hudDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#1E293B',
    marginHorizontal: 4,
  },
  simulatedStage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#080C14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 140,
  },
  simulatedTelemetryFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    maxWidth: 440,
  },
  simulatedHeading: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  simulatedSub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  shutterBar: {
    height: 92,
    backgroundColor: 'rgba(11, 14, 23, 0.94)',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    zIndex: 40,
  },
  controlCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleBtnActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  shutterBtnOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  shutterBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FAFC',
  },
  inspectorSidebar: {
    width: 380,
    maxWidth: 380,
    backgroundColor: '#0B0E17',
    borderLeftWidth: 1,
    borderLeftColor: '#1E293B',
  },
  sidebarSectionTitle: {
    color: '#F8FAFC',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 12,
  },
  coordFormatTabs: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  formatTabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  formatTabBtnActive: {
    backgroundColor: '#1E293B',
  },
  formatTabText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '700',
  },
  formatTabTextActive: {
    color: '#00E676',
  },
  telemetryList: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
  },
  telemetryItemRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.6)',
  },
  telemetryKey: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 2,
  },
  telemetryMono: {
    color: '#00E676',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono, monospace',
  },
  telemetryMonoCyan: {
    color: '#06B6D4',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono, monospace',
  },
  telemetryMonoAmber: {
    color: '#F59E0B',
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono, monospace',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 18,
  },
  sidebarField: {
    marginBottom: 12,
  },
  sidebarLabel: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 5,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  catBtnActive: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
  },
  catBtnText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  catBtnTextActive: {
    color: '#00E676',
  },
});

export default App;
