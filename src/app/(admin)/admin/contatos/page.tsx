import { Suspense } from "react";
import { ContactsApp } from "@/components/chat/contacts-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminContatosPage() {
  return <Suspense fallback={null}>
      <ContactsApp scope="admin" basePath="/admin" />
    </Suspense>;
}
