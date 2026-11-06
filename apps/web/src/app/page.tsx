'use client';

import { useState, useCallback } from 'react';
import { ExecutionStep } from '@nova/shared';

interface AgentEvent {
  type: string;
  message: string;
  data?: unknown;
  timestamp: number;
  id: string;
  executionId: string;
}

// Use the imported ExecutionStep type from @nova/shared

interface ApprovalRequest {
  id: string;
  stepId: string;
  tool: string;
  arguments: Record<string, unknown>;
  risk: string;
  reason: string;
}

interface ExecutionResult {
  success: boolean;
  summary: string;
  executionId: string;
  events: AgentEvent[];
  planSteps: ExecutionStep[];
  approvalRequest: ApprovalRequest | null;
}

const API_BASE = '/api/agent';

export default function NovaApp() {
  const [userId] = useState('user_001');
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [planSteps, setPlanSteps] = useState<ExecutionStep[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ExecutionResult[]>([]);

  const executeGoal = useCallback(
    async (message: string) => {
      setIsExecuting(true);
      setError(null);
      setEvents([]);
      setPlanSteps([]);
      setApprovalRequest(null);
      setResult(null);

      try {
        const response = await fetch(`${API_BASE}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, userId }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Execution failed');
        }

        const data: ExecutionResult = await response.json();
        setEvents(data.events);
        setPlanSteps(data.planSteps);
        setApprovalRequest(data.approvalRequest);
        setResult(data);

        // Add to history
        setHistory(prev => [data, ...prev.slice(0, 9)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Execution failed');
      } finally {
        setIsExecuting(false);
      }
    },
    [userId]
  );

  const handleApprove = useCallback(
    async (approved: boolean) => {
      if (!approvalRequest) return;

      try {
        const response = await fetch(`${API_BASE}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: approvalRequest.id, approved }),
        });

        if (!response.ok) {
          throw new Error('Approval failed');
        }

        setApprovalRequest(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Approval failed');
      }
    },
    [approvalRequest]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isExecuting) {
      executeGoal(input.trim());
    }
  };

  const clearError = () => setError(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nova-500 to-nova-700 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l6.857-2.143L12 3l2.286 6.857L21 12l-5.714 2.143L13 21"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">NOVA</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Context-Aware Goal-to-Action Agent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">User: {userId}</span>
            <button
              onClick={() => {
                /* TODO: settings */
              }}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input & History */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                New Goal
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="goal-input"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  >
                    What would you like NOVA to do?
                  </label>
                  <textarea
                    id="goal-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-nova-500 focus:border-transparent resize-none"
                    placeholder="e.g., Plan a dinner party for 6 guests tomorrow at 7pm, check weather, and create a shopping list"
                    disabled={isExecuting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isExecuting || !input.trim()}
                  className="w-full py-3 px-6 bg-nova-600 text-white font-medium rounded-lg hover:bg-nova-700 focus:outline-none focus:ring-2 focus:ring-nova-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isExecuting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Executing...
                    </span>
                  ) : (
                    'Execute Goal'
                  )}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Execution History
              </h2>
              {history.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                  No executions yet
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.map((exec, idx) => (
                    <div
                      key={exec.executionId}
                      className={`p-3 rounded-lg border transition-colors ${
                        idx === 0
                          ? 'bg-nova-50 dark:bg-nova-900/20 border-nova-200 dark:border-nova-800'
                          : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-medium ${exec.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                        >
                          {exec.success ? '✓ Success' : '✗ Failed'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(exec.events[0]?.timestamp || Date.now()).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {exec.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Execution Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Events Timeline */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Execution Timeline
                </h2>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    isExecuting
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : result?.success
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : result
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {isExecuting
                    ? 'Running'
                    : result?.success
                      ? 'Completed'
                      : result
                        ? 'Failed'
                        : 'Idle'}
                </span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-3 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p>No events yet. Submit a goal to start execution.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {events.map((event, idx) => (
                      <EventTimelineItem key={`${event.id}-${idx}`} event={event} _index={idx} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Plan Steps */}
            {planSteps.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Plan Steps
                </h2>
                <div className="space-y-3">
                  {planSteps.map((step, idx) => (
                    <PlanStepItem key={step.stepId} step={step} index={idx} />
                  ))}
                </div>
              </div>
            )}

            {/* Approval Request */}
            {approvalRequest && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                      ⚠️ Approval Required
                    </h3>
                    <p className="text-amber-700 dark:text-amber-300">{approvalRequest.reason}</p>
                    <div className="mt-3 space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Tool:</span> {approvalRequest.tool}
                      </p>
                      <p>
                        <span className="font-medium">Risk:</span>{' '}
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded text-xs">
                          {approvalRequest.risk}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Arguments:</span>{' '}
                        <code className="text-slate-600 dark:text-slate-400">
                          {JSON.stringify(approvalRequest.arguments, null, 2)}
                        </code>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 ml-4">
                    <button
                      onClick={() => handleApprove(false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => handleApprove(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Result Summary */}
            {result && (
              <div
                className={`rounded-xl p-6 ${result.success ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${result.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
                  >
                    <svg
                      className={`w-5 h-5 ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {result.success ? (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      ) : (
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      )}
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {result.success ? 'Execution Completed' : 'Execution Failed'}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Execution ID: {result.executionId}
                    </p>
                  </div>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{result.summary}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EventTimelineItem({ event, _index }: { event: AgentEvent; _index: number }) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'understanding_started':
      case 'understanding_completed':
        return (
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        );
      case 'context_loading_started':
      case 'context_loading_completed':
        return (
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case 'planning_started':
      case 'planning_completed':
        return (
          <svg
            className="w-5 h-5 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        );
      case 'execution_started':
      case 'execution_completed':
      case 'execution_failed':
        return (
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
      case 'step_started':
      case 'step_completed':
      case 'step_failed':
        return (
          <svg
            className="w-5 h-5 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        );
      case 'approval_required':
      case 'approval_received':
        return (
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        );
      case 'verification_started':
      case 'verification_completed':
        return (
          <svg
            className="w-5 h-5 text-teal-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  const getEventColor = (type: string) => {
    if (type.includes('failed')) return 'text-red-600 dark:text-red-400';
    if (type.includes('completed')) return 'text-green-600 dark:text-green-400';
    if (type.includes('started')) return 'text-blue-600 dark:text-blue-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          {getEventIcon(event.type)}
        </div>
        <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className={`text-sm font-medium ${getEventColor(event.type)}`}>
            {event.message}
          </span>
        </div>
        {event.data ? (
          <pre className="mt-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto max-h-24 overflow-y-auto">
            {String(event.data)}
          </pre>
        ) : null}
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {new Date(event.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </li>
  );
}

function PlanStepItem({ step, index }: { step: ExecutionStep; index: number }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'skipped':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        );
      case 'failed':
        return (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case 'skipped':
        return (
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${index === 0 ? 'bg-nova-100 dark:bg-nova-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}
        >
          <span className="text-sm font-medium text-nova-600 dark:text-nova-400">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-900 dark:text-white">{step.description}</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(step.status)}`}
            >
              {step.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              {getStatusIcon(step.status)} Tool: {step.tool}
            </span>
            <span className="flex items-center gap-1">
              Risk:{' '}
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                {step.risk || 'UNKNOWN'}
              </span>
            </span>
          </div>
          {step.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{step.error}</p>
          )}
          {step.result && step.status === 'completed' && (
            <details className="mt-2">
              <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                View result
              </summary>
              <pre className="mt-1 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(step.result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
