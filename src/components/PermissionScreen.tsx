import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface PermissionScreenProps {
  denied: boolean;
  onAccept: () => void;
  onRetry: () => void;
  onOpenPrivacyPolicy: () => void;
}

export const PermissionScreen: React.FC<PermissionScreenProps> = ({
  denied,
  onAccept,
  onRetry,
  onOpenPrivacyPolicy,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.heroTitle}>GPS Map Camera</Text>
      <Text style={styles.heroDesc}>Professional Field Survey Tool</Text>

      {!denied ? (
        <View style={styles.contentBox}>
          <ScrollView style={styles.policyBox}>
            <Text style={styles.policyHeader}>Permissions Required:</Text>
            <Text style={styles.policyItem}>
              <Text style={styles.bold}>1. Camera:</Text> Documentation capture के लिए.
            </Text>
            <Text style={styles.policyItem}>
              <Text style={styles.bold}>2. GPS:</Text> Real-time location stamping के लिए.
            </Text>
            <Text style={styles.policyItem}>
              <Text style={styles.bold}>3. Storage:</Text> Photos को gallery में save करने के लिए.
            </Text>
            <Text style={styles.policyFooter}>
              Hamaari{' '}
              <Text style={styles.policyLink} onPress={onOpenPrivacyPolicy}>
                Privacy Policy
              </Text>{' '}
              padhein.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.heroBtn} onPress={onAccept} activeOpacity={0.85}>
            <Text style={styles.heroBtnText}>Accept & Initialize</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentBox}>
          <Text style={styles.deniedText}>
            Permissions Denied!{'\n'}App बिना sensors के सही से काम नहीं करेगी.
          </Text>
          <TouchableOpacity
            style={[styles.heroBtn, styles.retryBtn]}
            onPress={onRetry}
            activeOpacity={0.85}
          >
            <Text style={styles.heroBtnText}>Try Again / Grant Access</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 5000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 35,
  },
  heroTitle: {
    color: '#00e676',
    fontSize: 38,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  heroDesc: {
    color: '#777777',
    fontSize: 18,
    marginBottom: 35,
    maxWidth: 300,
    lineHeight: 26,
    textAlign: 'center',
  },
  contentBox: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  policyBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 25,
    maxHeight: 190,
  },
  policyHeader: {
    color: '#00e676',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 12,
  },
  policyItem: {
    color: '#cccccc',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  policyFooter: {
    color: '#cccccc',
    fontSize: 12,
    marginTop: 12,
  },
  policyLink: {
    color: '#00e676',
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
  heroBtn: {
    paddingVertical: 20,
    paddingHorizontal: 55,
    borderRadius: 50,
    backgroundColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    backgroundColor: '#ff5252',
  },
  heroBtnText: {
    fontWeight: '900',
    fontSize: 20,
    color: '#000000',
  },
  deniedText: {
    color: '#ff5252',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22,
  },
});
