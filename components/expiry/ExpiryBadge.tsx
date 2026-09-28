import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { expiryLabel, expiryStatus, type ExpiryStatus } from '@/lib/expiry';

interface Props {
  expiresAt: string | null | undefined;
  onPress?: () => void;
}

export const EXPIRY_TONES: Record<ExpiryStatus, BadgeTone> = {
  expired: 'expired',
  soon: 'soon',
  ok: 'ok',
  none: 'neutral',
};

// Badge de date : expiré (rouge), bientôt (ambre), OK (vert), sans date (neutre) ; touchable pour la modifier
export function ExpiryBadge({ expiresAt, onPress }: Props) {
  const { t, language } = useLanguage();
  return (
    <Badge
      label={expiryLabel(t, expiresAt, language)}
      tone={EXPIRY_TONES[expiryStatus(expiresAt)]}
      onPress={onPress}
      accessibilityLabel={onPress ? `${expiryLabel(t, expiresAt, language)}, ${t('expiry.edit')}` : undefined}
    />
  );
}
