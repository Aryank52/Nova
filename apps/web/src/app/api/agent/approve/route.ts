import { NextRequest, NextResponse } from 'next/server';
import { ApprovalDecision } from '@nova/shared';

export const dynamic = 'force-dynamic';

let actionPolicy: any = null;

async function getActionPolicy() {
  if (!actionPolicy) {
    const { actionPolicy: ap } = await import('@nova/policy');
    actionPolicy = ap;
  }
  return actionPolicy;
}

export async function POST(request: NextRequest) {
  try {
    const { requestId, approved } = await request.json();

    if (!requestId || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Missing requestId or approved' }, { status: 400 });
    }

    const ap = await getActionPolicy();

    const decision: ApprovalDecision = {
      requestId,
      approved,
      decidedAt: Date.now(),
      decidedBy: 'user',
    };

    await ap.resolveApproval(requestId, decision);

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    );
  }
}
