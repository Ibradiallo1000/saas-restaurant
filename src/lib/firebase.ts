/**
 * @fileOverview Instance Firestore initialisée, réutilisable partout.
 */

import { initializeFirebase } from "@/firebase";

const { firestore: db } = initializeFirebase();
export { db };

