import { NavLink, Outlet, redirect, useLoaderData } from 'react-router';
import { api } from '../../lib/api';
import '../../styles/admin.css';

export async function adminLoader() {
  const session = await api.auth.session();
  if (!session.user) return redirect('/sign-in?next=%2Fadmin');
  if (session.user.role !== 'ADMIN') return redirect('/dashboard');

  // One cheap call keeps the pending-payment badge honest on every admin screen.
  const overview = await api.admin.overview().catch(() => null);
  return { pendingPayments: overview?.stats.pendingPayments ?? 0 };
}

const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/courses', label: 'Courses' },
  { to: '/admin/lessons', label: 'Lessons' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/payments', label: 'Payments', badge: true },
  { to: '/admin/community', label: 'Community' },
  { to: '/admin/prompts', label: 'Prompts' },
  { to: '/admin/studio', label: 'AI Studio' }
];

export default function AdminLayout() {
  const { pendingPayments } = useLoaderData<typeof adminLoader>();

  return (
    <div className="ac-shell adm">
      <nav className="ac-panel adm-rail" aria-label="Admin sections">
        <div className="adm-rail-head">
          <p className="ac-eyebrow">Workspace</p>
        </div>
        {NAV.map(item => (
          <NavLink key={item.to} className="adm-link" to={item.to} end={item.end}>
            {item.label}
            {item.badge && pendingPayments > 0 ? (
              <span className="adm-link-count">{pendingPayments}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="adm-body">
        <Outlet />
      </div>
    </div>
  );
}
