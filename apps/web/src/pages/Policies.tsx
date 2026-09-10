import { useQuery } from '@tanstack/react-query';
import { api, money } from '../lib/api';
import { ExpensePolicy } from '../types/domain';

export default function Policies() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['policies'],
    queryFn: () => api<ExpensePolicy[]>('/policies'),
  });

  return (
    <section>
      <div className="heading">
        <div>
          <h1>Expense policies</h1>
          <p>Rules are evaluated when an employee submits an expense.</p>
        </div>
      </div>

      {error && (
        <div className="error page-error">
          {error instanceof Error ? error.message : 'Unable to load expense policies.'}
        </div>
      )}

      <div className="panel table">
        <div className="tr policy th">
          <span>Rule</span>
          <span>Category</span>
          <span>Threshold</span>
          <span>Action</span>
        </div>

        {isLoading && <div className="table-state">Loading policies...</div>}

        {!isLoading && !data?.length && <div className="table-state">No policies configured.</div>}

        {data?.map((policy) => (
          <div className="tr policy" key={policy.id}>
            <span>
              <b>{policy.name}</b>
              <small>Priority {policy.priority}</small>
            </span>
            <span>{policy.category ?? 'All categories'}</span>
            <span>
              {policy.minAmountCents != null
                ? `From ${money(policy.minAmountCents)}`
                : 'Any amount'}
            </span>
            <span>
              <em className="status">{policy.action.replaceAll('_', ' ')}</em>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
