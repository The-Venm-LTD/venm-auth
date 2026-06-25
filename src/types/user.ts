export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: "google" | "facebook" | "email";
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
