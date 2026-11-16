import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { authAPI } from '../services/api';

const menuItems = [
  { title: 'Marketplace', desc: 'Buy, sell, and swap campus essentials', link: '/listings', key: 'MK', primary: true },
  { title: 'Saved listings', desc: 'Return to products you want to compare', link: '/saved-listings', key: 'SV', primary: true },
  { title: 'Notes Exchange', desc: 'Share and discover semester notes', link: '/notes', key: 'NT' },
  { title: 'Borrow Requests', desc: 'Ask community for urgent help', link: '/bounties', key: 'RQ' },
  { title: 'Student Network', desc: 'Unlock trusted chat, contact sharing, and campus reputation', link: '/network', key: 'NW' },
  { title: 'Live Chat', desc: 'Continue conversations with other students', link: '/chat', key: 'CH', primary: true },
  { title: 'Profile', desc: 'Grow your student reputation', link: '/profile', key: 'PR' }
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ listingsCount: 0, connectionsCount: 0, messagesCount: 0 });
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    (async () => {
      try {
        const response = await authAPI.getMe();
        setStats(response.data.stats || {});
        setStatus('ready');
      } catch {
        setStats({ listingsCount: 0, connectionsCount: 0, messagesCount: 0 });
        setStatus('error');
      }
    })();
  }, []);

  return (
    <PageTransition>
      <Layout>
        <div className="page-shell min-h-[calc(100vh-4rem)]">
          <div className="section-container space-y-8">
            <header className="page-header">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Student dashboard</p>
              <h1 className="text-section-title">Welcome back, {user?.name}</h1>
              <p className="max-w-2xl text-body-sm">Manage listings, saved products, conversations, notes, and campus requests from one place.</p>
            </header>

            <section aria-labelledby="quick-actions-heading">
              <div className="mb-4 flex items-end justify-between gap-4"><div><h2 id="quick-actions-heading" className="text-xl font-bold">Quick actions</h2><p className="mt-1 text-body-sm">Pick up where you left off.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-3">
                {menuItems.filter((item) => item.primary).map((item) => <Link key={item.link} to={item.link} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><PremiumCard className="h-full p-5" hover={false}><span className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">{item.key}</span><h3 className="font-bold group-hover:text-blue-700 dark:group-hover:text-blue-300">{item.title}</h3><p className="mt-1 text-body-sm">{item.desc}</p></PremiumCard></Link>)}
              </div>
            </section>

            <section aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="mb-4 text-xl font-bold">Your overview</h2>
              {status === 'error' && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Dashboard totals are temporarily unavailable. Your account and features are still accessible.</p>}
              <div className="grid gap-4 sm:grid-cols-3" aria-busy={status === 'loading'}>
              {[
                ['Active listings', stats.listingsCount || 0],
                ['Trusted connections', stats.connectionsCount || 0],
                ['Messages', stats.messagesCount || 0]
              ].map(([label, number]) => (
                <PremiumCard key={label} className="p-5">
                  <p className="text-body-sm">{label}</p>
                  <p className="mt-2 text-3xl font-extrabold">{status === 'loading' ? <span className="skeleton block h-9 w-16" aria-label="Loading total" /> : number}</p>
                </PremiumCard>
              ))}
              </div>
            </section>

            <section aria-labelledby="student-tools-heading"><h2 id="student-tools-heading" className="mb-4 text-xl font-bold">Student tools</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{menuItems.filter((item) => !item.primary).map((item) => <Link key={item.link} to={item.link} className="group"><PremiumCard className="h-full p-5" hover={false}><span className="mb-3 text-xs font-bold text-blue-700 dark:text-blue-300">{item.key}</span><h3 className="font-bold group-hover:text-blue-700 dark:group-hover:text-blue-300">{item.title}</h3><p className="mt-1 text-body-sm">{item.desc}</p></PremiumCard></Link>)}</div></section>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
