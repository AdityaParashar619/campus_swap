import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';

const menuItems = [
  { title: 'Listings', desc: 'Buy and sell items on campus', link: '/listings', icon: '📦' },
  { title: 'Bounties', desc: 'Post requests and earn rewards', link: '/bounties', icon: '🎯' },
  { title: 'Chat', desc: 'Message with other students', link: '/chat', icon: '💬' },
  { title: 'Profile', desc: 'Manage your account & settings', link: '/profile', icon: '👤' }
];

export default function Dashboard() {
  const { user } = useAuth();

  console.log('📊 Dashboard rendered - user:', user);

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/20 to-white py-12">
          <div className="section-container">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-16"
            >
              <h1 className="text-section-title mb-3 text-gray-900">
                Welcome back, <span className="text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">{user?.name}</span>! 👋
              </h1>
              <p className="text-lg text-gray-600">Manage your listings, bounties, and connect with campus peers</p>
            </motion.div>

            {/* Menu Grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
              className="grid md:grid-cols-2 gap-8 mb-16"
            >
              {menuItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={item.link}>
                    <PremiumCard className="h-full hover:shadow-2xl group cursor-pointer">
                      <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                      <h3 className="text-feature-title mb-2 text-gray-900">{item.title}</h3>
                      <p className="text-body-sm mb-4">{item.desc}</p>
                      <motion.div
                        initial={{ x: 0 }}
                        whileHover={{ x: 5 }}
                        className="text-indigo-600 font-semibold text-sm"
                      >
                        Explore →
                      </motion.div>
                    </PremiumCard>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {/* Stats Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-feature-title mb-8 text-gray-900">Your Activity</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { label: 'Total Listings', value: '—', icon: '📦', color: 'from-blue-500 to-cyan-500' },
                  { label: 'Active Bounties', value: '—', icon: '🎯', color: 'from-purple-500 to-pink-500' },
                  { label: 'Messages', value: '—', icon: '💬', color: 'from-indigo-500 to-purple-500' }
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                    className={`p-8 bg-gradient-to-br ${stat.color} rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 text-white`}
                  >
                    <div className="text-4xl mb-3 opacity-80">{stat.icon}</div>
                    <p className="text-white/80 text-sm font-medium mb-2">{stat.label}</p>
                    <p className="text-4xl font-bold">{stat.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
