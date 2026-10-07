import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Input';
import { sendAppFeedback, technicalInfo, type FeedbackKind } from '@/lib/feedback';
import { showDialog } from '@/lib/dialog';
import { colors, sizes, spacing, typography } from '@/constants/theme';

const KINDS: FeedbackKind[] = ['problem', 'idea', 'other'];
const MAX_LENGTH = 2000;

interface Props {
  visible: boolean;
  onClose: () => void;
}

// « Donner mon avis » : type (problème, idée, autre) et texte ; version de l'app, téléphone, système et langue
// ajoutés automatiquement et affichés (rien d'autre : ni e-mail ni nom)
export function FeedbackSheet({ visible, onClose }: Props) {
  const { t, language } = useLanguage();
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const info = technicalInfo(language);

  useEffect(() => {
    if (!visible) return;
    setKind(null);
    setMessage('');
  }, [visible]);

  const send = async () => {
    if (!kind || !message.trim()) return;
    setSending(true);
    const result = await sendAppFeedback(kind, message, language);
    setSending(false);
    if (result === 'sent') {
      onClose();
      showDialog(t('feedback.sentTitle'), t('feedback.sentText'));
      return;
    }
    showDialog(t('common.error'), result === 'daily_limit' ? t('rating.dailyLimit') : t('rating.sendError'));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboard>
      <SheetHeader title={t('feedback.title')} subtitle={t('feedback.subtitle')} onClose={onClose} />
      <View style={styles.kinds}>
        {KINDS.map((value) => (
          <Chip key={value} label={t(`feedback.kind.${value}` as never) as string} selected={kind === value} showCheck onPress={() => setKind(value)} />
        ))}
      </View>
      <TextField
        value={message}
        onChangeText={setMessage}
        placeholder={kind === 'problem' ? t('feedback.placeholderProblem') : t('feedback.placeholder')}
        maxLength={MAX_LENGTH}
        multiline
        style={styles.message}
      />
      <Text style={styles.info}>{t('feedback.technical', { details: `${info.app_version} · ${info.device} · ${info.os} · ${info.language}` })}</Text>
      <Button label={t('feedback.send')} onPress={send} loading={sending} disabled={!kind || !message.trim()} style={styles.send} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  message: {
    minHeight: sizes.thumbnail * 1.5,
    textAlignVertical: 'top',
  },
  info: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  send: {
    marginTop: spacing.lg,
  },
});
