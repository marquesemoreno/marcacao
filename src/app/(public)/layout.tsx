export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <span className="text-lg font-semibold">Marcação</span>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
