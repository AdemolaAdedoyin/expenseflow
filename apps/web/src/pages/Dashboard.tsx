import { useQuery } from '@tanstack/react-query';
import { api, money } from '../lib/api';
import { DashboardReport } from '../types/domain';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardReport>('/reports/dashboard'),
  });

  const totals = data?.totals;

  return (
    <section>
      <div className="heading">
        <div>
          <h1>Overview</h1>
          <p>Company spend and approval health at a glance.</p>
        </div>
      </div>

      {error && (
        <div className="error page-error">
          {error instanceof Error ? error.message : 'Unable to load dashboard data.'}
        </div>
      )}

      <div className="cards">
        <div className="metric">
          <span>Total spend</span>
          <b>{money(totals?.amountCents ?? 0)}</b>
          <small>{totals?.expenses ?? 0} expenses</small>
        </div>

        <div className="metric">
          <span>Pending</span>
          <b>{money(totals?.pending.amountCents ?? 0)}</b>
          <small>{totals?.pending.count ?? 0} waiting</small>
        </div>

        <div className="metric">
          <span>Approved</span>
          <b>{money(totals?.approved.amountCents ?? 0)}</b>
          <small>{totals?.approved.count ?? 0} approved</small>
        </div>

        <div className="metric">
          <span>Rejected</span>
          <b>{money(totals?.rejected.amountCents ?? 0)}</b>
          <small>{totals?.rejected.count ?? 0} rejected</small>
        </div>
      </div>

      <div className="panel">
        <h2>Spend by category</h2>

        {isLoading ? (
          <p>Loading spend data...</p>
        ) : data?.byCategory.length ? (
          data.byCategory.map((category) => {
            const totalAmount = totals?.amountCents ?? 0;
            const percentage = totalAmount
              ? Math.max(8, (category.amountCents / totalAmount) * 100)
              : 0;

            return (
              <div className="barrow" key={category.category}>
                <span>{category.category}</span>
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${percentage}%` }} />
                </div>
                <b>{money(category.amountCents)}</b>
              </div>
            );
          })
        ) : (
          <p>No spend yet.</p>
        )}
      </div>
    </section>
  );
}
