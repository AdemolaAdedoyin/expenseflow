import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, money } from '../lib/api';
import { Approval, ApprovalDecision } from '../types/domain';

const approvalQueryKey = ['approvals'] as const;

type ApprovalDecisionRequest = {
  id: string;
  decision: ApprovalDecision;
  expectedVersion: number;
};

export default function Approvals() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: approvalQueryKey,
    queryFn: () => api<Approval[]>('/approvals/inbox'),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, expectedVersion }: ApprovalDecisionRequest) =>
      api(`/approvals/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, expectedVersion }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: approvalQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: approvalQueryKey });
    },
  });

  const mutationError = decide.error;

  return (
    <section>
      <div className="heading">
        <div>
          <h1>Approval inbox</h1>
          <p>Review expenses currently waiting on you.</p>
        </div>
      </div>

      {(error || mutationError) && (
        <div className="error page-error">
          {(error ?? mutationError) instanceof Error
            ? (error ?? mutationError)?.message
            : 'Something went wrong while loading approvals.'}
        </div>
      )}

      {isLoading ? (
        <div className="panel">
          <p>Loading approvals...</p>
        </div>
      ) : (
        <div className="approval-grid">
          {data?.length ? (
            data.map((approval) => (
              <article className="approval-card" key={approval.id}>
                <div>
                  <small>{approval.level} REVIEW</small>
                  <h2>{approval.expense.merchant}</h2>
                  <p>
                    {approval.expense.user.firstName} {approval.expense.user.lastName} ·{' '}
                    {approval.expense.category}
                  </p>
                </div>

                <strong>{money(approval.expense.amountCents, approval.expense.currency)}</strong>

                <div className="actions">
                  <button
                    className="danger"
                    type="button"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        id: approval.id,
                        decision: 'REJECT',
                        expectedVersion: approval.version,
                      })
                    }
                  >
                    Reject
                  </button>
                  <button
                    className="primary"
                    type="button"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        id: approval.id,
                        decision: 'APPROVE',
                        expectedVersion: approval.version,
                      })
                    }
                  >
                    Approve
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="panel">
              <h2>You're all caught up</h2>
              <p>No expenses are waiting for your approval.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
