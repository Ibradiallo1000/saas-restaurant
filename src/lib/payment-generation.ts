import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

import { initializeFirebase } from '@/firebase';
import { COLLECTION_NAMES } from '@/lib/constants';

type GeneratePaymentInput = {
  methodCode: string;
  countryCode: string;
  merchant: string;
  amount: number | string;
  phone?: string;
  db?: Firestore;
};

type PlatformPaymentVariant = {
  methodCode: string;
  countryCode: string;
  type: 'ussd' | 'link';
  ussdTemplate: string;
  isActive: boolean;
};

export async function generatePaymentLinkOrUSSD({
  methodCode,
  countryCode,
  merchant,
  amount,
  phone = '',
  db,
}: GeneratePaymentInput) {
  const firestore = db ?? initializeFirebase().firestore;

  const variantsQuery = query(
    collection(firestore, COLLECTION_NAMES.PLATFORM_PAYMENT_VARIANTS),
    where('methodCode', '==', methodCode),
    where('countryCode', '==', countryCode),
    where('isActive', '==', true),
    limit(1)
  );

  const snapshot = await getDocs(variantsQuery);
  const variant = snapshot.docs[0]?.data() as PlatformPaymentVariant | undefined;

  if (!variant) {
    throw new Error('Aucune variante de paiement active pour ce pays et cette méthode.');
  }

  return variant.ussdTemplate
    .replaceAll('{merchant}', merchant)
    .replaceAll('{amount}', String(amount))
    .replaceAll('{phone}', phone);
}
