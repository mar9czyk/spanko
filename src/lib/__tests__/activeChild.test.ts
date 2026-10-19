import { describe, expect, it } from "vitest";
import { pickActiveChild } from "@/lib/active-child";

const children = [{ id: "older" }, { id: "younger" }];

describe("pickActiveChild", () => {
  it("zwraca zapamiętane dziecko", () => {
    expect(pickActiveChild(children, "younger")?.id).toBe("younger");
  });

  it("wraca do najstarszego, gdy nic nie zapamiętano lub dziecka już nie ma", () => {
    expect(pickActiveChild(children, null)?.id).toBe("older");
    expect(pickActiveChild(children, "removed")?.id).toBe("older");
  });

  it("zwraca null dla gospodarstwa bez dzieci", () => {
    expect(pickActiveChild([], "younger")).toBeNull();
  });
});
