import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, Globe, LogOut, Minus, Plus, Trash2, UserRound, Users, Utensils } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHousehold } from '@/hooks/useHousehold';
import { setDisplayName } from '@/lib/household';
import { DEFAULT_DIGEST, DIGEST_HOUR_MAX, DIGEST_HOUR_MIN, formatHour, loadDigestSettings, saveDigestSettings, type DigestSettings } from '@/lib/digestSettings';
import { rescheduleExpiryReminders } from '@/lib/notifications';
import { StepButton } from '@/components/ui/StepButton';
import { alertWriteError } from '@/lib/alertWriteError';
import { loadPantry, pantryGroups } from '@/lib/pantry';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { supabase } from '@/lib/supabase';
import { sendSentryTestError, sentryEnabled } from '@/lib/sentry';
import { notificationsSupported, sendTestReminder } from '@/lib/notifications';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Touchable } from '@/components/ui/Touchable';
import { APP_LANGUAGES } from '@/lib/languages';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { showDialog } from '@/lib/dialog';

export default function SettingsScreen() {
  const { language, t } = useLanguage();
  const { user, signOut, isAnonymous } = useAuth();
  const household = useHousehold();
  const me = household?.members.find((member) => member.is_me);
  // Nom affiché aux membres du foyer (feuille « Modifier »)
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => setName(me?.name ?? ''), [me?.name, editingName]);

  // Compte d'essai : se déconnecter perd l'accès aux données (aucun moyen de se reconnecter)
  const confirmSignOut = () => {
    if (!isAnonymous) {
      signOut();
      return;
    }
    showDialog(t('settings.guestSignOutTitle'), t('settings.guestSignOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('upgrade.title'), onPress: () => router.push('/auth/upgrade') },
      { text: t('settings.signOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      await setDisplayName(name);
      setEditingName(false);
    } catch {
      showDialog(t('common.error'), t('household.errors.unknown'));
    } finally {
      setSavingName(false);
    }
  };

  const testNotification = async () => {
    if (!user) return;
    const result = await sendTestReminder(user.id);
    if (result === 'denied') showDialog(t('notifications.deniedTitle'), t('notifications.deniedText'));
    else showDialog(t('notifications.testButton'), t('notifications.testSent'));
  };

  // « Vider le garde-manger » : tous les lots du foyer retirés en une action, rétablissable pendant 24 heures
  // dans « Récemment retirés » ; la confirmation dit combien d'aliments et pour qui
  const clearPantry = async () => {
    const rows = await loadPantry();
    if (!rows) return;
    const foods = pantryGroups(rows).length;
    if (foods === 0) {
      showDialog(t('settings.clearPantry'), t('settings.clearPantryEmpty'));
      return;
    }
    const shared = household?.shared ?? false;
    showDialog(
      t('settings.clearPantryTitle'),
      `${t(shared ? 'settings.clearPantryShared' : 'settings.clearPantryPersonal', { count: foods })} ${t('settings.clearPantryLots', { count: rows.length })} ${t('settings.clearPantryUndo')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.clearPantryConfirm', { count: foods }),
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_ingredients_with_undo', { p_ids: rows.map((row) => row.id) });
            if (error) {
              alertWriteError(t, 'clearing pantry', error);
              return;
            }
            notifyPantryChanged();
            showDialog(t('settings.clearPantry'), t('settings.clearPantryDone', { count: foods }));
          },
        },
      ],
    );
  };

  // Résumé quotidien : interrupteur et heure (serveur et rappels locaux)
  const [digest, setDigest] = useState<DigestSettings>(DEFAULT_DIGEST);
  useEffect(() => {
    if (user) loadDigestSettings(user.id).then(setDigest);
  }, [user?.id]);
  const changeDigest = async (next: DigestSettings) => {
    if (!user) return;
    const previous = digest;
    setDigest(next);
    const error = await saveDigestSettings(user.id, next);
    if (error) {
      setDigest(previous);
      alertWriteError(t, 'saving digest settings', error);
      return;
    }
    rescheduleExpiryReminders(user.id);
  };

  const displayName = me?.name || (isAnonymous ? t('auth.guestName') : t('settings.noName'));
  const currentLanguage = APP_LANGUAGES.find((lang) => lang.code === language)?.label ?? language;

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profil */}
        <Card style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || t('settings.notSignedIn')}</Text>
          </View>
          <Touchable onPress={() => setEditingName(true)} style={styles.edit} accessibilityRole="button" accessibilityLabel={t('settings.editName')}>
            <Text style={styles.editText}>{t('settings.edit')}</Text>
          </Touchable>
        </Card>

        {/* Compte d'essai : créer un vrai compte */}
        {isAnonymous && (
          <Card variant="soft" style={styles.guest}>
            <Text style={styles.guestTitle}>{t('settings.guestTitle')}</Text>
            <Text style={styles.guestText}>{t('settings.guestText')}</Text>
            <Button label={t('upgrade.title')} size="medium" icon={UserRound} onPress={() => router.push('/auth/upgrade')} />
          </Card>
        )}

        <Card style={styles.list}>
          <ListRow
            icon={Users}
            title={t('household.title')}
            subtitle={household?.shared ? t('settings.householdShared', { count: household.members.length }) : t('settings.householdPersonal')}
            onPress={() => router.push('/household')}
          />
          <ListRow
            divider
            icon={Utensils}
            title={t('preferences.title')}
            subtitle={t('settings.preferencesSubtitle')}
            onPress={() => router.push('/preferences')}
          />
          <ListRow divider icon={Globe} title={t('settings.language')} subtitle={currentLanguage} onPress={() => router.push('/language')} />
        </Card>

        <Text style={styles.sectionTitle}>{t('digest.section')}</Text>
        <Card style={styles.list}>
          <ListRow
            icon={Bell}
            title={t('digest.title')}
            subtitle={digest.enabled ? t('digest.subtitle', { hour: formatHour(digest.hour, language) }) : t('digest.off')}
            right={<Switch value={digest.enabled} onValueChange={(enabled) => changeDigest({ ...digest, enabled })} accessibilityLabel={t('digest.title')} />}
          />
          {digest.enabled ? (
            <View style={styles.hourRow}>
              <Text style={styles.hourLabel}>{t('digest.hourLabel', { hour: formatHour(digest.hour, language) })}</Text>
              <View style={styles.hourStepper}>
                <StepButton icon={Minus} label={t('digest.earlier')} disabled={digest.hour <= DIGEST_HOUR_MIN} onPress={() => changeDigest({ ...digest, hour: digest.hour - 1 })} />
                <StepButton icon={Plus} label={t('digest.later')} disabled={digest.hour >= DIGEST_HOUR_MAX} onPress={() => changeDigest({ ...digest, hour: digest.hour + 1 })} />
              </View>
            </View>
          ) : null}
        </Card>

        <Card style={styles.list}>
          <ListRow icon={Trash2} title={t('settings.clearPantry')} danger onPress={clearPantry} />
          <ListRow divider icon={LogOut} title={t('settings.signOut')} danger onPress={confirmSignOut} />
        </Card>

        {/* Développement seulement : vérifie que les erreurs remontent dans Sentry */}
        {__DEV__ && sentryEnabled && (
          <Button label={t('settings.sentryTest')} variant="ghost" size="small" onPress={sendSentryTestError} />
        )}
        {/* Développement seulement : compteurs du jour et quotas de fournisseurs épuisés */}
        {__DEV__ && user && (
          <Button label={t('devStatus.open')} variant="ghost" size="small" onPress={() => router.push('/dev/status')} />
        )}
        {/* Développement seulement : le rappel de péremption, sans attendre 9 h */}
        {__DEV__ && notificationsSupported && user && (
          <Button label={t('notifications.testButton')} variant="ghost" size="small" onPress={testNotification} />
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('settings.appVersion', { version: '1.0' })}</Text>
          <Text style={styles.footerSubtext}>{t('settings.tagline')}</Text>
        </View>
      </ScrollView>

      <BottomSheet visible={editingName} onClose={() => setEditingName(false)} keyboard>
        <SheetHeader title={t('household.yourName')} subtitle={t('household.yourNameHint')} onClose={() => setEditingName(false)} />
        <TextField value={name} onChangeText={setName} maxLength={40} placeholder={t('household.yourNamePlaceholder')} autoFocus />
        <Button
          label={t('household.save')}
          onPress={saveName}
          loading={savingName}
          disabled={name.trim() === (me?.name ?? '')}
          style={styles.saveName}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
  hourLabel: {
    ...typography.bodyMedium,
    flex: 1,
  },
  hourStepper: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: sizes.iconChipLarge,
    height: sizes.iconChipLarge,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.title3,
    color: colors.onAccent,
  },
  profileText: {
    flex: 1,
    gap: spacing.xxs,
  },
  profileName: {
    ...typography.cardTitle,
  },
  profileEmail: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  edit: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  editText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  guest: {
    gap: spacing.sm,
  },
  guestTitle: {
    ...typography.cardTitle,
    color: colors.primary,
  },
  guestText: {
    ...typography.body,
    fontSize: typography.listTitle.fontSize,
    marginBottom: spacing.sm,
  },
  list: {
    paddingVertical: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  footerText: {
    ...typography.secondaryStrong,
  },
  footerSubtext: {
    ...typography.secondary,
    textAlign: 'center',
  },
  saveName: {
    marginTop: spacing.lg,
  },
});
