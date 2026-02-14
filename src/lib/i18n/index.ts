'use client';

import { fr } from './fr';

// Pour le moment, on utilise uniquement le français comme base.
// La structure permet d'ajouter d'autres langues facilement.
export const useTranslation = () => {
  return { t: fr };
};
