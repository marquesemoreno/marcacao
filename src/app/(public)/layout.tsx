import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-lg font-semibold">
          Marcação
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
