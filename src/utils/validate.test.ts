import { describe, it, expect } from "vitest";
import { validateConfig, ConfigError, validateProvider } from "./validate";

describe("validate utils", () => {
  describe("validateConfig", () => {
    it("should accept a valid minimal production config", () => {
      const config = validateConfig({ environment: "production" });
      expect(config.apiUrl).toBe("/api/auth");
      expect(config.environment).toBe("production");
      expect(config.autoRefresh).toBe(true);
      expect(config.persistSession).toBe(true);
      expect(config.storage).toBe("localStorage");
      expect(config.timeout).toBe(10000);
    });

    it("should throw if environment is invalid", () => {
      expect(() =>
        validateConfig({
          environment: "staging" as any,
        })
      ).toThrow(ConfigError);
    });

    it("should throw if apiUrl is invalid", () => {
      expect(() =>
        validateConfig({ environment: "development", apiUrl: "not-a-url" })
      ).toThrow(ConfigError);
    });

    it("should default apiUrl to localhost:3000/api/auth in development mode", () => {
      const config = validateConfig({
        environment: "development",
      });
      expect(config.apiUrl).toBe("http://localhost:3000/api/auth");
      expect(config.environment).toBe("development");
    });

    it("should default apiUrl to /api/auth in production mode", () => {
      const config = validateConfig({
        environment: "production",
      });
      expect(config.apiUrl).toBe("/api/auth");
    });

    it("should accept an explicit config with all fields", () => {
      const config = validateConfig({
        apiUrl: "https://myapp.com/api/auth",
        environment: "production",
        autoRefresh: false,
        persistSession: false,
        storage: "sessionStorage",
        timeout: 5000,
      });
      expect(config.apiUrl).toBe("https://myapp.com/api/auth");
      expect(config.environment).toBe("production");
      expect(config.autoRefresh).toBe(false);
      expect(config.persistSession).toBe(false);
      expect(config.storage).toBe("sessionStorage");
      expect(config.timeout).toBe(5000);
    });
  });

  describe("validateProvider", () => {
    it("should not throw for valid providers", () => {
      expect(() => validateProvider("google")).not.toThrow();
      expect(() => validateProvider("facebook")).not.toThrow();
    });

    it("should throw for invalid providers", () => {
      expect(() => validateProvider("github")).toThrow(ConfigError);
      expect(() => validateProvider("twitter")).toThrow(ConfigError);
    });
  });
});
