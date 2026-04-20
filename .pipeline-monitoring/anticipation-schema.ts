/**
 * Anticipation Schema — Structured prediction model for pipeline state transitions.
 *
 * Defines the shape of anticipation signals: predictions about future pipeline states,
 * gate progression, and failure patterns. Used by monitoring systems to surface
 * early warnings and adaptive scheduling decisions.
 *
 * Reference: GRID agentic AnticipationEngine pattern (src/grid/agentic/anticipation_engine.py)
 */

// ── Core Anticipation Types ────────────────────────────────────────────────────────

/**
 * Confidence level for an anticipation signal.
 */
export type AnticipationConfidence = "high" | "medium" | "low" | "unknown";

/**
 * Temporal horizon for the prediction.
 */
export type AnticipationHorizon = "immediate" | "short" | "medium" | "long";

/**
 * Category of the anticipated event.
 */
export type AnticipationCategory =
  | "gate_transition"
  | "pipeline_failure"
  | "resource_exhaustion"
  | "dependency_block"
  | "performance_degradation"
  | "test_flake"
  | "fixture_missing"
  | "env_drift";

/**
 * A single anticipation signal — a prediction about a future state.
 */
export interface AnticipationSignal {
  /** Unique signal identifier */
  id: string;
  /** Category of the anticipated event */
  category: AnticipationCategory;
  /** Human-readable label */
  label: string;
  /** Confidence in this prediction */
  confidence: AnticipationConfidence;
  /** Temporal horizon (when this is expected to occur) */
  horizon: AnticipationHorizon;
  /** Target entity (pipeline ID, gate number, resource name, etc.) */
  target: string;
  /** Predicted state transition */
  transition: {
    from: string;
    to: string;
  };
  /** Evidence supporting this prediction */
  evidence: string[];
  /** Recommended action to mitigate or accelerate */
  action: string;
  /** Timestamp when signal was generated */
  generatedAt: string;
  /** Timestamp when this signal is expected to resolve */
  expectedAt?: string;
  /** Whether this signal has been addressed */
  resolved: boolean;
}

/**
 * Proximity window — a time-bounded aggregation of related signals.
 *
 * Groups signals that are temporally close and semantically related
 * to form a higher-level anticipation cluster.
 */
export interface ProximityWindow {
  /** Window identifier */
  id: string;
  /** Time range of this window */
  window: {
    start: string;
    end: string;
  };
  /** Signals within this window */
  signals: AnticipationSignal[];
  /** Aggregated confidence (highest among signals) */
  confidence: AnticipationConfidence;
  /** Primary category (most frequent) */
  primaryCategory: AnticipationCategory;
  /** Number of signals in this window */
  signalCount: number;
  /** Whether this window represents a risk cluster */
  isRiskCluster: boolean;
}

/**
 * Anticipation store — persistence layer for anticipation history.
 *
 * Maintains a rolling window of signals and proximity windows for
 * trend analysis and pattern detection.
 */
export interface AnticipationStore {
  /** Store identifier */
  id: string;
  /** Current active signals */
  activeSignals: AnticipationSignal[];
  /** Historical signals (resolved) */
  resolvedSignals: AnticipationSignal[];
  /** Proximity windows (grouped) */
  windows: ProximityWindow[];
  /** Metadata about the store */
  metadata: {
    schemaVersion: string;
    lastUpdated: string;
    totalSignalsGenerated: number;
    totalSignalsResolved: number;
    activeRiskClusters: number;
  };
}

// ── Pipeline-Specific Anticipation Types ───────────────────────────────────────────

/**
 * Anticipation signal for gate progression in the RL training loop.
 */
export interface GateTransitionSignal extends AnticipationSignal {
  category: "gate_transition";
  target: `gate_${number}`;  // e.g., "gate_4"
  transition: {
    from: "stub" | "missing" | "synthetic";
    to: "green";
  };
  /** Which gate this signal predicts */
  gateNumber: number;
  /** Estimated completion time */
  estimatedCompletion?: string;
}

/**
 * Anticipation signal for pipeline failure prediction.
 */
export interface PipelineFailureSignal extends AnticipationSignal {
  category: "pipeline_failure";
  target: string;  // pipeline ID
  transition: {
    from: "green" | "yellow";
    to: "red";
  };
  /** Predicted failure reason */
  failureReason: "fixture_missing" | "env_coupling" | "cascading" | "logic" | "timeout";
  /** Which fold is predicted to fail */
  foldId?: number;
}

/**
 * Anticipation signal for fixture missing events.
 */
export interface FixtureMissingSignal extends AnticipationSignal {
  category: "fixture_missing";
  target: string;  // file path or fixture ID
  transition: {
    from: "missing";
    to: "present";
  };
  /** Expected fixture path */
  fixturePath: string;
  /** Which test file requires this fixture */
  requiringTestFile: string;
}

// ── Anticipation Proposal ─────────────────────────────────────────────────────────

/**
 * Action proposal derived from anticipation signals.
 *
 * Represents a recommended action based on current anticipation state.
 */
export interface ActionProposal {
  /** Proposal identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority level */
  priority: "critical" | "high" | "medium" | "low";
  /** Which signals triggered this proposal */
  triggeredBy: string[];  // AnticipationSignal IDs
  /** Proposed action type */
  actionType: "create_fixture" | "mock_dependency" | "fix_gate" | "schedule_retry" | "ignore";
  /** Target of the action */
  target: string;
  /** Expected outcome if action is taken */
  expectedOutcome: string;
  /** Estimated time to complete this action */
  estimatedDurationMs: number;
  /** Whether this proposal has been accepted */
  accepted: boolean;
  /** Timestamp when proposal was generated */
  generatedAt: string;
}

/**
 * Full anticipation evaluation result.
 *
 * Returned by an anticipation engine after evaluating current state
 * against historical patterns and heuristics.
 */
export interface AnticipationEvaluation {
  /** Evaluation session identifier */
  sessionId: string;
  /** Timestamp of evaluation */
  evaluatedAt: string;
  /** Pipeline context */
  context: {
    pipelineId: string;
    currentStatus: string;
    activeGates: number[];
    currentFold?: number;
  };
  /** Generated signals */
  signals: AnticipationSignal[];
  /** Generated action proposals */
  proposals: ActionProposal[];
  /** Risk assessment */
  riskAssessment: {
    overallRisk: "low" | "medium" | "high" | "critical";
    riskFactors: string[];
    riskScore: number;  // 0-100
  };
  /** Next recommended action */
  nextAction: string;
}

// ── Anticipation Engine Interface (for implementation reference) ───────────────

/**
 * Interface for an anticipation engine implementation.
 *
 * Implementations should:
 *   - Evaluate current state against historical patterns
 *   - Generate anticipation signals with confidence scores
 *   - Group signals into proximity windows
 *   - Derive action proposals from signals
 */
export interface IAnticipationEngine {
  /**
   * Evaluate current pipeline state and generate anticipation signals.
   */
  evaluate(context: {
    pipelineId: string;
    currentStatus: string;
    metrics: Record<string, number>;
  }): AnticipationEvaluation;

  /**
   * Add a resolved signal to history for pattern learning.
   */
  recordResolution(signalId: string, actualOutcome: string): void;

  /**
   * Get proximity windows for a given time range.
   */
  getProximityWindows(start: string, end: string): ProximityWindow[];

  /**
   * Get active signals (not yet resolved).
   */
  getActiveSignals(): AnticipationSignal[];
}
