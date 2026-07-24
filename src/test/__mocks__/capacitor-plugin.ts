/**
 * Mock implementation of capacitor-native-google-one-tap-signin for tests.
 *
 * This file is aliased in vitest.config.ts so that the dynamic import
 * in useGoogleOneTap resolves to this mock instead of trying to fetch
 * the real (uninstalled) package.
 */

import { vi } from "vitest";

export const GoogleOneTapAuth = {
  initialize: vi.fn().mockResolvedValue(undefined),
  tryAutoOrOneTapSignIn: vi.fn().mockResolvedValue({ isSuccess: false }),
  tryAutoOrOneTapSignInWithCallback: vi.fn().mockImplementation(
    (cb: (result: { isSuccess: boolean }) => void) => {
      cb({ isSuccess: false });
    }
  ),
  tryAutoSignIn: vi.fn().mockResolvedValue({ isSuccess: false }),
  tryOneTapSignIn: vi.fn().mockResolvedValue({ isSuccess: false }),
  signInWithGoogleButtonFlowForNative: vi
    .fn()
    .mockResolvedValue({ isSuccess: false }),
  addSignInActionToExistingButtonWithCallback: vi.fn().mockResolvedValue(
    undefined
  ),
  renderSignInButtonWithCallback: vi.fn().mockResolvedValue(undefined),
  cancelOneTapDialog: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};
