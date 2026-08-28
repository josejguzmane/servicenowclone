import { Card } from '@servicedesk/ui';

export default function MyTicketsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">My tickets</h1>
      <Card>
        <p className="text-sm text-slate-600">
          Ticket listing arrives with the ticket lifecycle phase. The read scope that backs this
          page is already enforced by the API: you only ever receive your own tickets, or your whole
          organisation&apos;s if you are an account admin.
        </p>
      </Card>
    </div>
  );
}
