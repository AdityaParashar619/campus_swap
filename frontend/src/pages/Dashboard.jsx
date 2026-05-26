import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CountUp, PageTransition, PremiumCard, Reveal, Stagger, StaggerItem } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';

const menuItems = [
  { title: 'Marketplace', desc: 'Buy, sell, and swap campus essentials', link: '/listings', key: 'MK' },
  { title: 'Notes Exchange', desc: 'Share and discover semester notes', link: '/notes', key: 'NT' },
  { title: 'Borrow Requests', desc: 'Ask community for urgent help', link: '/bounties', key: 'RQ' },
  { title: 'Student Network', desc: 'Build trust and connect with peers', link: '/network', key: 'NW' },
  { title: 'Live Chat', desc: 'Real-time messaging with students', link: '/chat', key: 'CH' },
  { title: 'Profile', desc: 'Grow your student reputation', link: '/profile', key: 'PR' }
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container space-y-8">
            <Reveal className="space-y-2">
              <p className="chip">Student control center</p>
              <h1 className="text-section-title">Welcome back, {user?.name}</h1>
              <p className="text-body-sm">Manage your listings, notes, requests, and conversations from one premium dashboard.</p>
            </Reveal>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                ['Active listings', 24],
                ['Connections', 112],
                ['Messages', 389]
              ].map(([label, number]) => (
                <PremiumCard key={label} className="p-5">
                  <p className="text-body-sm">{label}</p>
                  <p className="text-3xl font-extrabold mt-2">
                    <CountUp to={number} suffix="+" />
                  </p>
                </PremiumCard>
              ))}
            </div>

            <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {menuItems.map((item) => (
                <StaggerItem key={item.link}>
                  <Link to={item.link}>
                    <PremiumCard className="h-full">
                      <motion.div whileHover={{ rotate: -2 }} className="w-11 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white grid place-items-center font-bold mb-3">
                        {item.key}
                      </motion.div>
                      <h3 className="text-feature-title mb-2">{item.title}</h3>
                      <p className="text-body-sm">{item.desc}</p>
                    </PremiumCard>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
