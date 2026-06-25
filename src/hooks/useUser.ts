import { useAuthContext } from "../context/AuthContext";
import type { User } from "../types/user";

export interface UseUserResult {
  user: User | null;
  loading: boolean;
}

export function useUser(): UseUserResult {
  const { user, loading } = useAuthContext();
  return { user, loading };
}
