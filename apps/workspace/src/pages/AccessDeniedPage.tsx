import { Button, Card, useAuth } from '@servicedesk/ui';

export default function AccessDeniedPage() {
  const { logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <Card title="No workspace access">
        <p className="text-sm text-slate-600">
          This workspace is for support staff. Use the support portal to raise and track your own
          tickets.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
