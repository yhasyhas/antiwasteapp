import React from 'react';
import { Snowflake } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { daysUntil, expiryLabel, type ExpiryStatus } from '@/lib/expiry';
import { lotUrgency, type LotUrgency } from '@/lib/storage';

interface Props {
  expiresAt: string | null | undefined;
  // Type de date et emplacement du lot (phase 8) : date indicative jamais rouge, congélateur en bleu frais
  dateKind?: string | null;
  location?: string | null;
  onPress?: () => void;
}

export const EXPIRY_TONES: Record<ExpiryStatus, BadgeTone> = {
  expired: 'expired',
  soon: 'soon',
  ok: 'ok',
  none: 'neutral',
};

const URGENCY_TONES: Record<LotUrgency, BadgeTone> = { ...EXPIRY_TONES, frozen: 'frozen', indicative_passed: 'neutral' };

// Badge de date : expiré (rouge), bientôt (ambre, date stricte ou indicative), OK (vert), sans date (neutre) ; date indicative dépassée
// (neutre, « Date indicative dépassée ») ; au congélateur (bleu frais) ; touchable pour la modifier
export function ExpiryBadge({ expiresAt, dateKind, location, onPress }: Props) {
  const { t, language } = useLanguage();
  const urgency = lotUrgency({ expires_at: expiresAt ?? null, date_kind: dateKind, location });
  const label = urgency === 'indicative_passed' ? t('storage.indicativePassed') : expiryLabel(t, expiresAt, language);
  // « Aujourd'hui » en rouge, comme une date passée (dernier jour pour l'utiliser), pour une date stricte ;
  // en ambre pour une date indicative
  const tone = urgency === 'soon' && expiresAt && daysUntil(expiresAt) === 0 && dateKind !== 'best_before' ? 'expired' : URGENCY_TONES[urgency];
  return (
    <Badge
      label={label}
      tone={tone}
      icon={urgency === 'frozen' ? Snowflake : undefined}
      onPress={onPress}
      accessibilityLabel={onPress ? `${label}, ${t('expiry.edit')}` : undefined}
    />
  );
}
