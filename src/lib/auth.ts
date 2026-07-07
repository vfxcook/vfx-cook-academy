import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";

import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.EMAIL_FROM
) {
  providers.push(
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60,
    }),
  );
}

providers.push(
  CredentialsProvider({
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) {
        return null;
      }

      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
        try {
          const adminHash = await hashPassword(adminPassword);
          const adminUser = await prisma.user.upsert({
            where: { email: adminEmail },
            update: {
              role: "ADMIN",
              passwordHash: adminHash,
              name: "VFX Cook Admin",
            },
            create: {
              email: adminEmail,
              role: "ADMIN",
              passwordHash: adminHash,
              name: "VFX Cook Admin",
              phone: "9999999999",
            },
          });
          return {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            image: adminUser.image,
          };
        } catch (error) {
          console.error("Failed to upsert admin account from env credentials", error);
          return {
            id: `admin-env-${adminEmail}`,
            email: adminEmail,
            name: "VFX Cook Admin",
            image: null,
          };
        }
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });
      if (!user?.passwordHash) {
        return null;
      }
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as never),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      if (token.id && !String(token.id).startsWith("admin-env-")) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: String(token.id) },
            select: { phone: true, role: true },
          });
          token.phone = dbUser?.phone ?? null;
          token.role = dbUser?.role ?? "STUDENT";
        } catch (error) {
          console.error("Failed to load user role/phone from database", error);
        }
      } else if (
        token.email &&
        process.env.ADMIN_EMAIL &&
        String(token.email).toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase()
      ) {
        token.phone = token.phone ?? null;
        token.role = "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ? String(token.id) : "";
        session.user.phone = (token.phone as string | null | undefined) ?? null;
        session.user.role = (token.role as "STUDENT" | "ADMIN" | undefined) ?? "STUDENT";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Force a value update path on first user creation for onboarding tracking if needed later.
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: null },
      });
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function auth() {
  return getServerSession(authOptions);
}
