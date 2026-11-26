import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SplashScreenProps {
  onComplete: () => void;
}

const CHECK_ITEMS = [
  { id: 'item-gps', label: 'Calibrating GPS Sensors...' },
  { id: 'item-map', label: 'Loading Map Overlay...' },
  { id: 'item-cam', label: 'Initializing 4K Lens...' },
  { id: 'item-secure', label: 'Verifying Secure Storage...' },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [activeItems, setActiveItems] = useState<string[]>([CHECK_ITEMS[0].id]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let pct = 15;
    setProgress(pct);
    const interval = setInterval(() => {
      pct += 17;
      if (pct >= 100) {
        pct = 100;
        clearInterval(interval);
      }
      setProgress(pct);
    }, 180);

    const timers = CHECK_ITEMS.map((item, idx) =>
      setTimeout(() => {
        setActiveItems((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      }, idx * 260)
    );

    const doneTimer = setTimeout(() => {
      onCompleteRef.current();
    }, 1500);

    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
      clearTimeout(doneTimer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <div
        className="hud-grid-anim"
        style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      <View style={styles.hudContainer}>
        <div
          className="hud-spin-cw"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '1px solid rgba(0, 230, 118, 0.3)',
            borderTopColor: '#00e676',
            borderBottomColor: '#00e676',
            boxShadow: '0 0 10px rgba(0, 230, 118, 0.1)',
          }}
        />
        <div
          className="hud-spin-ccw"
          style={{
            position: 'absolute',
            width: '75%',
            height: '75%',
            borderRadius: '50%',
            border: '1px solid rgba(0, 230, 118, 0.3)',
            borderLeftColor: '#00e676',
            borderRightColor: '#00e676',
          }}
        />
        <div
          className="hud-spin-inner"
          style={{
            position: 'absolute',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            border: '2px dashed rgba(0, 230, 118, 0.6)',
          }}
        />
        <div
          className="hud-scan-anim"
          style={{
            position: 'absolute',
            width: '100%',
            height: 2,
            background: '#00e676',
            boxShadow: '0 0 10px #00e676',
            opacity: 0.7,
          }}
        />
        <span className="material-icons" style={{ fontSize: 48, color: '#ffffff', zIndex: 10 }}>
          gps_fixed
        </span>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.splashTitle}>GPS CAMERA </Text>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      <View style={styles.checkList}>
        {CHECK_ITEMS.map((item) => {
          const isActive = activeItems.includes(item.id);
          return (
            <View key={item.id} style={styles.checkItem}>
              <span
                className="material-icons"
                style={{
                  fontSize: 16,
                  width: 18,
                  color: isActive ? '#00e676' : '#888888',
                }}
              >
                check_circle
              </span>
              <Text style={[styles.checkText, isActive && styles.checkTextActive]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{progress}%</Text>
      </View>

      <Text style={styles.loadingStatus}>SYSTEM BOOT SEQUENCE INITIATED</Text>

      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => onCompleteRef.current()}
        activeOpacity={0.8}
      >
        <Text style={styles.skipBtnText}>Skip Boot Screen →</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  hudContainer: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 2,
  },
  splashTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
  },
  proBadge: {
    backgroundColor: '#00e676',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  proBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  checkList: {
    width: 280,
    marginBottom: 24,
    zIndex: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  checkText: {
    color: '#888888',
    fontSize: 13,
    marginLeft: 12,
  },
  checkTextActive: {
    color: '#00e676',
  },
  progressContainer: {
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00e676',
  },
  progressPercent: {
    color: '#00e676',
    fontSize: 12,
    fontWeight: 'bold',
    width: 38,
  },
  loadingStatus: {
    marginTop: 14,
    fontSize: 10,
    color: '#555555',
    letterSpacing: 3,
    zIndex: 2,
  },
  skipBtn: {
    marginTop: 22,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    zIndex: 10,
  },
  skipBtnText: {
    color: '#00e676',
    fontSize: 12,
    fontWeight: '700',
  },
});
