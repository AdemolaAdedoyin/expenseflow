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

function percentOf(value: number, maximum: number) {
  if (value === 0 || maximum === 0) return 0;
  return Math.max(4, Math.round((value / maximum) * 100));
}

export default function Operations() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['operations'],
    queryFn: () => api<OperationsOverview>('/operations/overview'),
    refetchInterval: 10_000,
  });

  const queueEntries = data
    ? [
        ['Waiting', data.notifications.waiting],
        ['Active', data.notifications.active],
        ['Delayed', data.notifications.delayed],
        ['Completed', data.notifications.completed],
        ['Failed', data.notifications.failed],
      ] as const
    : [];

  const maxQueueCount = Math.max(0, ...queueEntries.map(([, count]) => count));
  const statusEntries = data
    ? Object.entries(data.http.statusCodes).sort(([a], [b]) => Number(a) - Number(b))
    : [];
  const maxStatusCount = Math.max(0, ...statusEntries.map(([, count]) => count));

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
            <div className="metric">
              <small>HTTP requests</small>
              <b>{data.http.requestCount}</b>
              <span>Since this API process started</span>
            </div>
            <div className="metric">
              <small>Server errors</small>
              <b>{data.http.errorCount}</b>
              <span>{(data.http.errorRate * 100).toFixed(1)}% error rate</span>
            </div>
            <div className="metric">
              <small>Average latency</small>
              <b>{data.http.averageDurationMs.toFixed(2)} ms</b>
              <span>Across recorded requests</span>
            </div>
            <div className="metric">
              <small>Queue backlog</small>
              <b>{data.notifications.waiting + data.notifications.delayed}</b>
              <span>Waiting + delayed jobs</span>
            </div>
          </div>

          <div className="approval-grid">
            <div className="panel">
              <h2>Notification queue</h2>
              <p>Current BullMQ job counts.</p>
              {queueEntries.map(([label, count]) => (
                <div className="barrow" key={label}>
                  <span>{label}</span>
                  <div className="bar" aria-hidden="true">
                    <i style={{ width: `${percentOf(count, maxQueueCount)}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>

            <div className="panel">
              <h2>HTTP status codes</h2>
              <p>Responses grouped by status code.</p>
              {statusEntries.length ? (
                statusEntries.map(([status, count]) => (
                  <div className="barrow" key={status}>
                    <span>HTTP {status}</span>
                    <div className="bar" aria-hidden="true">
                      <i style={{ width: `${percentOf(count, maxStatusCount)}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                ))
              ) : (
                <p>No requests recorded yet.</p>
              )}
            </div>
          </div>

          <p>
            <small>
              Auto-refreshes every 10 seconds · Updated{' '}
              {new Date(data.generatedAt).toLocaleTimeString()}
            </small>
          </p>
        </>
      )}
    </section>
  );
}
