import { motion } from 'framer-motion';
import { PageTransition, PremiumCard } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import Layout from '../layouts/Layout';

export default function Profile() {
  const { user } = useAuth();

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/20 to-white py-12">
          <div className="section-container">
            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-section-title mb-2 text-gray-900"
              >
                👤 Profile
              </motion.h1>
              <p className="text-gray-600 text-lg">Your account information and activity</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full"
            >
              <PremiumCard className="!p-12">
                {/* Avatar Section */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-12"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-32 h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <span className="text-6xl text-white font-black">{user?.name?.charAt(0) || '?'}</span>
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-display font-bold text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text mb-2"
                  >
                    {user?.name}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-gray-600 font-medium"
                  >
                    ⭐ Active Member
                  </motion.p>
                </motion.div>

                {/* Profile Details Grid */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Email */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="border-b-2 border-white/20 pb-6 hover:border-indigo-300/50 transition-colors"
                  >
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 block">
                      📧 Email Address
                    </label>
                    <p className="text-2xl font-bold text-gray-900 break-all">
                      {user?.email}
                    </p>
                  </motion.div>

                  {/* Enrollment Number */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="border-b-2 border-white/20 pb-6 hover:border-purple-300/50 transition-colors"
                  >
                    <label className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-3 block">
                      🎓 Enrollment Number
                    </label>
                    <p className="text-2xl font-bold text-gray-900">
                      {user ? (user.enrollmentNumber || 'Not provided') : '—'}
                    </p>
                  </motion.div>

                  {/* Member Since */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="border-b-2 border-white/20 pb-6 hover:border-pink-300/50 transition-colors"
                  >
                    <label className="text-xs font-bold uppercase tracking-wider text-pink-600 mb-3 block">
                      📅 Member Since
                    </label>
                    <p className="text-2xl font-bold text-gray-900">
                      {user ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                  </motion.div>

                  {/* Status */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="border-b-2 border-white/20 pb-6 hover:border-green-300/50 transition-colors"
                  >
                    <label className="text-xs font-bold uppercase tracking-wider text-green-600 mb-3 block">
                      ✓ Account Status
                    </label>
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-4 h-4 bg-green-500 rounded-full"
                      />
                      <p className="text-2xl font-bold text-gray-900">Active</p>
                    </div>
                  </motion.div>
                </div>

                {/* Stats Section */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-12 pt-8 border-t-2 border-white/20"
                >
                  <h3 className="text-feature-title font-bold text-gray-900 mb-6">📊 Activity Stats</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { label: 'Listings', value: '0', icon: '📦', color: 'from-blue-500 to-cyan-500' },
                      { label: 'Bounties Posted', value: '0', icon: '🎯', color: 'from-purple-500 to-pink-500' },
                      { label: 'Messages', value: '0', icon: '💬', color: 'from-indigo-500 to-purple-500' }
                    ].map((stat, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        className={`p-6 bg-gradient-to-br ${stat.color} rounded-xl text-white shadow-lg hover:shadow-2xl transition-all duration-300 text-center`}
                      >
                        <p className="text-4xl mb-2 opacity-90">{stat.icon}</p>
                        <p className="text-3xl font-bold mb-1">{stat.value}</p>
                        <p className="text-sm font-semibold text-white/90">{stat.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </PremiumCard>
            </motion.div>
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
