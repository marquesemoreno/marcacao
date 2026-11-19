import { describe, expect, it } from "vitest";
import {
  INSTAGRAM_SCOPES,
  buildInstagramAuthorizeUrl,
  cleanAuthCode,
  parseShortTokenResponse,
  signOAuthState,
  verifyOAuthState,
} from "./instagram-oauth";

const SECRET = "segredo-de-teste";
const payload = { clinicId: "c1", userId: "u1", nonce: "n1", issuedAt: 1_000_000 };

describe("buildInstagramAuthorizeUrl", () => {
  it("monta o login comercial do Instagram com as duas permissões e o state", () => {
    const url = new URL(buildInstagramAuthorizeUrl({ appId: "123", redirectUri: "https://x.com/api/instagram/callback", state: "abc" }));
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.com/api/instagram/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(INSTAGRAM_SCOPES.join(","));
    expect(url.searchParams.get("state")).toBe("abc");
    expect(INSTAGRAM_SCOPES).toEqual(["instagram_business_basic", "instagram_business_manage_messages"]);
  });
});

describe("state assinado", () => {
  it("volta o mesmo conteúdo dentro do prazo", () => {
    const state = signOAuthState(payload, SECRET);
    expect(verifyOAuthState(state, SECRET, payload.issuedAt + 60_000)).toEqual(payload);
  });

  it("recusa assinatura com outro segredo, conteúdo alterado ou lixo", () => {
    const state = signOAuthState(payload, SECRET);
    expect(verifyOAuthState(state, "outro", payload.issuedAt)).toBeNull();
    const [body, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, clinicId: "c2" })).toString("base64url");
    expect(verifyOAuthState(`${forged}.${sig}`, SECRET, payload.issuedAt)).toBeNull();
    expect(verifyOAuthState(`${body}`, SECRET, payload.issuedAt)).toBeNull();
    expect(verifyOAuthState("", SECRET, payload.issuedAt)).toBeNull();
    expect(verifyOAuthState(null, SECRET, payload.issuedAt)).toBeNull();
  });

  it("vence depois de 15 minutos", () => {
    const state = signOAuthState(payload, SECRET);
    expect(verifyOAuthState(state, SECRET, payload.issuedAt + 15 * 60_000 + 1)).toBeNull();
  });
});

describe("cleanAuthCode", () => {
  it("tira o #_ que o Instagram põe no fim do código", () => {
    expect(cleanAuthCode("AQBx123#_")).toBe("AQBx123");
    expect(cleanAuthCode("AQBx123")).toBe("AQBx123");
    expect(cleanAuthCode(null)).toBe("");
  });
});

describe("parseShortTokenResponse", () => {
  it("lê o formato atual e o antigo (data[0])", () => {
    expect(parseShortTokenResponse({ access_token: "t", user_id: 99, permissions: "instagram_business_basic,instagram_business_manage_messages" })).toEqual({
      accessToken: "t",
      userId: "99",
      permissions: ["instagram_business_basic", "instagram_business_manage_messages"],
    });
    expect(parseShortTokenResponse({ data: [{ access_token: "t", user_id: "99", permissions: ["instagram_business_basic"] }] })).toEqual({
      accessToken: "t",
      userId: "99",
      permissions: ["instagram_business_basic"],
    });
  });

  it("devolve null sem token", () => {
    expect(parseShortTokenResponse({ error_message: "invalid code" })).toBeNull();
    expect(parseShortTokenResponse(null)).toBeNull();
  });
});
