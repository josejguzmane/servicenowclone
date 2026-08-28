import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Field, useAuth } from '@servicedesk/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', company: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        company: form.company || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold">Create a customer account</h1>
      <Card>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Full name" name="name" required value={form.name} onChange={update('name')} />
          <Field
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update('email')}
          />
          <Field
            label="Company"
            name="company"
            hint="Used to link you to your organisation's tickets"
            value={form.company}
            onChange={update('company')}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            hint="At least 12 characters"
            value={form.password}
            onChange={update('password')}
          />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-sm text-slate-600">
        Already registered?{' '}
        <Link className="text-brand-700 underline" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
