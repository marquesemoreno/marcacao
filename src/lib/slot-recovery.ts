/** Vagas recuperadas (roteiro 4.2): ofertas automáticas da vaga (SlotOffer) + pacientes da
 * lista de espera encaixados pela recepção (WaitlistEntry BOOKED fora da oferta automática). */
export function summarizeSlotRecovery(
  offers: { status: string }[],
  waitlist: { waiting: number; bookedManually: number },
  ticket: number | null,
) {
  const filled = offers.filter((o) => o.status === "FILLED").length;
  const expired = offers.filter((o) => o.status === "EXPIRED").length;
  const open = offers.filter((o) => o.status === "OPEN").length;
  const decided = filled + expired;
  const recovered = filled + waitlist.bookedManually;
  return {
    offered: offers.length,
    filled,
    expired,
    open,
    fillRate: decided ? Math.round((filled / decided) * 100) : null,
    waiting: waitlist.waiting,
    bookedManually: waitlist.bookedManually,
    recovered,
    recoveredRevenue: ticket && recovered ? recovered * ticket : null,
  };
}
