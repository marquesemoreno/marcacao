import type { UserRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: UserRole;
    clinicId: string | null;
    /** Função Médico: só para o middleware mandar pra /clinic/medico (a regra vale no servidor). */
    isDoctor?: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: UserRole;
      clinicId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    clinicId: string | null;
    isDoctor?: boolean;
  }
}
