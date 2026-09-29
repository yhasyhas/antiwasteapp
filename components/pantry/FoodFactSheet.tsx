import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Flag, Globe2, Info, Leaf, Recycle, Sun, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Input } from '@/components/ui/Input';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { modalStyles } from '@/components/recipe/modalStyles';
import { fetchFoodFact, reportFoodFact, type FoodFactResult } from '@/lib/foodFacts';

interface Props {
  ingredient: { id: string; name: string; food_key?: string | null } | null;
  onClose: () => void;
}

// Fiche d'un aliment du garde-manger : description, origine, saison, atouts nutritionnels, astuces
// anti-gaspi. Informations générales seulement (mention en bas), avec « Signaler une erreur ».
export function FoodFactSheet({ ingredient, onClose }: Props) {
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const [result, setResult] = useState<FoodFactResult | null>(null);
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!ingredient) return;
    setResult(null);
    setReporting(false);
    setMessage('');
    let active = true;
    fetchFoodFact(ingredient).then((loaded) => active && setResult(loaded));
    return () => {
      active = false;
    };
  }, [ingredient?.id]);

  const lang = (['fr', 'en', 'es'].includes(language) ? language : 'fr') as 'fr' | 'en' | 'es';
  const section = result?.ok ? result.fact[lang] : null;

  const sendReport = async () => {
    if (!result?.ok) return;
    setSending(true);
    const sent = await reportFoodFact(result.foodKey, lang, message);
    setSending(false);
    if (!sent) return Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
    setReporting(false);
    setMessage('');
    Alert.alert(t('facts.reportedTitle'), t('facts.reportedText'));
  };

  const errorText = result && !result.ok
    ? result.reason === 'not_food' ? t('facts.notFood')
      : result.reason === 'user_quota' ? t('facts.userQuota')
        : result.reason === 'provider_quota' ? t('facts.providerQuota')
          : t('facts.unavailable')
    : null;

  return (
    <Modal visible={ingredient !== null} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoider>
        <View style={modalStyles.modalOverlay}>
          <View style={[modalStyles.modalContent, safe.bottom(24)]}>
            <View style={modalStyles.modalHeader}>
              <Text style={modalStyles.modalTitle}>{capitalize(section?.name ?? ingredient?.name ?? '')}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel={t('common.close')}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {!result ? (
              <View style={styles.loading}>
                <ActivityIndicator color="#10b981" />
                <Text style={styles.loadingText}>{t('facts.loading')}</Text>
              </View>
            ) : errorText ? (
              <Text style={styles.error}>{errorText}</Text>
            ) : section ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.description}>{section.description}</Text>
                <Row icon={<Globe2 size={18} color="#10b981" />} title={t('facts.origin')} text={section.origin} />
                <Row icon={<Sun size={18} color="#f59e0b" />} title={t('facts.season')} text={section.season} />
                <List icon={<Leaf size={18} color="#10b981" />} title={t('facts.nutrition')} items={section.nutrition} />
                <List icon={<Recycle size={18} color="#0ea5e9" />} title={t('facts.tips')} items={section.tips} />

                <View style={styles.disclaimer}>
                  <Info size={14} color="#6b7280" />
                  <Text style={styles.disclaimerText}>{t('facts.disclaimer')}</Text>
                </View>

                {reporting ? (
                  <View style={styles.report}>
                    <Input
                      style={styles.reportInput}
                      value={message}
                      onChangeText={setMessage}
                      placeholder={t('facts.reportPlaceholder')}
                      maxLength={500}
                      multiline
                    />
                    <View style={styles.reportActions}>
                      <TouchableOpacity onPress={() => setReporting(false)} style={styles.reportCancel}>
                        <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={sendReport} style={styles.reportSend} disabled={sending}>
                        {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.reportSendText}>{t('facts.reportSend')}</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.reportButton} onPress={() => setReporting(true)}>
                    <Flag size={14} color="#6b7280" />
                    <Text style={styles.reportButtonText}>{t('facts.report')}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Row({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>{icon}<Text style={styles.blockTitle}>{title}</Text></View>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );
}

function List({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>{icon}<Text style={styles.blockTitle}>{title}</Text></View>
      {items.map((item, index) => (
        <Text key={index} style={styles.blockText}>• {item}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  loadingText: { color: '#6b7280', fontSize: 14 },
  error: { color: '#6b7280', fontSize: 15, lineHeight: 22, paddingVertical: 16 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 12 },
  block: { marginBottom: 14, gap: 4 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  blockTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  blockText: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  disclaimer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginTop: 4 },
  disclaimerText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 },
  reportButton: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', paddingVertical: 12 },
  reportButtonText: { color: '#6b7280', fontSize: 13, textDecorationLine: 'underline' },
  report: { gap: 8, marginTop: 12 },
  reportInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: 'top', fontSize: 14 },
  reportActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  reportCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  reportCancelText: { color: '#6b7280', fontWeight: '600' },
  reportSend: { backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
  reportSendText: { color: '#fff', fontWeight: '600' },
});
