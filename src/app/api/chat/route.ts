import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppLink } from "@/lib/format";

type ChatRequestBody = {
  message: string;
};

export async function POST(request: Request) {
  try {
    const body: ChatRequestBody = await request.json();
    const userMessage = body.message?.trim() || "";

    if (!userMessage) {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    }

    const searchTerms = userMessage.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    // Search clinic procedures in database matching user terms
    const matchedProcedures = await prisma.clinicProcedure.findMany({
      where: {
        clinic: { active: true },
        OR: searchTerms.map((term) => ({
          OR: [
            { procedure: { name: { contains: term, mode: "insensitive" } } },
            { procedure: { specialty: { name: { contains: term, mode: "insensitive" } } } },
            { clinic: { tradeName: { contains: term, mode: "insensitive" } } },
            { procedure: { description: { contains: term, mode: "insensitive" } } },
          ],
        })),
      },
      include: {
        clinic: true,
        procedure: { include: { specialty: true } },
      },
      take: 3,
    });

    // If no direct matches found, get top popular procedures
    const fallbackProcedures = matchedProcedures.length > 0 ? matchedProcedures : await prisma.clinicProcedure.findMany({
      where: { clinic: { active: true } },
      include: { clinic: true, procedure: { include: { specialty: true } } },
      take: 3,
    });

    const primaryMatch = fallbackProcedures[0];
    const clinic = primaryMatch.clinic;
    const procedure = primaryMatch.procedure;

    const prepInstruction = procedure.preparationInstructions
      ? `\n\n📌 **Orientação de Preparo:** ${procedure.preparationInstructions}`
      : "";

    const responseText = `Olá! Que bom ter você aqui! 🩺

Para **${procedure.name}** (${procedure.specialty?.name || "Especialidade Médica"}), recomendo muito a nossa clínica credenciada **${clinic.tradeName}**, localizada no bairro **${clinic.neighborhood}** em **${clinic.city}**.

💡 **Atendimento Particular:** Oferecemos agendamento ágil com **valores acessíveis sob consulta**, direto no balcão e **sem mensalidades ou carência**.${prepInstruction}

Posso te ajudar a agendar o melhor horário diretamente com a recepção da clínica?`;

    const defaultPhone = clinic.phone || "77999999999";
    const waText = `Olá! Falei com a equipe de atendimento da Conecta Saúde e gostaria de consultar horários e agendar ${procedure.name} na ${clinic.tradeName}.`;
    const whatsappUrl = buildWhatsAppLink(defaultPhone, waText);

    return NextResponse.json({
      reply: responseText,
      recommendation: {
        procedureName: procedure.name,
        clinicName: clinic.tradeName,
        neighborhood: clinic.neighborhood,
        city: clinic.city,
        phone: clinic.phone,
        preparation: procedure.preparationInstructions,
        whatsappUrl,
      },
    });
  } catch (error) {
    console.error("Erro na API de Chat:", error);
    return NextResponse.json(
      { error: "Erro ao processar mensagem da equipe" },
      { status: 500 }
    );
  }
}
