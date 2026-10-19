import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/child-photo";

describe("fitWithin", () => {
  it("zmniejsza dłuższy bok do limitu z zachowaniem proporcji", () => {
    expect(fitWithin(4032, 3024, 512)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3024, 4032, 512)).toEqual({ width: 384, height: 512 });
  });

  it("nie powiększa małych zdjęć", () => {
    expect(fitWithin(200, 100, 512)).toEqual({ width: 200, height: 100 });
  });

  it("nie schodzi poniżej 1 px przy skrajnie wąskich obrazach", () => {
    expect(fitWithin(10000, 1, 512)).toEqual({ width: 512, height: 1 });
  });
});
