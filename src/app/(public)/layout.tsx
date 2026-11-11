import { Navbar } from "@/components/public/navbar";
import { SiteFooter } from "@/components/public/landing/site-footer";
import { AIAssistantWidget } from "@/components/public/ai-assistant-widget";
import { isPublicChatEnabled } from "@/lib/public-features";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {isPublicChatEnabled() && <AIAssistantWidget />}
    </div>
  );
}
