import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

// Écran affiché tant que l'accès à la caméra n'est pas accordé
export function PermissionRequest({ onRequest, onManualAdd }: { onRequest: () => void; onManualAdd: () => void }) {
  const { t } = useLanguage();

  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionContent}>
        <Camera size={64} color="#10b981" strokeWidth={2} />
        <Text style={styles.permissionTitle}>{t('scan.permissionTitle')}</Text>
        <Text style={styles.permissionText}>
          {t('scan.permissionText')}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={onRequest}
        >
          <Text style={styles.permissionButtonText}>{t('scan.grantPermission')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onManualAdd}
        >
          <Text style={styles.skipButtonText}>{t('scan.addManuallyInstead')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
