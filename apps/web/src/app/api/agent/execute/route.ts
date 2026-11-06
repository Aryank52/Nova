import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mcpClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let aiProvider: any = null;

async function getDependencies() {
  if (!mcpClient) {
    const [{ createMCPClient }, { createNemotronProvider }] = await Promise.all([
      import('@nova/mcp-client'),
      import('@nova/ai-provider'),
    ]);
    mcpClient = createMCPClient({
      serverUrl: process.env.NEXT_PUBLIC_MCP_URL || 'http://localhost:3001/mcp',
    });
    aiProvider = createNemotronProvider();
  }
  return { mcpClient, aiProvider };
}

export async function POST(request: NextRequest) {
  try {
    const { message, userId } = await request.json();

    if (!message || !userId) {
      return NextResponse.json({ error: 'Missing message or userId' }, { status: 400 });
    }

    const { mcpClient, aiProvider } = await getDependencies();
    const { createAgent } = await import('@nova/agent');

    await mcpClient.connect();

    const agent = createAgent({
      aiProvider,
      mcpClient,
      userId,
      maxIterations: 20,
      stepTimeout: 60000,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const events: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let planSteps: unknown[] = [];
    let approvalRequest: unknown = null;
    let finalResult: unknown = null;

    const unsubscribe = agent.onEvent((event: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = event as any;

      if (e.type === 'step_started') {
        planSteps = planSteps.map((s: any) =>
          s.stepId === e.data?.stepId ? { ...s, status: 'running' } : s
        );
      }
      if (e.type === 'step_completed') {
        planSteps = planSteps.map((s: any) =>
          s.stepId === e.data?.stepId ? { ...s, status: 'completed' } : s
        );
      }
      if (e.type === 'step_failed') {
        planSteps = planSteps.map((s: any) =>
          s.stepId === e.data?.stepId ? { ...s, status: 'failed' } : s
        );
      }
      if (e.type === 'approval_required') {
        approvalRequest = {
          id: e.data?.requestId,
          stepId: e.data?.stepId,
          tool: e.data?.tool,
          arguments: {},
          risk: 'CONSEQUENTIAL',
          reason: e.message,
        };
      }
      if (e.type === 'execution_completed' || e.type === 'execution_failed') {
        finalResult = { success: e.type === 'execution_completed', summary: e.message };
      }
    });

    const result = await agent.executeGoal(message);

    unsubscribe();

    return NextResponse.json({
      events: [],
      planSteps: [],
      approvalRequest,
      result: finalResult || { success: result.success, summary: result.summary },
    });
  } catch (error) {
    console.error('Agent execution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}
