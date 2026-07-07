import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone?: string | null;
      role: "STUDENT" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    phone?: string | null;
    role?: "STUDENT" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    phone?: string | null;
    role?: "STUDENT" | "ADMIN";
  }
}
