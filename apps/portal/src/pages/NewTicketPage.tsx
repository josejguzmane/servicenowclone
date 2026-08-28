import { Card } from '@servicedesk/ui';

export default function NewTicketPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Report an issue</h1>
      <Card>
        <p className="text-sm text-slate-600">
          The incident form arrives with the ticket lifecycle phase, backed by the category tree and
          the impact/urgency matrix that already ship in the schema.
        </p>
      </Card>
    </div>
  );
}
