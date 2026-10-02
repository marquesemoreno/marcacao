import { Suspense } from "react";
import { ContactsApp } from "@/components/chat/contacts-app";

export const metadata = { title: "Contatos" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClinicContatosPage() {
  return <Suspense fallback={null}>
      <ContactsApp scope="clinic" basePath="/clinic" />
    </Suspense>;
}
