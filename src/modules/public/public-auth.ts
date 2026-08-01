import {
  signInAnonymously,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth"

type AnonymousSignIn = (auth: Auth) => Promise<UserCredential>

const pendingAnonymousSignIns = new WeakMap<Auth, Promise<User>>()

export function ensurePublicFirebaseUser(
  auth: Auth,
  anonymousSignIn: AnonymousSignIn = signInAnonymously
): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)

  const pending = pendingAnonymousSignIns.get(auth)
  if (pending) return pending

  const signIn = anonymousSignIn(auth)
    .then((credential) => credential.user)
    .finally(() => {
      pendingAnonymousSignIns.delete(auth)
    })

  pendingAnonymousSignIns.set(auth, signIn)
  return signIn
}
