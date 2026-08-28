import { Card } from '@servicedesk/ui';

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Service catalog</h1>
      <Card>
        <p className="text-sm text-slate-600">
          Catalog items and their JSON Schema request forms are seeded in the database; the
          rendering and approval flow arrive with the catalog phase.
        </p>
      </Card>
    </div>
  );
}
