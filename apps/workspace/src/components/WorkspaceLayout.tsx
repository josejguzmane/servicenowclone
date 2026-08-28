import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge, Button, useAuth } from '@servicedesk/ui';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();

  const nav = [
    { to: '/', label: 'Queue', end: true, visible: true },
    { to: '/audit', label: 'Audit log', end: false, visible: can('audit.read') },
  ].filter((item) => item.visible);

  return (
    <div className="flex min-h-full">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <div className="px-4 py-4 text-sm font-semibold text-brand-700">Agent Workspace</div>
        <nav aria-label="Main" className="flex flex-col gap-1 px-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <span className="text-sm text-slate-600">{user?.name}</span>
          {user?.roles.map((role) => <Badge key={role}>{role}</Badge>)}
          <Button variant="ghost" onClick={() => void logout()}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
