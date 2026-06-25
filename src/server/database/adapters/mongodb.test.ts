// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMongoDBAdapter } from "./mongodb";
import type { CreateUserData, CreateSessionData } from "../adapter";

// ── Mock MongoDB ────────────────────────────────────────────────────

const mockInsertOne = vi.fn();
const mockFindOne = vi.fn();
const mockFind = vi.fn();
const mockDeleteOne = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindOneAndUpdate = vi.fn();
const mockCreateIndex = vi.fn();
const mockToArray = vi.fn();
const mockCollection = vi.fn();
const mockDb = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn();

vi.mock("mongodb", () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    db: vi.fn().mockReturnValue({
      collection: mockCollection.mockReturnValue({
        insertOne: mockInsertOne,
        findOne: mockFindOne,
        find: mockFind.mockReturnValue({ toArray: mockToArray, sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis() }),
        deleteOne: mockDeleteOne,
        deleteMany: mockDeleteMany,
        findOneAndUpdate: mockFindOneAndUpdate,
        createIndex: mockCreateIndex,
      }),
    }),
  })),
  type: {
    Collection: class {},
    Filter: class {},
    Document: class {},
  },
}));

// ── Test Data ───────────────────────────────────────────────────────

const createUserData: CreateUserData = {
  id: "google_user123",
  email: "test@example.com",
  name: "Test User",
  picture: "https://example.com/pic.jpg",
  provider: "google",
  emailVerified: true,
  providerAccountId: "12345",
};

const createSessionData: CreateSessionData = {
  userId: "google_user123",
  accessToken: "at-mock-token",
  refreshToken: "rt-mock-token",
  expiresAt: Date.now() + 15 * 60 * 1000,
};

const mockUserDoc = {
  _id: "mongo-id-1",
  ...createUserData,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockSessionDoc = {
  _id: "mongo-id-2",
  id: "session-uuid",
  userId: createSessionData.userId,
  accessToken: createSessionData.accessToken,
  refreshToken: createSessionData.refreshToken,
  expiresAt: createSessionData.expiresAt,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// ── Tests ───────────────────────────────────────────────────────────

describe("MongoDB Adapter", () => {
  let adapter: ReturnType<typeof createMongoDBAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockInsertOne.mockResolvedValue({ insertedId: "mongo-id-1" });
    mockFindOne.mockResolvedValue(mockUserDoc);
    mockFindOneAndUpdate.mockResolvedValue(mockUserDoc);
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockDeleteMany.mockResolvedValue({ deletedCount: 2 });
    mockToArray.mockResolvedValue([mockUserDoc]);
    mockCreateIndex.mockResolvedValue("index-created");

    adapter = createMongoDBAdapter({ uri: "mongodb://localhost:27017/test" });
  });

  describe("User Operations", () => {
    it("should create a user", async () => {
      const user = await adapter.createUser(createUserData);

      expect(mockConnect).toHaveBeenCalled();
      expect(user.id).toBe("google_user123");
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.emailVerified).toBe(true);
    });

    it("should find a user by email", async () => {
      mockFindOne.mockResolvedValue(mockUserDoc);

      const user = await adapter.findUserByEmail("test@example.com");
      expect(user).not.toBeNull();
      expect(user!.id).toBe("google_user123");
      expect(user!.email).toBe("test@example.com");
    });

    it("should return null when user not found by email", async () => {
      mockFindOne.mockResolvedValue(null);

      const user = await adapter.findUserByEmail("nonexistent@example.com");
      expect(user).toBeNull();
    });

    it("should find a user by provider", async () => {
      mockFindOne.mockResolvedValue(mockUserDoc);

      const user = await adapter.findUserByProvider("google", "12345");
      expect(user).not.toBeNull();
      expect(user!.id).toBe("google_user123");
      expect(user!.email).toBe("test@example.com");
      expect(user!.provider).toBe("google");
    });

    it("should find a user by ID", async () => {
      mockFindOne.mockResolvedValue(mockUserDoc);

      const user = await adapter.findUserById("google_user123");
      expect(user).not.toBeNull();
      expect(user!.id).toBe("google_user123");
    });

    it("should update a user", async () => {
      const updatedDoc = { ...mockUserDoc, name: "Updated Name" };
      mockFindOneAndUpdate.mockResolvedValue(updatedDoc);

      const user = await adapter.updateUser("google_user123", {
        name: "Updated Name",
      });
      expect(user).not.toBeNull();
      expect(user!.name).toBe("Updated Name");
    });

    it("should delete a user", async () => {
      const result = await adapter.deleteUser("google_user123");
      expect(result).toBe(true);
      expect(mockDeleteOne).toHaveBeenCalled();
    });

    it("should return false when deleting non-existent user", async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await adapter.deleteUser("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("Session Operations", () => {
    beforeEach(() => {
      mockFindOne.mockResolvedValue(mockSessionDoc);
    });

    it("should create a session", async () => {
      const session = await adapter.createSession(createSessionData);

      expect(session).not.toBeNull();
      expect(session!.userId).toBe("google_user123");
      expect(session!.accessToken).toBe("at-mock-token");
      expect(session!.refreshToken).toBe("rt-mock-token");
    });

    it("should find a session by access token", async () => {
      mockFindOne.mockResolvedValue(mockSessionDoc);

      const session = await adapter.findSessionByToken("at-mock-token");
      expect(session).not.toBeNull();
      expect(session!.accessToken).toBe("at-mock-token");
    });

    it("should find a session by refresh token", async () => {
      mockFindOne.mockResolvedValue(mockSessionDoc);

      const session = await adapter.findSessionByToken("rt-mock-token");
      expect(session).not.toBeNull();
      expect(session!.refreshToken).toBe("rt-mock-token");
    });

    it("should find sessions by user ID", async () => {
      mockToArray.mockResolvedValue([mockSessionDoc]);

      const sessions = await adapter.findSessionsByUserId("google_user123");
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.userId).toBe("google_user123");
    });

    it("should delete a session by token", async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await adapter.deleteSession("at-mock-token");
      expect(result).toBe(true);
    });

    it("should delete all user sessions", async () => {
      const count = await adapter.deleteAllUserSessions("google_user123");
      expect(count).toBe(2);
    });

    it("should update a session", async () => {
      const updatedDoc = { ...mockSessionDoc, accessToken: "new-at-token" };
      mockFindOneAndUpdate.mockResolvedValue(updatedDoc);

      const session = await adapter.updateSession("at-mock-token", {
        accessToken: "new-at-token",
      });
      expect(session).not.toBeNull();
      expect(session!.accessToken).toBe("new-at-token");
    });
  });
});
