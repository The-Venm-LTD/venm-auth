import { useAuthContext } from "../context/AuthContext";

export interface UseLogoutResult {
  logout: () => Promise<void>;
  loading: boolean;
}

export function useLogout(): UseLogoutResult {
  const { logout, loading } = useAuthContext();
  return { logout, loading };
}
