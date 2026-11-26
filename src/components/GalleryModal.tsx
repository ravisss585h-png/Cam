import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import {
  exportPhotosToCSV,
  exportPhotosToGeoJSON,
  SavedPhoto,
} from '../services/galleryDb';
import { formatUTM, InspectionCategory } from '../services/locationService';

const CATEGORIES: Array<'All' | InspectionCategory> = [
  'All',
  'Civil Survey',
  'Site Inspection',
  'Utility Audit',
  'Environmental',
  'Boundary Marker',
];

interface FieldLogViewProps {
  photos: SavedPhoto[];
  onDeletePhoto: (id: number) => void;
  onSharePhoto: (base64Data: string) => void;
  onBackToCamera: () => void;
}

export const FieldLogView: React.FC<FieldLogViewProps> = ({
  photos,
  onDeletePhoto,
  onSharePhoto,
  onBackToCamera,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | InspectionCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      const catMatch = selectedCategory === 'All' || (p.category || 'Civil Survey') === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return catMatch;
      const hay = `${p.projectId || ''} ${p.surveyor || ''} ${p.address || ''} ${p.notes || ''} ${p.utm || ''}`.toLowerCase();
      return catMatch && hay.includes(q);
    });
  }, [photos, selectedCategory, searchQuery]);

  return (
    <View style={styles.workspace}>
      {/* Top Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarTitleCol}>
          <Text style={styles.sectionTitle}>01. Geotagged Field Inspection Log</Text>
          <Text style={styles.sectionMeta}>
            {filteredPhotos.length} of {photos.length} survey records · Stored locally in IndexedDB
          </Text>
        </View>

        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => exportPhotosToGeoJSON(filteredPhotos)}
            disabled={filteredPhotos.length === 0}
          >
            <Text style={styles.secondaryBtnText}>Export GeoJSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => exportPhotosToCSV(filteredPhotos)}
            disabled={filteredPhotos.length === 0}
          >
            <Text style={styles.primaryBtnText}>Download CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter & Search Bar */}
      <View style={styles.filterBar}>
        <View style={styles.segmentedGroup}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <input
          type="text"
          placeholder="Search project ID, surveyor, UTM, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            minWidth: 260,
            backgroundColor: '#0B0E17',
            border: '1px solid #1E293B',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#F8FAFC',
            fontSize: 13,
          }}
        />
      </View>

      {/* Gallery Grid / Empty State */}
      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyBox}>
          <span
            className="material-icons"
            style={{ fontSize: 42, color: '#334155', marginBottom: 12 }}
          >
            perm_media
          </span>
          <Text style={styles.emptyTitle}>No Geotagged Field Reports Found</Text>
          <Text style={styles.emptyDesc}>
            Capture a stamped survey photo from the optical viewfinder to populate your GIS field log.
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 18 }]} onPress={onBackToCamera}>
            <Text style={styles.primaryBtnText}>Return to Viewfinder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.gridContainer}>
          {filteredPhotos.map((photo, index) => {
            const lat = photo.lat ?? 0;
            const lon = photo.lon ?? 0;
            const utm = photo.utm || formatUTM(lat, lon);
            const dateLabel = new Date(photo.timestamp).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={photo.id || photo.timestamp || index}
                style={styles.recordCard}
                onPress={() => {
                  setSelectedPhoto(photo);
                  setConfirmDeleteId(null);
                }}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo.data}` }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardKicker} numberOfLines={1}>
                    {photo.projectId || 'PRJ-2026-01'} · {photo.category || 'Civil Survey'} ·{' '}
                    {dateLabel}
                  </Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {photo.address || 'Field Survey Waypoint'}
                  </Text>
                  <Text style={styles.cardMono} numberOfLines={1}>
                    {lat.toFixed(6)}, {lon.toFixed(6)} · {utm}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    ALT {photo.altitude || '0.0m'} · ACC ±{Math.round(photo.accuracy ?? 12)}m ·{' '}
                    {photo.surveyor || 'Field Engineer'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Fullscreen Record Inspector Modal */}
      {selectedPhoto ? (
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerContainer}>
            <View style={styles.viewerHeader}>
              <View>
                <Text style={styles.viewerTitle}>
                  {selectedPhoto.projectId || 'PRJ-2026-01'} ·{' '}
                  {selectedPhoto.category || 'Civil Survey'}
                </Text>
                <Text style={styles.viewerMeta}>
                  {new Date(selectedPhoto.timestamp).toLocaleString()} · Surveyor:{' '}
                  {selectedPhoto.surveyor || 'Field Engineer'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeIconBtn}
                onPress={() => {
                  setSelectedPhoto(null);
                  setConfirmDeleteId(null);
                }}
              >
                <span className="material-icons" style={{ color: '#F8FAFC', fontSize: 24 }}>
                  close
                </span>
              </TouchableOpacity>
            </View>

            <Image
              source={{ uri: `data:image/jpeg;base64,${selectedPhoto.data}` }}
              style={styles.viewerImg}
              resizeMode="contain"
            />

            <View style={styles.viewerFooter}>
              <View style={styles.viewerCoordsCol}>
                <Text style={styles.cardMono}>
                  DD: {(selectedPhoto.lat ?? 0).toFixed(6)}, {(selectedPhoto.lon ?? 0).toFixed(6)} ·
                  UTM: {selectedPhoto.utm || formatUTM(selectedPhoto.lat ?? 0, selectedPhoto.lon ?? 0)}
                </Text>
                <Text style={styles.viewerMeta} numberOfLines={1}>
                  {selectedPhoto.address || 'Field Waypoint'}{' '}
                  {selectedPhoto.notes ? `· Note: ${selectedPhoto.notes}` : ''}
                </Text>
              </View>

              <View style={styles.viewerActions}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => onSharePhoto(selectedPhoto.data)}
                >
                  <Text style={styles.primaryBtnText}>Share / Download</Text>
                </TouchableOpacity>

                {selectedPhoto.id !== undefined && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => {
                      if (confirmDeleteId === selectedPhoto.id) {
                        onDeletePhoto(selectedPhoto.id!);
                        setSelectedPhoto(null);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(selectedPhoto.id!);
                      }
                    }}
                  >
                    <Text style={styles.deleteBtnText}>
                      {confirmDeleteId === selectedPhoto.id ? 'Confirm Delete?' : 'Delete Record'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <View style={[styles.viewerOverlay, { zIndex: 25000 }]}>
      <View style={styles.policyModalBox}>
        <View style={styles.viewerHeader}>
          <Text style={styles.sectionTitle}>Privacy Policy & Compliance</Text>
          <TouchableOpacity style={styles.closeIconBtn} onPress={onClose}>
            <span className="material-icons" style={{ color: '#F8FAFC', fontSize: 22 }}>
              close
            </span>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, marginTop: 12 }}>
          <Text style={styles.policyText}>
            <Text style={styles.policyBold}>Last updated:</Text> 17 January 2026{'\n\n'}
            This Privacy Policy describes how <Text style={styles.policyBold}>GPS Map Camera</Text>{' '}
            developed by <Text style={styles.policyBold}>Ravi Suryavanshi</Text> uses permissions
            and handles information.{'\n\n'}
            <Text style={styles.policyHeading}>Camera Permission{'\n'}</Text>
            The app requires camera access to allow users to capture photos. Photos are captured
            only when the user presses the capture button. The app does not access the camera in the
            background.{'\n\n'}
            <Text style={styles.policyHeading}>Location (GPS) Permission{'\n'}</Text>
            The app uses location (GPS) access to fetch current latitude and longitude, display
            address and location name, and stamp GPS details, date, and time on photos. Location
            data is used only while the app is open and is processed locally on the device.{'\n\n'}
            <Text style={styles.policyHeading}>Photos and Storage{'\n'}</Text>
            All photos captured using the app are saved directly to the device gallery. The app does
            not upload photos to any server or cloud service.{'\n\n'}
            <Text style={styles.policyHeading}>Contact Information{'\n'}</Text>
            Developer: Ravi Suryavanshi{'\n'}
            Email: ravisuryavanshi785@gmail.com
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    backgroundColor: '#07090E',
    padding: 24,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 18,
  },
  toolbarTitleCol: {
    marginBottom: 6,
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
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  primaryBtnText: {
    color: '#07090E',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  segmentedGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#111827',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  segmentBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#1E293B',
  },
  segmentText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#00E676',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 20,
  },
  scrollArea: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  recordCard: {
    width: 320,
    flexGrow: 1,
    maxWidth: 420,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    margin: 8,
  },
  cardImage: {
    width: '100%',
    height: 210,
    backgroundColor: '#0B0E17',
  },
  cardBody: {
    padding: 14,
  },
  cardKicker: {
    color: '#94A3B8',
    fontSize: 11.5,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardMono: {
    color: '#00E676',
    fontSize: 11.5,
    fontFamily: 'JetBrains Mono, monospace',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 11.5,
    fontFamily: 'JetBrains Mono, monospace',
  },
  viewerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 9, 14, 0.94)',
    zIndex: 4500,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewerContainer: {
    width: '100%',
    maxWidth: 920,
    height: '90%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  viewerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  viewerMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImg: {
    flex: 1,
    width: '100%',
    backgroundColor: '#07090E',
    marginVertical: 14,
    borderRadius: 8,
  },
  viewerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 12,
  },
  viewerCoordsCol: {
    flex: 1,
    minWidth: 240,
  },
  viewerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: '#F43F5E',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 10,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  policyModalBox: {
    width: '94%',
    maxWidth: 640,
    height: '82%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
  },
  policyText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
  },
  policyBold: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  policyHeading: {
    color: '#00E676',
    fontWeight: '700',
    fontSize: 15,
  },
});
