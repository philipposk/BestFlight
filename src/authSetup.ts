// Auth helpers. Guest browsing is allowed; auth required only for price-watch + booking.

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function getIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  return u ? await u.getIdToken() : null;
}
