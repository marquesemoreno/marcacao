/** Variáveis do modelo de lembrete D-1 na API oficial: {{1}} nome, {{2}} data,
 * {{3}} horário, {{4}} médico (ou procedimento). A Meta recusa variável vazia. */
export function reminderTemplateParams(input: {
  patientName: string;
  dateFormatted: string;
  time?: string | null;
  doctorName?: string | null;
  procedureName?: string | null;
}): string[] {
  return [
    input.patientName.trim() || "Paciente",
    input.dateFormatted,
    input.time?.trim() || "horário marcado",
    input.doctorName?.trim() || input.procedureName?.trim() || "a clínica",
  ];
}
