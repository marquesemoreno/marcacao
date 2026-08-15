import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const servicos = [
  {
    titulo: "Consultas Médicas",
    descricao: "Agende consultas com especialistas de diversas áreas.",
  },
  {
    titulo: "Exames Laboratoriais",
    descricao: "Marque exames de sangue, urina e outros testes de laboratório.",
  },
  {
    titulo: "Exames de Imagem",
    descricao: "Agende raio-x, ultrassonografia, ressonância e tomografia.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Agende sua consulta ou exame
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Marcação rápida e simples de consultas e exames com as melhores clínicas.
        </p>
        <Button className="mt-6" size="lg">
          Agendar agora
        </Button>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {servicos.map((servico) => (
          <Card key={servico.titulo}>
            <CardHeader>
              <CardTitle>{servico.titulo}</CardTitle>
              <CardDescription>{servico.descricao}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </main>
  );
}
