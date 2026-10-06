import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Share2, UserMinus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Input } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { useHousehold } from '@/hooks/useHousehold';
import {
  createInvite,
  HouseholdActionError,
  joinHousehold,
  leaveHousehold,
  loadHousehold,
  personalPantryCount,
  previewInvite,
  removeMember,
  type HouseholdMember,
} from '@/lib/household';
import { inviteLink, normalizeInviteCode } from '@/lib/invite';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { showDialog } from '@/lib/dialog';

// Écran « Mon foyer » : code d'invitation (partage du lien), membres, rejoindre un foyer, quitter le foyer ;
// le propriétaire peut retirer un membre. Le nom affiché se modifie dans Réglages.
export default function HouseholdScreen() {
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const household = useHousehold();
  // Lien d'invitation : code prérempli
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(normalizeInviteCode(linkCode) ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Lien reçu alors qu'on est déjà dans un foyer partagé : il faut d'abord le quitter
  const invitedCode = normalizeInviteCode(linkCode);
  useEffect(() => {
    if (!invitedCode) return;
    setCode(invitedCode);
    if (household?.shared && household.invite?.code !== invitedCode) {
      showDialog(t('household.title'), t('household.errors.already_in_household'));
    }
  }, [invitedCode, household?.shared]);

  useFocusEffect(useCallback(() => {
    loadHousehold();
  }, []));

  const refresh = async () => {
    setRefreshing(true);
    await loadHousehold();
    setRefreshing(false);
  };

  const showError = (error: unknown) => {
    const key = error instanceof HouseholdActionError ? error.code : 'unknown';
    showDialog(t('common.error'), t(`household.errors.${key}`));
  };

  // Action avec indicateur sur son bouton ; erreurs traduites
  const run = async (id: string, action: () => Promise<void>) => {
    setBusy(id);
    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const expiresLabel = (iso: string) =>
    new Date(iso).toLocaleString(language, { weekday: 'long', hour: '2-digit', minute: '2-digit' });

  const shareInvite = async (invite: { code: string; expires_at: string }) => {
    const link = inviteLink(invite.code);
    const expires = expiresLabel(invite.expires_at);
    await Share.share({
      message: link
        ? t('household.shareLinkMessage', { link, code: invite.code, expires })
        : t('household.shareMessage', { code: invite.code, expires }),
    });
  };

  const invite = () => run('invite', async () => {
    const created = household?.invite ?? (await createInvite());
    await shareInvite(created);
  });

  const newCode = () => run('newCode', async () => {
    await createInvite();
  });

  // Rejoindre : aperçu (qui invite), puis transfert du garde-manger personnel s'il n'est pas vide
  const join = () => run('join', async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) throw new HouseholdActionError('invalid_code', 'invalid_code');
    const preview = await previewInvite(trimmed);
    const count = await personalPantryCount();
    const confirmJoin = await ask(
      t('household.joinConfirmTitle'),
      t('household.joinConfirmText', { name: preview.invited_by ?? '?', count: preview.member_count }),
      t('common.cancel'),
      [{ label: t('household.join'), value: 'yes' }],
    );
    if (confirmJoin !== 'yes') return;
    let transfer = false;
    if (count > 0) {
      const choice = await ask(
        t('household.transferTitle'),
        t('household.transferText', { count }),
        t('common.cancel'),
        [
          { label: t('household.transferKeep'), value: 'keep' },
          { label: t('household.transferMove'), value: 'move' },
        ],
      );
      if (!choice) return;
      transfer = choice === 'move';
    }
    await joinHousehold(trimmed, transfer);
    setCode('');
    showDialog(t('household.joinedTitle'), t('household.joinedText'));
  });

  const leave = () => {
    const last = (household?.members.length ?? 0) <= 1;
    showDialog(t('household.leaveTitle'), last ? t('household.leaveLastText') : t('household.leaveText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.leave'), style: 'destructive', onPress: () => run('leave', leaveHousehold) },
    ]);
  };

  const remove = (member: HouseholdMember) => {
    showDialog(t('household.removeTitle'), t('household.removeText', { name: member.name ?? t('household.guest') }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.remove'), style: 'destructive', onPress: () => run(`remove-${member.user_id}`, () => removeMember(member.user_id)) },
    ]);
  };

  const joinedLabel = (iso: string) =>
    t('household.joinedOn', { date: new Date(iso).toLocaleDateString(language, { day: 'numeric', month: 'short' }) });

  if (!household) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('household.title')} back />
        <View style={styles.content}>
          {[0, 1, 2].map((row) => <SkeletonRow key={row} />)}
        </View>
      </View>
    );
  }

  const full = household.members.length >= household.max_members;
  const isOwner = household.role === 'owner';

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader title={t('household.title')} back />
      <ScrollView
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        contentContainerStyle={[styles.content, safe.bottom(spacing.xxxl)]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {!household.shared && <Text style={styles.intro}>{t('household.personalIntro')}</Text>}

        {/* Invitation */}
        <Card variant="soft" style={styles.inviteCard}>
          <View style={styles.inviteHeader}>
            <Share2 size={sizes.icon} color={colors.primary} />
            <Text style={styles.cardTitle}>{t('household.inviteTitle')}</Text>
          </View>
          {full ? (
            <Text style={styles.hint}>{t('household.full', { max: household.max_members })}</Text>
          ) : (
            <>
              {household.invite ? (
                <>
                  <View style={styles.codeRow} accessible accessibilityLabel={household.invite.code}>
                    {household.invite.code.split('').map((char, index) => (
                      <View key={index} style={styles.codeBox}>
                        <Text style={styles.codeChar} maxFontSizeMultiplier={1.4}>{char}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.hint}>{t('household.codeValidUntil', { date: expiresLabel(household.invite.expires_at) })}</Text>
                </>
              ) : (
                <Text style={styles.hint}>{t('household.inviteHint')}</Text>
              )}
              <Button
                label={household.invite ? t('household.shareLink') : t('household.createCode')}
                icon={Share2}
                onPress={invite}
                loading={busy === 'invite'}
                disabled={!!busy && busy !== 'invite'}
              />
              {household.invite && (
                <Button label={t('household.newCode')} variant="ghost" size="small" onPress={newCode} loading={busy === 'newCode'} disabled={!!busy && busy !== 'newCode'} />
              )}
            </>
          )}
        </Card>

        {/* Membres */}
        <Card style={styles.membersCard}>
          <Text style={[styles.cardTitle, styles.membersTitle]}>
            {t('household.membersTitle', { count: household.members.length, max: household.max_members })}
          </Text>
          {household.members.map((member) => {
            const name = member.is_me ? t('household.you') : member.name ?? t('household.guest');
            return (
              <View key={member.user_id}>
                <View style={cardStyles.divider} />
                <View style={styles.member}>
                  <View style={[styles.avatar, member.is_me && styles.avatarMe]}>
                    <Text style={styles.avatarText}>{(member.is_me ? member.name ?? name : name).charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.memberText}>
                    <Text style={styles.memberName}>{name}</Text>
                    <Text style={styles.memberDetail}>
                      {member.is_me && member.role === 'owner' ? t('household.youManage') : joinedLabel(member.joined_at)}
                    </Text>
                  </View>
                  {member.role === 'owner' && <Badge label={t('household.owner')} tone="soon" style={styles.centered} />}
                  {isOwner && household.shared && !member.is_me && (
                    <Touchable
                      onPress={() => remove(member)}
                      disabled={!!busy}
                      style={styles.remove}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('household.remove')} ${name}`}
                    >
                      <UserMinus size={sizes.icon} color={colors.expired.text} />
                    </Touchable>
                  )}
                </View>
              </View>
            );
          })}
        </Card>

        {/* Rejoindre un foyer (un seul foyer partagé à la fois) */}
        {!household.shared && (
          <Card style={styles.joinCard}>
            <Text style={styles.cardTitle}>{t('household.joinTitle')}</Text>
            <View style={styles.joinRow}>
              <View style={styles.codeField}>
                <Input
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={t('household.codePlaceholder')}
                  accessibilityLabel={t('household.joinHint')}
                />
              </View>
              <Button label={t('household.join')} variant="accent" size="medium" onPress={join} loading={busy === 'join'} disabled={(!!busy && busy !== 'join') || code.length !== 6} />
            </View>
          </Card>
        )}

        {household.shared && (
          <Button label={t('household.leave')} variant="danger" size="small" onPress={leave} loading={busy === 'leave'} disabled={!!busy && busy !== 'leave'} />
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

// Question avec plusieurs réponses (Annuler en plus) ; null si annulée
function ask(title: string, message: string, cancel: string, options: { label: string; value: string }[]): Promise<string | null> {
  return new Promise((resolve) => {
    showDialog(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(null) },
        ...options.map((option) => ({ text: option.label, onPress: () => resolve(option.value) })),
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    gap: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inviteCard: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.cardTitle,
  },
  hint: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  codeBox: {
    flex: 1,
    // Grandes tailles de texte : la case grandit avec le caractère
    minHeight: sizes.codeBox,
    maxWidth: sizes.codeBox,
    borderRadius: radius.iconChip,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: {
    ...typography.title2,
    color: colors.primary,
  },
  membersCard: {
    paddingVertical: spacing.xs,
  },
  membersTitle: {
    paddingVertical: spacing.md,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touch + spacing.xl,
  },
  avatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMe: {
    backgroundColor: colors.accent,
  },
  avatarText: {
    ...typography.button,
    color: colors.onAccent,
  },
  memberText: {
    flex: 1,
    gap: spacing.xxs,
  },
  memberName: {
    ...typography.cardTitle,
  },
  memberDetail: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  centered: {
    alignSelf: 'center',
  },
  remove: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinCard: {
    gap: spacing.md,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  codeField: {
    flex: 1,
    minHeight: sizes.button,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  codeInput: {
    ...typography.bodyStrong,
    letterSpacing: spacing.xs,
    minHeight: sizes.touch,
  },
});
