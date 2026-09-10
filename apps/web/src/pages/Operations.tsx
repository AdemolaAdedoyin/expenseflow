import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type OperationsOverview = {
  generatedAt: string;
  http: {
    requestCount: number;
    errorCount: number;
    errorRate: number;
    averageDurationMs: number;
    statusCodes: Record<string, number>;
  };
  notifications: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
};

export default function Operations() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['operations'],
    queryFn: () => api<OperationsOverview>('/operations/overview'),
    refetchInterval: 10_000,
  });

  return (
    <section>
      <div className="heading">
        <div>
          <h1>Operations</h1>
          <p>Runtime health for API traffic and background notification work.</p>
        </div>
      </div>

      {error && (
        <div className="error page-error">
          {error instanceof Error ? error.message : 'Unable to load operations data.'}
        </div>
      )}

      {isLoading && <div className="panel table-state">Loading operations data...</div>}

      {data && (
        <>
          <div className="cards">
            <div className="card">
              <small>HTTP requests</small>
              <strong>{data.http.requestCount}</strong>
            </div>
            <div className="card">
              <small>Server errors</small>
              <strong>{data.http.errorCount}</strong>
              <span>{(data.http.errorRate * 100).toFixed(1)}% error rate</span>
            </div>
            <div className="card">
              <small>Average latency</small>
              <strong>{data.http.averageDurationMs} ms</strong>
            </div>
            <div className="card">
              <small>Queue backlog</small>
              <strong>{data.notifications.waiting + data.notifications.delayed}</strong>
            </div>
          </div>

          <div className="approval-grid">
            <div className="panel">
              <h2>Notification queue</h2>
              <div className="metrics-list">
                <span>Waiting <b>{data.notifications.waiting}</b></span>
                <span>Active <b>{data.notifications.active}</b></span>
                <span>Delayed <b>{data.notifications.delayed}</b></span>
                <span>Completed <b>{data.notifications.completed}</b></span>
                <span>Failed <b>{data.notifications.failed}</b></span>
              </div>
            </div>

            <div className="panel">
              <h2>HTTP status codes</h2>
              <div className="metrics-list">
                {Object.entries(data.http.statusCodes).length ? (
                  Object.entries(data.http.statusCodes)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([status, count]) => (
                      <span key={status}>HTTP {status} <b>{count}</b></span>
                    ))
                ) : (
                  <p>No requests recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <small>Auto-refreshes every 10 seconds · Updated {new Date(data.generatedAt).toLocaleTimeString()}</small>
        </>
      )}
    </section>
  );
}
