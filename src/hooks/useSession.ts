import { useAuthContext } from "../context/AuthContext";

export interface UseSessionResult {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  loading: boolean;
}

export function useSession(): UseSessionResult {
  const { session, loading } = useAuthContext();

  return {
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    expiresAt: session?.expiresAt ?? null,
    loading,
  };
}
