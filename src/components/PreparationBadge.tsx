import React from 'react';
import { getEffectivePreparationMode, PREPARATION_MODES, PreparationItem } from '@/utils/preparation-logic';
import { Badge } from '@/components/ui/badge';

interface PreparationBadgeProps {
  item: PreparationItem;
  className?: string;
}

export const PreparationBadge: React.FC<PreparationBadgeProps> = ({ item, className }) => {
  const mode = getEffectivePreparationMode(item);
  const config = PREPARATION_MODES.find((m) => m.value === mode) || PREPARATION_MODES[0];

  return (
    <Badge variant="secondary" className={`text-[10px] ${config.badgeClass} ${className ?? ''}`}>
      {config.label}
    </Badge>
  );
};
