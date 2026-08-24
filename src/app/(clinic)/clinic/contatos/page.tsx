import { ContactsApp } from "@/components/chat/contacts-app";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ClinicContatosPage() {
  return <ContactsApp scope="clinic" basePath="/clinic" />;
}
