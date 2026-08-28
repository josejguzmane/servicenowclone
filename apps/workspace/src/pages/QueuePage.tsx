import { Badge, Card, useAuth } from '@servicedesk/ui';

export default function QueuePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Queue</h1>
        <p className="text-sm text-slate-600">
          Ticket queues arrive with the ticket lifecycle phase. Your scope below is what the API
          will filter every query by.
        </p>
      </div>

      <Card title="Your working scope">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Assignment groups</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {user.groupIds.length === 0 ? (
                <span className="text-slate-500">none — ask a lead to add you to a group</span>
              ) : (
                user.groupIds.map((id) => <Badge key={id}>{id.slice(0, 8)}</Badge>)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Lead of</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {user.leadGroupIds.length === 0 ? (
                <span className="text-slate-500">—</span>
              ) : (
                user.leadGroupIds.map((id) => <Badge key={id}>{id.slice(0, 8)}</Badge>)
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Permissions granted to you">
        <ul className="flex flex-wrap gap-2">
          {user.permissions.map((permission) => (
            <li key={permission}>
              <Badge>{permission}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
