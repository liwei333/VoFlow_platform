import { describe, it, expect } from "vitest";
import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_NODE_DEFINITIONS,
  DEFAULT_WORKFLOW_TEMPLATE,
  getWorkflowNodeDefinition,
  isWorkflowNodeType,
  getDefaultWorkflowNodes,
  type WorkflowNodeDefinition,
} from "../src/lib/workflow/constants";

const EXPECTED_NODE_ORDER = [
  "reference_extract",
  "script_prepare",
  "script_rewrite",
  "legal_review",
  "voice_clone",
  "tts",
  "avatar_render",
  "editing_preview",
  "subtitle",
  "bgm_mix",
  "cover",
  "final_export",
  "publish",
];

describe("WORKFLOW_NODE_TYPES", () => {
  it("should have 13 nodes in correct order", () => {
    expect(WORKFLOW_NODE_TYPES).toEqual(EXPECTED_NODE_ORDER);
  });

  it("should have unique node types", () => {
    expect(new Set(WORKFLOW_NODE_TYPES).size).toBe(WORKFLOW_NODE_TYPES.length);
  });
});

describe("DEFAULT_WORKFLOW_TEMPLATE", () => {
  it("should match WORKFLOW_NODE_TYPES order", () => {
    expect(DEFAULT_WORKFLOW_TEMPLATE).toEqual(WORKFLOW_NODE_TYPES);
  });
});

describe("WORKFLOW_NODE_DEFINITIONS", () => {
  it("should define all node types", () => {
    expect(Object.keys(WORKFLOW_NODE_DEFINITIONS)).toEqual(WORKFLOW_NODE_TYPES);
  });

  it("should have complete definition for each node", () => {
    WORKFLOW_NODE_TYPES.forEach((type) => {
      const def = WORKFLOW_NODE_DEFINITIONS[type];
      expect(def.type).toBe(type);
      expect(typeof def.order).toBe("number");
      expect(typeof def.requiresApproval).toBe("boolean");
      expect(typeof def.retryable).toBe("boolean");
    });
  });

  it("should have orders from 1 to 13 consecutively", () => {
    const orders = WORKFLOW_NODE_TYPES.map((type) => WORKFLOW_NODE_DEFINITIONS[type].order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("should mark legal_review, voice_clone, editing_preview, publish as requiresApproval: true", () => {
    expect(WORKFLOW_NODE_DEFINITIONS.legal_review.requiresApproval).toBe(true);
    expect(WORKFLOW_NODE_DEFINITIONS.voice_clone.requiresApproval).toBe(true);
    expect(WORKFLOW_NODE_DEFINITIONS.editing_preview.requiresApproval).toBe(true);
    expect(WORKFLOW_NODE_DEFINITIONS.publish.requiresApproval).toBe(true);
  });

  it("should mark avatar_render as requiresApproval: false", () => {
    expect(WORKFLOW_NODE_DEFINITIONS.avatar_render.requiresApproval).toBe(false);
  });

  it("should mark publish as retryable: false", () => {
    expect(WORKFLOW_NODE_DEFINITIONS.publish.retryable).toBe(false);
  });

  it("should mark all other nodes as retryable: true", () => {
    WORKFLOW_NODE_TYPES.forEach((type) => {
      if (type !== "publish") {
        expect(WORKFLOW_NODE_DEFINITIONS[type].retryable).toBe(true);
      }
    });
  });
});

describe("isWorkflowNodeType", () => {
  it("should return true for valid node types", () => {
    expect(isWorkflowNodeType("tts")).toBe(true);
    expect(isWorkflowNodeType("legal_review")).toBe(true);
    expect(isWorkflowNodeType("publish")).toBe(true);
  });

  it("should return false for unknown values", () => {
    expect(isWorkflowNodeType("unknown")).toBe(false);
    expect(isWorkflowNodeType(null)).toBe(false);
    expect(isWorkflowNodeType(undefined)).toBe(false);
    expect(isWorkflowNodeType(123)).toBe(false);
    expect(isWorkflowNodeType({})).toBe(false);
  });
});

describe("getWorkflowNodeDefinition", () => {
  it("should return definition for valid node type", () => {
    const def = getWorkflowNodeDefinition("tts");
    expect(def).toBeDefined();
    expect(def?.type).toBe("tts");
    expect(def?.order).toBe(6);
  });

  it("should return undefined for unknown node type", () => {
    const def = getWorkflowNodeDefinition("unknown");
    expect(def).toBeUndefined();
  });
});

describe("getDefaultWorkflowNodes", () => {
  it("should return a new array each time", () => {
    const nodes1 = getDefaultWorkflowNodes();
    const nodes2 = getDefaultWorkflowNodes();
    expect(nodes1).not.toBe(nodes2);
  });

  it("should return new node objects to prevent pollution", () => {
    const nodes = getDefaultWorkflowNodes();
    const originalDef = WORKFLOW_NODE_DEFINITIONS.tts;
    
    nodes[5].order = 999;
    nodes[5].requiresApproval = true;
    
    expect(WORKFLOW_NODE_DEFINITIONS.tts.order).toBe(6);
    expect(WORKFLOW_NODE_DEFINITIONS.tts.requiresApproval).toBe(false);
  });

  it("should not pollute between calls", () => {
    const nodes1 = getDefaultWorkflowNodes();
    nodes1[0].order = 999;
    
    const nodes2 = getDefaultWorkflowNodes();
    expect(nodes2[0].order).toBe(1);
  });

  it("should return all 13 nodes in order", () => {
    const nodes = getDefaultWorkflowNodes();
    expect(nodes.length).toBe(13);
    nodes.forEach((node, index) => {
      expect(node.type).toBe(WORKFLOW_NODE_TYPES[index]);
      expect(node.order).toBe(index + 1);
    });
  });
});
