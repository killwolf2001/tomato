import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function logout() {
  return signOut(auth);
}
