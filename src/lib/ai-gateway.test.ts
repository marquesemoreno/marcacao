import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { aiChat, aiJev, __setAiClientForTests, __setFetchForTests } from "./ai-gateway";

type Captured = { messages: Array<{ role: string; content: unknown; tool_calls?: unknown }> };

function fakeClient(reply: { content?: string | null; toolArgs?: string }) {
  const calls: Captured[] = [];
  const client = {
    chat: {
      completions: {
        create: vi.fn(async (params: Captured) => {
          calls.push(JSON.parse(JSON.stringify(params)));
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: reply.content ?? null,
                  tool_calls: reply.toolArgs
                    ? [{ id: "t1", type: "function", function: { name: "f", arguments: reply.toolArgs } }]
                    : undefined,
                },
              },
            ],
          };
        }),
      },
    },
  };
  return { client, calls };
}

describe("aiChat — barreira LGPD", () => {
  let info: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    info.mockRestore();
    __setAiClientForTests(null);
  });

  it("o modelo nunca recebe nome, CPF ou telefone do paciente", async () => {
    const { client, calls } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "atendente", clinicId: "c1", knownNames: ["Otávio Brandão"] },
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você atende a clínica." },
          { role: "user", content: "Sou o Otávio Brandão, CPF 529.982.247-25, fone (77) 99100-0524" },
        ],
      },
    );
    const sent = JSON.stringify(calls[0].messages);
    expect(sent).not.toMatch(/Otávio|Brandão|529\.982|99100/);
    expect(sent).toContain("{{PATIENT_NAME_1}}");
  });

  it("avisa o modelo sobre os tokens quando houve mascaramento", async () => {
    const { client, calls } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "copiloto", knownNames: ["Ana Souza"] },
      { model: "m", messages: [{ role: "user", content: "Ana Souza quer marcar" }] },
    );
    const systemNotes = calls[0].messages.filter((m) => m.role === "system").map((m) => String(m.content));
    expect(systemNotes.some((c) => c.includes("PATIENT_"))).toBe(true);
  });

  it("restaura os dados reais na resposta de texto", async () => {
    const { client } = fakeClient({ content: "Olá {{PATIENT_NAME_1}}, confirmado!" });
    __setAiClientForTests(client);
    const res = await aiChat(
      { feature: "atendente", knownNames: ["Ana Souza"] },
      { model: "m", messages: [{ role: "user", content: "Aqui é Ana Souza" }] },
    );
    expect(res.choices[0].message.content).toBe("Olá Ana Souza, confirmado!");
  });

  it("restaura dentro dos argumentos de ferramenta sem quebrar o JSON", async () => {
    const { client } = fakeClient({ toolArgs: JSON.stringify({ paciente: "{{PATIENT_NAME_1}}", obs: "x" }) });
    __setAiClientForTests(client);
    const res = await aiChat(
      { feature: "copiloto-recepcao", knownNames: ['Ana "Nina" Souza'] },
      { model: "m", messages: [{ role: "user", content: 'cancelar Ana "Nina" Souza' }] },
    );
    const args = JSON.parse((res.choices[0].message.tool_calls![0] as { function: { arguments: string } }).function.arguments);
    expect(args.paciente).toBe('Ana "Nina" Souza');
  });

  it("mascara resultados de ferramenta e argumentos já enviados no histórico", async () => {
    const { client, calls } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "copiloto-recepcao" },
      {
        model: "m",
        messages: [
          { role: "user", content: "busca o 529.982.247-25" },
          {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "t1", type: "function", function: { name: "f", arguments: '{"cpf":"529.982.247-25"}' } }],
          },
          { role: "tool", tool_call_id: "t1", content: '{"paciente":"me chamo Carlos Lima"}' },
        ],
      },
    );
    const sent = JSON.stringify(calls[0].messages);
    expect(sent).not.toMatch(/529\.982|Carlos Lima/);
  });

  it("partes de texto são mascaradas; imagem passa e fica registrada como não mascarável", async () => {
    const { client, calls } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "documento" },
      {
        model: "m",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "CPF 529.982.247-25" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
            ],
          },
        ],
      },
    );
    expect(JSON.stringify(calls[0].messages)).not.toContain("529.982");
    const log = JSON.parse(String(info.mock.calls.at(-1)?.[0]));
    expect(log).toMatchObject({ event: "ai_call", feature: "documento", unmaskable: { image: 1 } });
  });

  it("registra a chamada só com contagens — nunca o conteúdo", async () => {
    const { client } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "atendente", clinicId: "c9", knownNames: ["Ana Souza"] },
      { model: "m", messages: [{ role: "user", content: "Ana Souza, CPF 529.982.247-25, dor nas costas" }] },
    );
    const raw = String(info.mock.calls.at(-1)?.[0]);
    expect(raw).not.toMatch(/Ana|529|dor/);
    expect(JSON.parse(raw)).toMatchObject({ event: "ai_call", feature: "atendente", clinicId: "c9", masked: { NAME: 1, CPF: 1 } });
  });

  it("termos preservados (nome da clínica) chegam intactos", async () => {
    const { client, calls } = fakeClient({ content: "ok" });
    __setAiClientForTests(client);
    await aiChat(
      { feature: "atendente", knownNames: ["Clara Mendes"], preserveTerms: ["Clínica Santa Clara"] },
      { model: "m", messages: [{ role: "system", content: "Você atende a Clínica Santa Clara." }] },
    );
    expect(JSON.stringify(calls[0].messages)).toContain("Clínica Santa Clara");
  });
});

describe("aiJev — barreira LGPD", () => {
  afterEach(() => __setFetchForTests(null));

  it("mascara os textos do estado antes de enviar ao Jev", async () => {
    const bodies: string[] = [];
    __setFetchForTests(async (_url, init) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ answers: { q: { type: "choice", choice: "CONFIRMED", confidence: 0.9 } } }));
    });
    process.env.JEVAI_API_KEY = "test";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const json = await aiJev(
      { feature: "lembrete", knownNames: ["Ana Souza"] },
      { model: "jev-latest", state: { resposta: "Ana Souza confirma, CPF 529.982.247-25" }, questions: { q: {} } },
    );
    info.mockRestore();
    expect(bodies[0]).not.toMatch(/Ana Souza|529\.982/);
    expect(json?.answers?.q?.choice).toBe("CONFIRMED");
  });
});
