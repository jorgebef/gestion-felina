import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  openInvitationToken,
  sealInvitationToken,
  withInvitationUrl,
} from "@felina/core/invitation-links";

const TOKEN = "fJ3x_invitation-token-0123456789abcdefghijk";
const originalSecret = process.env.BETTER_AUTH_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = originalSecret;
});

describe("invitation links", () => {
  it("stores the token encrypted and recovers it", () => {
    const sealed = sealInvitationToken(TOKEN);
    expect(sealed).not.toContain(TOKEN);
    expect(sealed).not.toBe(sealInvitationToken(TOKEN)); // random IV
    expect(openInvitationToken(sealed)).toBe(TOKEN);
  });

  it("gives no token for missing, tampered or foreign ciphertexts", () => {
    process.env.BETTER_AUTH_SECRET = "first-secret";
    const sealed = sealInvitationToken(TOKEN);
    const [version, iv, data, tag] = sealed.split(".");
    const flipped = `${data![0] === "A" ? "B" : "A"}${data!.slice(1)}`;

    expect(openInvitationToken(null)).toBeNull();
    expect(openInvitationToken("not-a-sealed-token")).toBeNull();
    expect(openInvitationToken([version, iv, flipped, tag].join("."))).toBeNull();
    process.env.BETTER_AUTH_SECRET = "rotated-secret";
    expect(openInvitationToken(sealed)).toBeNull();
  });

  it("turns a listed invitation's ciphertext into its link", () => {
    const row = { id: "1", email: "a@example.test", tokenCiphertext: sealInvitationToken(TOKEN) };
    expect(withInvitationUrl(row)).toEqual({
      id: "1",
      email: "a@example.test",
      url: `http://localhost:3000/invitacion/${TOKEN}`,
    });
    expect(withInvitationUrl({ id: "2", tokenCiphertext: null })).toEqual({ id: "2", url: null });
  });
});
