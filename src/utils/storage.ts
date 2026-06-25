import type { Session } from "../types/session";
import type { User } from "../types/user";
import {
  STORAGE_KEY_SESSION,
  STORAGE_KEY_USER,
} from "../constants";

export interface StorageInterface {
  getSession(): Session | null;
  setSession(session: Session): void;
  clearSession(): void;
  getUser(): User | null;
  setUser(user: User): void;
  clearUser(): void;
  clear(): void;
}

function getStorage(type: "localStorage" | "sessionStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = type === "localStorage" ? localStorage : sessionStorage;
    // Test that storage is accessible (not blocked by private browsing)
    const key = "__venm_storage_test__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return storage;
  } catch {
    return null;
  }
}

export function createStorage(
  type: "localStorage" | "sessionStorage" = "localStorage"
): StorageInterface {
  const storage = getStorage(type);

  function safeGetItem<T>(key: string): T | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function safeSetItem(key: string, value: unknown): void {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — silently fail
    }
  }

  function safeRemoveItem(key: string): void {
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      // Silently fail
    }
  }

  return {
    getSession(): Session | null {
      return safeGetItem<Session>(STORAGE_KEY_SESSION);
    },

    setSession(session: Session): void {
      safeSetItem(STORAGE_KEY_SESSION, session);
    },

    clearSession(): void {
      safeRemoveItem(STORAGE_KEY_SESSION);
    },

    getUser(): User | null {
      return safeGetItem<User>(STORAGE_KEY_USER);
    },

    setUser(user: User): void {
      safeSetItem(STORAGE_KEY_USER, user);
    },

    clearUser(): void {
      safeRemoveItem(STORAGE_KEY_USER);
    },

    clear(): void {
      safeRemoveItem(STORAGE_KEY_SESSION);
      safeRemoveItem(STORAGE_KEY_USER);
    },
  };
}
