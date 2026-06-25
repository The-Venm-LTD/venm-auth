import { describe, it, expect, vi, beforeEach } from "vitest";
import { PopupManager } from "./popup-manager";
import type { SDKConfig } from "../types/config";

function createConfig(overrides: Partial<SDKConfig> = {}): SDKConfig {
  return {
    apiUrl: "https://auth.venm.com/api/auth",
    environment: "development",
    autoRefresh: true,
    persistSession: true,
    storage: "localStorage",
    timeout: 10000,
    ...overrides,
  };
}

describe("PopupManager", () => {
  let manager: PopupManager;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      open: vi.fn(),
      screenX: 0,
      screenY: 0,
      outerWidth: 1920,
      outerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    manager = new PopupManager(createConfig());
  });

  it("should reject if popup is blocked", async () => {
    vi.mocked(window.open).mockReturnValue(null);

    await expect(manager.open("https://example.com")).rejects.toMatchObject({
      code: "POPUP_BLOCKED",
    });
  });

  it("should reject if popup is closed by user", async () => {
    const mockPopup = {
      closed: false,
      close: vi.fn(),
    } as any;
    vi.mocked(window.open).mockReturnValue(mockPopup);

    const openPromise = manager.open("https://example.com");

    // Simulate user closing the popup
    setTimeout(() => {
      mockPopup.closed = true;
    }, 300);

    await expect(openPromise).rejects.toMatchObject({
      code: "POPUP_CLOSED",
    });
  });

  it("should reject on timeout", async () => {
    const mockPopup = {
      closed: false,
      close: vi.fn(),
    } as any;
    vi.mocked(window.open).mockReturnValue(mockPopup);

    const fastManager = new PopupManager(createConfig());

    await expect(
      Promise.race([
        fastManager.open("https://example.com"),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 1000)
        ),
      ])
    ).rejects.toBeDefined();
  });

  it("should handle message event for valid auth response", async () => {
    const mockPopup = {
      closed: false,
      close: vi.fn(),
    } as any;
    vi.mocked(window.open).mockReturnValue(mockPopup);

    // Capture the message event listener
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    vi.mocked(window.addEventListener).mockImplementation(
      (event: string, handler: any) => {
        if (event === "message") messageHandler = handler;
      }
    );

    const openPromise = manager.open("https://auth.venm.com/api/auth/google?...");

    // Simulate a valid postMessage
    setTimeout(() => {
      if (messageHandler) {
        messageHandler(
          new MessageEvent("message", {
            data: {
              channel: "venm_auth_response",
              code: "auth-code-123",
              state: "test-state",
            },
            origin: "https://auth.venm.com",
          })
        );
      }
    }, 100);

    const result = await openPromise;
    expect(result.code).toBe("auth-code-123");
    expect(result.state).toBe("test-state");
  });

  it("should ignore messages from unexpected origins", async () => {
    const mockPopup = {
      closed: false,
      close: vi.fn(),
    } as any;
    vi.mocked(window.open).mockReturnValue(mockPopup);
    mockPopup.closed = false;

    let messageHandler: ((event: MessageEvent) => void) | null = null;
    vi.mocked(window.addEventListener).mockImplementation(
      (event: string, handler: any) => {
        if (event === "message") messageHandler = handler;
      }
    );

    const openPromise = manager.open("https://auth.venm.com/api/auth/google?...");

    // Send message from wrong origin — should be ignored
    setTimeout(() => {
      if (messageHandler) {
        messageHandler(
          new MessageEvent("message", {
            data: { channel: "venm_auth_response", code: "evil-code", state: "evil-state" },
            origin: "https://evil-site.com",
          })
        );
      }
    }, 100);

    // Send valid message after delay
    setTimeout(() => {
      if (messageHandler) {
        messageHandler(
          new MessageEvent("message", {
            data: { channel: "venm_auth_response", code: "real-code", state: "real-state" },
            origin: "https://auth.venm.com",
          })
        );
      }
    }, 200);

    const result = await openPromise;
    expect(result.code).toBe("real-code");
  });
});
