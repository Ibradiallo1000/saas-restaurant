'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Chargement...</div>}>
      <InvitePageContent />
    </Suspense>
  );
}

function InvitePageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const db = useFirestore();
  const auth = getAuth();

  const token = params?.get("token");

  const [password, setPassword] = useState('');
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 LOAD INVITATION (VERSION PRO)
  useEffect(() => {
    const load = async () => {
      try {
        if (!token) {
          setError("Lien invalide");
          setLoading(false);
          return;
        }

        const ref = doc(db, "invitations", token);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Invitation invalide ou expirée");
          setLoading(false);
          return;
        }

        const data = snap.data();

        if (data.status === "accepted") {
          setError("Invitation déjà utilisée");
          setLoading(false);
          return;
        }

        setInvitation({ id: snap.id, ...data });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, db]);

  // 🔥 ACCEPT INVITATION
  const handleAccept = async () => {
    if (!invitation) return;

    if (password.length < 6) {
      setError("Mot de passe trop court (min 6 caractères)");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 🔐 CREATE AUTH USER
      const cred = await createUserWithEmailAndPassword(
        auth,
        invitation.email,
        password
      );

      const uid = cred.user.uid;

      // 🔥 CREATE USER FIRESTORE
      await setDoc(doc(db, "users", uid), {
        id: uid,
        email: invitation.email,
        role: invitation.role,
        restaurantId: invitation.restaurantId,
        active: true,
        createdAt: new Date()
      });

      // 🔥 MARK INVITATION USED
      await updateDoc(doc(db, "invitations", invitation.id), {
        status: "accepted",
        acceptedAt: new Date()
      });

      // 🔁 REDIRECT
      router.push(`/dashboard/${invitation.restaurantId}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ================= UI =================

  if (loading) {
    return (
      <div className="p-10 text-center">
        Chargement...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Créer votre compte</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          <p className="text-sm text-muted-foreground">
            Compte : <b>{invitation.email}</b>
          </p>

          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={submitting}
          >
            {submitting ? "Création..." : "Activer mon compte"}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
