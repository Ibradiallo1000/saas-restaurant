
'use client';

/**
 * @fileOverview Layout de protection pour l'espace administration SaaS.
 * Seuls les UID présents dans 'platformUsers' avec un rôle admin peuvent entrer.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { COLLECTION_NAMES, ROLES } from '@/lib/constants';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vérification Autorité SaaS...</p>
      </div>
    );
  }

  // Si l'utilisateur n'est pas reconnu comme admin plateforme
  if (!platformProfile || (platformProfile.role !== ROLES.SUPER_ADMIN && platformProfile.role !== ROLES.ADMIN)) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6 px-4 animate-in zoom-in-95 duration-500">
        <div className="p-10 bg-destructive/10 text-destructive rounded-3xl border border-destructive/20 flex flex-col items-center gap-6 shadow-2xl">
          <div className="p-4 bg-destructive rounded-2xl text-white">
            <ShieldAlert className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">Zone Restreinte</h1>
            <p className="text-sm font-medium">Votre compte n'a pas les droits requis pour administrer la plateforme globale.</p>
          </div>
          <div className="w-full space-y-2">
            <Button onClick={() => router.push('/dashboard')} variant="outline" className="w-full border-destructive/20 hover:bg-destructive/10">
              Aller au Dashboard Restaurant
            </Button>
            <Button onClick={() => router.push('/login')} variant="ghost" className="w-full text-xs">
              Changer de compte
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header Admin Flottant */}
      <div className="bg-primary px-8 py-3 flex items-center justify-between text-primary-foreground shadow-xl">
        <div className="flex items-center gap-2 font-black italic uppercase tracking-tighter text-sm">
          <ShieldAlert className="h-5 w-5" /> SaaS Central Command
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[9px] font-black uppercase leading-none opacity-80">Rôle Admin</span>
            <span className="text-xs font-bold leading-none">{platformProfile.role?.replace('_', ' ').toUpperCase()}</span>
          </div>
          <Button variant="secondary" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => router.push('/dashboard')}>
            Mode Vue Restaurant
          </Button>
        </div>
      </div>
      
      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}
