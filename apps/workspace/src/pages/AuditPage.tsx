import { useQuery } from '@tanstack/react-query';
import { Alert, Card, useAuth } from '@servicedesk/ui';

interface AuditRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  occurredAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export default function AuditPage() {
  const { api } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.request<{ items: AuditRow[] }>('GET', '/audit?limit=50'),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      {error && <Alert>{(error as Error).message}</Alert>}
      <Card>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">When</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 text-slate-500">
                    {new Date(row.occurredAt).toLocaleString()}
                  </td>
                  <td>{row.actor?.name ?? 'system'}</td>
                  <td className="text-slate-600">
                    {row.entityType}:{row.entityId.slice(0, 8)}
                  </td>
                  <td>{row.action}</td>
                  <td className="text-slate-600">
                    {row.field ? `${row.field}: ${row.oldValue ?? '—'} → ${row.newValue ?? '—'}` : '—'}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
