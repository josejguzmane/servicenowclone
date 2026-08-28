import { Link } from 'react-router-dom';
import { Badge, Card, useAuth } from '@servicedesk/ui';

export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-slate-600">
          Raise a request, track your open tickets, or search the knowledge base.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/tickets/new" className="block">
          <Card title="Report an issue">
            <p className="text-sm text-slate-600">Something is broken or not working as expected.</p>
          </Card>
        </Link>
        <Link to="/catalog" className="block">
          <Card title="Request a service">
            <p className="text-sm text-slate-600">Hardware, software, access and other requests.</p>
          </Card>
        </Link>
        <Link to="/tickets" className="block">
          <Card title="Track my tickets">
            <p className="text-sm text-slate-600">Status, updates and replies on your tickets.</p>
          </Card>
        </Link>
      </div>

      <Card title="Your access">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Account type</dt>
            <dd className="mt-1 flex gap-2">
              <Badge>{user.kind}</Badge>
              {user.isAccountAdmin && <Badge>account admin</Badge>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Roles</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role}>{role}</Badge>
              ))}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
