import { useAuthContext } from "../context/AuthContext";
import type { AuthContextValue } from "../types/auth";

export function useAuth(): AuthContextValue {
  return useAuthContext();
}
