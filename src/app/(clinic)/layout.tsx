export default function ClinicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r px-4 py-6">
        <span className="text-lg font-semibold">Painel da Clínica</span>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
