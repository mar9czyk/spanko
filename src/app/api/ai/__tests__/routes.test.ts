import { describe, expect, it } from "vitest";
import { POST as correctInsightPost } from "../correct-insight/route";
import { POST as evaluateInsightsPost } from "../evaluate-insights/route";

describe("AI Route Handlers", () => {
  describe("POST /api/ai/evaluate-insights", () => {
    it("zwraca 400 gdy brakuje parametru childId", async () => {
      const request = new Request("http://localhost/api/ai/evaluate-insights", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await evaluateInsightsPost(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain("childId");
    });

    it("generuje deterministyczny wniosek dla poprawnego identyfikatora dziecka", async () => {
      const request = new Request("http://localhost/api/ai/evaluate-insights", {
        method: "POST",
        body: JSON.stringify({ childId: "child_test_123" }),
      });

      const response = await evaluateInsightsPost(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.insight).toBeDefined();
      expect(json.insight.title).toBeDefined();
      expect(json.insight.explanation).toBeDefined();
    });
  });

  describe("POST /api/ai/correct-insight", () => {
    it("zwraca 400 gdy brakuje wymaganych pól", async () => {
      const request = new Request("http://localhost/api/ai/correct-insight", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await correctInsightPost(request);
      expect(response.status).toBe(400);
    });

    it("oznacza wniosek jako validated przy zatwierdzeniu przez rodzica", async () => {
      const request = new Request("http://localhost/api/ai/correct-insight", {
        method: "POST",
        body: JSON.stringify({
          insightId: "insight_abc",
          feedback: "accepted",
        }),
      });

      const response = await correctInsightPost(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.insight.status).toBe("validated");
      expect(json.insight.parent_feedback).toBe("accepted");
    });

    it("oznacza wniosek jako corrected_by_parent z notatką i nadpisaniem algorytmu", async () => {
      const request = new Request("http://localhost/api/ai/correct-insight", {
        method: "POST",
        body: JSON.stringify({
          insightId: "insight_xyz",
          feedback: "adjusted",
          parentCorrectionNote: "Wczoraj wiercił sąsiad",
          isAnomalyException: true,
          algorithmOverrideJson: { wwOffsetMin: 15 },
        }),
      });

      const response = await correctInsightPost(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.insight.status).toBe("corrected_by_parent");
      expect(json.insight.parent_feedback).toBe("adjusted");
      expect(json.insight.parent_correction_note).toBe("Wczoraj wiercił sąsiad");
      expect(json.insight.algorithm_override_json).toEqual({ wwOffsetMin: 15 });
    });
  });
});
