
'use client';

/**
 * @fileOverview Layout de protection pour l'espace administration SaaS.
 * Seuls les utilisateurs présents dans 'platformUsers' peuvent accéder à cette zone.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { COLLECTION_NAMES, ROLES } from '@/lib/constants';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const platformUserRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, COLLECTION_NAMES.PLATFORM_USERS, user.uid);
  }, [db, user]);

  const { data: platformProfile, isLoading: isPlatformLoading } = useDoc(platformUserRef);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || isPlatformLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Si l'utilisateur n'est pas un admin de la plateforme
  if (!platformProfile || (platformProfile.role !== ROLES.SUPER_ADMIN && platformProfile.role !== ROLES.ADMIN)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="p-10 bg-destructive/10 text-destructive rounded-3xl border border-destructive/20 flex flex-col items-center gap-6">
          <ShieldAlert className="h-16 w-16" />
          <h1 className="text-2xl font-black uppercase italic">Zone Restreinte</h1>
          <p className="text-sm">Vous n'avez pas les droits nécessaires pour accéder à l'administration SaaS.</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full">
            Aller au Dashboard Restaurant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-primary px-8 py-3 flex items-center justify-between text-primary-foreground shadow-lg">
        <div className="flex items-center gap-2 font-black italic uppercase tracking-tighter">
          <ShieldAlert className="h-5 w-5" /> SaaS Central Admin
        </div>
        <div className="text-xs font-bold opacity-80">
          Connecté en tant que : {platformProfile.role?.toUpperCase()}
        </div>
      </div>
      <div className="p-8 max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}
