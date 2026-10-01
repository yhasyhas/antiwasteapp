import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Combine, Info, PackageOpen, Snowflake, Sun, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Touchable } from '@/components/ui/Touchable';
import { addedWhen, expiryFromShelfLife, expiryLabel, shortDate } from '@/lib/expiry';
import { lotLabel, mergeableLots, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { canFreeze, defaultDateKind, defaultLocation, LOCATIONS, lotUrgency, refreezeRule, wasThawed, type DateKind, type StorageLocation } from '@/lib/storage';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import type { PantryIngredient } from './IngredientCard';

// Changements d'un lot enregistrés ensemble (date, type de date, emplacement)
export interface LotPatch {
  expires_at?: string | null;
  expiry_estimated?: boolean;
  date_kind?: DateKind;
  location?: StorageLocation;
}

// Message affiché sous un lot (congélation, décongélation), à la place d'une alerte du système
export interface LotNotice {
  id: string;
  title: string;
  text: string;
}

interface Props {
  group: LotGroup<PantryIngredient>;
  // Foyer partagé : « Ajouté par … » d'un lot (sinon null)
  addedBy: (lot: PantryIngredient) => string | null;
  onRemoveLot: (lot: PantryIngredient) => void;
  onRemoveAll: () => void;
  // Renvoie vrai si le changement est enregistré (un passage au congélateur ou hors du congélateur passe par
  // onFreeze / onThaw)
  onUpdateLot: (lot: PantryIngredient, patch: LotPatch) => Promise<boolean>;
  onFreeze: (lot: PantryIngredient) => void;
  onThaw: (lot: PantryIngredient) => void;
  onOpen: (lot: PantryIngredient) => void;
  onMerge: (lots: PantryIngredient[]) => void;
  // Date indicative dépassée ou date estimée : lien vers « Est-ce encore bon ? » (fiche de l'aliment)
  onShowStillGood?: () => void;
  notice?: LotNotice | null;
  onDismissNotice?: () => void;
}

const locationOf = (lot: PantryIngredient) => (lot.location as StorageLocation | null) ?? defaultLocation(lot.category, lot.kind, lot.food_key);
const dateKindOf = (lot: PantryIngredient) => (lot.date_kind as DateKind | null) ?? defaultDateKind(lot.category, lot.kind);

// « Dans ton garde-manger », en haut de la feuille d'un aliment : ses lots, du plus ancien au plus récent (même
// un seul), avec quantité, date (touchable pour modifier la date, son type et l'emplacement), auteur et date
// d'ajout, « Date estimée par l'app » ; par lot : emplacement, « Je l'ai ouvert », « Congeler » ou « Décongeler », retrait ; fusion des lots
// de même date et même unité, retrait de l'aliment entier
export function PantryLotsSection({ group, addedBy, onRemoveLot, onRemoveAll, onUpdateLot, onFreeze, onThaw, onOpen, onMerge, onShowStillGood, notice, onDismissNotice }: Props) {
  const { t, language } = useLanguage();
  // Lot en cours de modification : date, type de date, emplacement
  const [editing, setEditing] = useState<{ id: string; value: string; dateKind: DateKind; location: StorageLocation } | null>(null);
  const [saving, setSaving] = useState(false);
  const { lots } = group;
  const multiple = lots.length > 1;

  const startEditing = (lot: PantryIngredient) => setEditing(editing?.id === lot.id ? null : {
    id: lot.id,
    value: lot.expires_at ?? expiryFromShelfLife(undefined, lot.kind),
    dateKind: dateKindOf(lot),
    location: locationOf(lot),
  });

  const save = async (lot: PantryIngredient, expiresAt: string | null) => {
    if (!editing) return;
    // Congélateur choisi, ou quitté : les actions dédiées (date estimée, conseil, rappel)
    if (editing.location === 'freezer' && locationOf(lot) !== 'freezer') {
      setEditing(null);
      onFreeze(lot);
      return;
    }
    if (editing.location !== 'freezer' && locationOf(lot) === 'freezer') {
      setEditing(null);
      onThaw(lot);
      return;
    }
    setSaving(true);
    // Date changée par l'utilisateur (ou retirée) : plus estimée
    const dateChanged = expiresAt !== lot.expires_at;
    const saved = await onUpdateLot(lot, { expires_at: expiresAt, date_kind: editing.dateKind, location: editing.location, ...(dateChanged && { expiry_estimated: false }) });
    setSaving(false);
    if (saved) setEditing(null);
  };

  // « Ouvert le 2 oct. », « Congelé le 1 oct. », « De préférence avant »
  const stateLine = (lot: PantryIngredient) => [
    lot.location === 'freezer' && lot.frozen_at ? t('storage.frozenOn', { date: shortDate(lot.frozen_at, language) }) : null,
    lot.location !== 'freezer' && lot.thawed_at ? t('storage.thawedOn', { date: shortDate(lot.thawed_at, language) }) : null,
    lot.opened_at ? t('storage.openedOn', { date: shortDate(lot.opened_at, language) }) : null,
    lot.expires_at ? `${t(dateKindOf(lot) === 'best_before' ? 'storage.bestBefore' : 'storage.useBy')} ${shortDate(lot.expires_at, language)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('lots.inPantry')}</Text>
        {multiple ? (
          <Text style={styles.total}>{[t('lots.total', { quantity: totalLabel(lots, language) }), t('lots.count', { count: lots.length })].join(' · ')}</Text>
        ) : null}
        {multiple ? <Text style={styles.hint}>{t('lots.order')}</Text> : null}
      </View>

      {lots.map((lot) => {
        const by = addedBy(lot);
        const when = addedWhen(t, lot.created_at, language);
        const isEditing = editing?.id === lot.id;
        const frozen = locationOf(lot) === 'freezer';
        const state = stateLine(lot);
        const indicativePassed = lotUrgency(lot) === 'indicative_passed';
        const estimated = !!lot.expiry_estimated && !!lot.expires_at;
        // Déjà décongelé : viande, poisson, plat… pas de « Congeler » (explication) ; pain, fruits, légumes…
        // « Congeler » avec un avertissement
        const freezable = canFreeze(lot);
        const refreezeHint = wasThawed(lot)
          ? t(freezable ? 'storage.refreezeWarning' : refreezeRule(lot.category, lot.kind) === 'eat' ? 'storage.thawedEat' : 'storage.thawedCookFirst')
          : null;
        return (
          <View key={lot.id}>
            <View style={cardStyles.divider} />
            <View style={styles.lot}>
              <View style={styles.lotText}>
                <Text style={styles.quantity}>{lotLabel(lot, lots, language) || lot.name}</Text>
                <Text style={styles.details}>{by ? `${by} · ${when}` : t('lots.addedWhen', { when })}</Text>
                {state ? <Text style={styles.details}>{state}</Text> : null}
                {estimated ? <Text style={styles.details}>{t('storage.estimated')}</Text> : null}
              </View>
              <ExpiryBadge expiresAt={lot.expires_at} dateKind={dateKindOf(lot)} location={lot.location} onPress={() => startEditing(lot)} />
              {multiple ? (
                <Touchable onPress={() => onRemoveLot(lot)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('lots.remove')}>
                  <Trash2 size={sizes.icon} color={colors.expired.text} />
                </Touchable>
              ) : null}
            </View>
            {(indicativePassed || estimated) && onShowStillGood ? (
              <Touchable onPress={onShowStillGood} style={styles.link} accessibilityRole="link">
                <Text style={styles.linkText}>{t('storage.stillGoodLink')}</Text>
              </Touchable>
            ) : null}
            {/* Actions rapides du lot */}
            <View style={styles.quick}>
              <Chip label={t(`storage.${locationOf(lot)}`)} onPress={() => startEditing(lot)} accessibilityLabel={`${t('storage.location')} : ${t(`storage.${locationOf(lot)}`)}`} />
              {!lot.opened_at && !frozen ? <Chip label={t('storage.opened')} icon={PackageOpen} onPress={() => onOpen(lot)} /> : null}
              {frozen
                ? <Chip label={t('storage.thaw')} icon={Sun} onPress={() => onThaw(lot)} />
                : freezable ? <Chip label={t('storage.freeze')} icon={Snowflake} iconColor={colors.foodFamilies.cold.icon} onPress={() => onFreeze(lot)} /> : null}
            </View>
            {refreezeHint && !frozen ? <Text style={styles.refreeze}>{refreezeHint}</Text> : null}
            {notice?.id === lot.id ? (
              <View style={styles.notice} accessibilityLiveRegion="polite">
                <View style={styles.noticeHeader}>
                  <Info size={sizes.icon} color={colors.primary} />
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                </View>
                <Text style={styles.noticeText}>{notice.text}</Text>
                {onDismissNotice ? <Button label={t('common.ok')} size="small" variant="soft" onPress={onDismissNotice} style={styles.noticeButton} /> : null}
              </View>
            ) : null}
            {isEditing ? (
              <View style={styles.editor}>
                <ExpiryPicker value={editing.value} onChange={(value) => setEditing({ ...editing, value })} />
                <View style={styles.choices}>
                  {(['use_by', 'best_before'] as DateKind[]).map((kind) => (
                    <Chip key={kind} label={t(kind === 'use_by' ? 'storage.useBy' : 'storage.bestBefore')} selected={editing.dateKind === kind} onPress={() => setEditing({ ...editing, dateKind: kind })} />
                  ))}
                </View>
                <Text style={styles.hint}>{t(editing.dateKind === 'use_by' ? 'storage.useByHint' : 'storage.bestBeforeHint')}</Text>
                <Text style={styles.label}>{t('storage.location')}</Text>
                <View style={styles.choices}>
                  {LOCATIONS.filter((location) => location !== 'freezer' || freezable || frozen).map((location) => (
                    <Chip key={location} label={t(`storage.${location}`)} selected={editing.location === location} onPress={() => setEditing({ ...editing, location })} />
                  ))}
                </View>
                <View style={styles.editorActions}>
                  <Button label={t('expiry.save')} size="small" onPress={() => save(lot, editing.value)} loading={saving} />
                  {lot.expires_at ? (
                    <Button label={t('expiry.removeDate')} size="small" variant="ghost" onPress={() => save(lot, null)} disabled={saving} />
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.actions}>
        {mergeableLots(lots).map((same) => (
          <Button
            key={same.map((lot) => lot.id).join(',')}
            label={t('lots.merge', { count: same.length, date: expiryLabel(t, same[0].expires_at, language) })}
            icon={Combine}
            variant="soft"
            size="medium"
            onPress={() => onMerge(same)}
          />
        ))}
        <Button label={t('pantry.removeFromPantry')} icon={Trash2} variant="danger" size="medium" onPress={onRemoveAll} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.cardTitle,
  },
  total: {
    ...typography.bodyMedium,
  },
  hint: {
    ...typography.secondary,
  },
  label: {
    ...typography.label,
  },
  lot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  lotText: {
    flex: 1,
    gap: spacing.xxs,
  },
  quantity: {
    ...typography.listTitle,
  },
  details: {
    ...typography.secondary,
  },
  remove: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    alignSelf: 'flex-start',
    minHeight: sizes.touch,
    justifyContent: 'center',
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  refreeze: {
    ...typography.secondary,
    paddingBottom: spacing.md,
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.primarySoft,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  noticeTitle: {
    ...typography.bodyStrong,
    flex: 1,
  },
  noticeText: {
    ...typography.body,
  },
  noticeButton: {
    alignSelf: 'flex-start',
  },
  editor: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
