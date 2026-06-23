/**
 * Workflow node type definitions for voflow-workflow-engine.
 *
 * Optional adapter nodes can feed the MVP pipeline without being part of the
 * default full-video template.
 *
 * Default node order follows the MVP pipeline sequence:
 * 1. reference_extract  - extract reference materials
 * 2. script_prepare     - prepare initial script
 * 3. script_rewrite     - rewrite/polish script
 * 4. script_title       - generate title candidates
 * 5. legal_review       - legal/compliance review (requires approval)
 * 6. voice_clone        - clone voice model (requires approval)
 * 7. tts                - text-to-speech generation
 * 8. avatar_render      - render avatar video
 * 9. editing_preview    - initial editing/preview (requires approval)
 * 10. subtitle          - add subtitles
 * 11. bgm_mix           - mix background music
 * 12. cover             - generate cover image
 * 13. final_export      - final export
 * 14. publish           - publish (requires approval, not retryable)
 *
 * Sources: .kiro/specs/voflow-workflow-engine/design.md and voflow-script-ai title generation task
 */

export const WORKFLOW_NODE_TYPES = [
  "reference_url_import",
  "reference_extract",
  "script_prepare",
  "script_rewrite",
  "script_title",
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
] as const;

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT = 1;

export interface WorkflowNodeDefinition {
  type: WorkflowNodeType;
  order: number;
  requiresApproval: boolean;
  retryable: boolean;
  progressWeight: number;
}

export const WORKFLOW_NODE_DEFINITIONS: Record<WorkflowNodeType, WorkflowNodeDefinition> = {
  reference_url_import: {
    type: "reference_url_import",
    order: 0,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  reference_extract: {
    type: "reference_extract",
    order: 1,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  script_prepare: {
    type: "script_prepare",
    order: 2,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  script_rewrite: {
    type: "script_rewrite",
    order: 3,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  script_title: {
    type: "script_title",
    order: 4,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  legal_review: {
    type: "legal_review",
    order: 5,
    requiresApproval: true,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  voice_clone: {
    type: "voice_clone",
    order: 6,
    requiresApproval: true,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  tts: {
    type: "tts",
    order: 7,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  avatar_render: {
    type: "avatar_render",
    order: 8,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  editing_preview: {
    type: "editing_preview",
    order: 9,
    requiresApproval: true,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  subtitle: {
    type: "subtitle",
    order: 10,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  bgm_mix: {
    type: "bgm_mix",
    order: 11,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  cover: {
    type: "cover",
    order: 12,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  final_export: {
    type: "final_export",
    order: 13,
    requiresApproval: false,
    retryable: true,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
  publish: {
    type: "publish",
    order: 14,
    requiresApproval: true,
    retryable: false,
    progressWeight: DEFAULT_WORKFLOW_NODE_PROGRESS_WEIGHT,
  },
} as const;

export const DEFAULT_WORKFLOW_TEMPLATE: readonly WorkflowNodeType[] = Object.freeze([
  "reference_extract",
  "script_prepare",
  "script_rewrite",
  "script_title",
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
]);

/**
 * Get the definition for a given node type.
 * Returns undefined if the node type is unknown.
 */
export function getWorkflowNodeDefinition(
  nodeType: string
): WorkflowNodeDefinition | undefined {
  return WORKFLOW_NODE_DEFINITIONS[nodeType as WorkflowNodeType];
}

/**
 * Type guard to check if a value is a valid WorkflowNodeType.
 */
export function isWorkflowNodeType(value: unknown): value is WorkflowNodeType {
  return (
    typeof value === "string" &&
    (WORKFLOW_NODE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Get all default workflow nodes in execution order.
 * Returns a new array with cloned node objects to prevent pollution of the global template.
 */
export function getDefaultWorkflowNodes(): WorkflowNodeDefinition[] {
  return DEFAULT_WORKFLOW_TEMPLATE.map((nodeType) => ({
    ...WORKFLOW_NODE_DEFINITIONS[nodeType],
  }));
}
