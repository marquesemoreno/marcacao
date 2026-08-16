import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireClinicSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLINIC" || !session.user.clinicId) {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id, clinicId: session.user.clinicId };
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Não autorizado");
  }
  return { userId: session.user.id };
}
