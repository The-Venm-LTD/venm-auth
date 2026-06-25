import { useAuthContext } from "../context/AuthContext";
import type { ProviderType, AuthError } from "../types/auth";

export interface UseLoginResult {
  login: (provider: ProviderType) => Promise<void>;
  loading: boolean;
  error: AuthError | null;
}

export function useLogin(): UseLoginResult {
  const { login, loading, error } = useAuthContext();
  return { login, loading, error };
}
