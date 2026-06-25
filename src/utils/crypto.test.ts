import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "./crypto";

describe("crypto utils", () => {
  describe("generateCodeVerifier", () => {
    it("should generate a string", () => {
      const verifier = generateCodeVerifier();
      expect(typeof verifier).toBe("string");
      expect(verifier.length).toBeGreaterThan(0);
    });

    it("should generate a base64url-safe string", () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("should generate unique values each time", () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  describe("generateCodeChallenge", () => {
    it("should produce a deterministic challenge for a given verifier", async () => {
      const a = await generateCodeChallenge("test-verifier");
      const b = await generateCodeChallenge("test-verifier");
      expect(a).toBe(b);
    });

    it("should produce different challenges for different verifiers", async () => {
      const a = await generateCodeChallenge("verifier-a");
      const b = await generateCodeChallenge("verifier-b");
      expect(a).not.toBe(b);
    });

    it("should return a base64url-safe string", async () => {
      const challenge = await generateCodeChallenge("test-verifier");
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  describe("generateState", () => {
    it("should generate a string of expected length", () => {
      const state = generateState();
      expect(typeof state).toBe("string");
    });

    it("should generate unique values", () => {
      const a = generateState();
      const b = generateState();
      expect(a).not.toBe(b);
    });
  });
});
