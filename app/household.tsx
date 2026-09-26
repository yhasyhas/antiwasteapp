import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Crown, LogOut, Share2, UserMinus, UserPlus, Users } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
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
  setDisplayName,
  type HouseholdMember,
} from '@/lib/household';

// Écran « Mon foyer » : membres, nom affiché, code d'invitation (partage), rejoindre un foyer,
// quitter le foyer ; le propriétaire peut retirer un membre
export default function HouseholdScreen() {
  const { t, language } = useLanguage();
  const household = useHousehold();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const me = household?.members.find((m) => m.is_me);
  const [name, setName] = useState('');

  useEffect(() => setName(me?.name ?? ''), [me?.name]);

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
    Alert.alert(t('common.error'), t(`household.errors.${key}`));
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
    await Share.share({ message: t('household.shareMessage', { code: invite.code, expires: expiresLabel(invite.expires_at) }) });
  };

  const invite = () => run('invite', async () => {
    const created = household?.invite ?? (await createInvite());
    await shareInvite(created);
  });

  const newCode = () => run('newCode', async () => {
    await createInvite();
  });

  const saveName = () => run('name', () => setDisplayName(name));

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
    Alert.alert(t('household.joinedTitle'), t('household.joinedText'));
  });

  const leave = () => {
    const last = (household?.members.length ?? 0) <= 1;
    Alert.alert(t('household.leaveTitle'), last ? t('household.leaveLastText') : t('household.leaveText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.leave'), style: 'destructive', onPress: () => run('leave', leaveHousehold) },
    ]);
  };

  const remove = (member: HouseholdMember) => {
    Alert.alert(t('household.removeTitle'), t('household.removeText', { name: member.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('household.remove'), style: 'destructive', onPress: () => run(`remove-${member.user_id}`, () => removeMember(member.user_id)) },
    ]);
  };

  if (!household) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: true, title: t('household.title') }} />
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const full = household.members.length >= household.max_members;
  const isOwner = household.role === 'owner';

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('household.title') }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>{household.shared ? t('household.sharedIntro') : t('household.personalIntro')}</Text>

        {/* Membres */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Users size={18} color="#10b981" />
            <Text style={styles.cardTitle}>
              {t('household.members', { count: household.members.length, max: household.max_members })}
            </Text>
          </View>
          {household.members.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.name}{member.is_me ? ` (${t('household.me')})` : ''}
                </Text>
                {member.role === 'owner' && (
                  <View style={styles.ownerBadge}>
                    <Crown size={12} color="#b45309" />
                    <Text style={styles.ownerText}>{t('household.owner')}</Text>
                  </View>
                )}
              </View>
              {isOwner && household.shared && !member.is_me && (
                <TouchableOpacity onPress={() => remove(member)} disabled={!!busy} hitSlop={8}>
                  {busy === `remove-${member.user_id}` ? <ActivityIndicator size="small" color="#ef4444" /> : <UserMinus size={20} color="#ef4444" />}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Nom affiché aux membres */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('household.yourName')}</Text>
          <Text style={styles.hint}>{t('household.yourNameHint')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder={t('household.yourNamePlaceholder')}
            />
            <TouchableOpacity style={styles.smallButton} onPress={saveName} disabled={!!busy || name.trim() === (me?.name ?? '')}>
              {busy === 'name' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.smallButtonText}>{t('household.save')}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Invitation */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <UserPlus size={18} color="#10b981" />
            <Text style={styles.cardTitle}>{t('household.inviteTitle')}</Text>
          </View>
          {full ? (
            <Text style={styles.hint}>{t('household.full', { max: household.max_members })}</Text>
          ) : (
            <>
              <Text style={styles.hint}>{t('household.inviteHint')}</Text>
              {household.invite && (
                <View style={styles.codeBox}>
                  <Text style={styles.code} selectable>{household.invite.code}</Text>
                  <Text style={styles.codeExpiry}>{t('household.validUntil', { date: expiresLabel(household.invite.expires_at) })}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.primaryButton} onPress={invite} disabled={!!busy}>
                {busy === 'invite' ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Share2 size={18} color="#fff" />
                    <Text style={styles.primaryButtonText}>{household.invite ? t('household.shareCode') : t('household.createCode')}</Text>
                  </>
                )}
              </TouchableOpacity>
              {household.invite && (
                <TouchableOpacity onPress={newCode} disabled={!!busy} style={styles.linkButton}>
                  <Text style={styles.linkText}>{t('household.newCode')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Rejoindre un foyer (un seul foyer partagé à la fois) */}
        {!household.shared && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('household.joinTitle')}</Text>
            <Text style={styles.hint}>{t('household.joinHint')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="ABC234"
              />
              <TouchableOpacity style={styles.smallButton} onPress={join} disabled={!!busy || code.length !== 6}>
                {busy === 'join' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.smallButtonText}>{t('household.join')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {household.shared && (
          <TouchableOpacity style={styles.leaveButton} onPress={leave} disabled={!!busy}>
            {busy === 'leave' ? <ActivityIndicator color="#ef4444" /> : (
              <>
                <LogOut size={18} color="#ef4444" />
                <Text style={styles.leaveText}>{t('household.leave')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </>
  );
}

// Question avec plusieurs réponses (Annuler en plus) ; null si annulée
function ask(title: string, message: string, cancel: string, options: { label: string; value: string }[]): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
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
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  memberName: { fontSize: 15, color: '#111827' },
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ownerText: { fontSize: 11, color: '#b45309', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  codeInput: { letterSpacing: 4, fontWeight: '700', fontSize: 18 },
  smallButton: { backgroundColor: '#10b981', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, minWidth: 90, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: '600' },
  codeBox: { alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 12 },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6, color: '#047857' },
  codeExpiry: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  primaryButton: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  linkButton: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: '#10b981', fontWeight: '600' },
  leaveButton: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: 10, paddingVertical: 12 },
  leaveText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
