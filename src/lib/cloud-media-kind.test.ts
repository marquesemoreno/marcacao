import { describe, expect, it } from "vitest";
import { cloudMediaKind } from "./cloud-media-kind";

describe("cloudMediaKind", () => {
  it("mapeia o tipo do arquivo para o tipo de mensagem da API oficial", () => {
    expect(cloudMediaKind("image/jpeg")).toBe("image");
    expect(cloudMediaKind("video/mp4")).toBe("video");
    expect(cloudMediaKind("audio/ogg; codecs=opus")).toBe("audio");
    expect(cloudMediaKind("application/pdf")).toBe("document");
    expect(cloudMediaKind("image/gif")).toBe("document");
  });
});
