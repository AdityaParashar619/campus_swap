import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageTransition } from '../components/ui';

export default function Landing() {
  console.log('🏠 Landing page rendered');

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="sticky top-0 z-50 backdrop-blur-md bg-white/70 shadow-sm"
        >
          <div className="section-container py-6 flex justify-between items-center">
            <motion.div whileHover={{ scale: 1.08 }} className="text-2xl font-display font-black text-indigo-600">
              CampusSwap
            </motion.div>
            <div className="flex gap-4">
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-gray-700 font-medium hover:text-indigo-600 transition-colors px-4 py-2"
                >
                  Login
                </motion.button>
              </Link>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/40 transition-all"
                >
                  Sign up
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.nav>

        {/* =============== HERO SECTION =============== */}
        <section className="py-20 md:py-32 bg-gradient-to-b from-white via-indigo-50/30 to-white">
          <div className="section-container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Text Content */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {/* Badge/Tag */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6 inline-block"
                >
                  <span className="text-badge bg-indigo-100 px-4 py-2 rounded-full">
                    🎓 Built for College Students
                  </span>
                </motion.div>

                {/* Main Heading */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="text-hero-lg bg-gradient-to-r from-gray-900 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6"
                >
                  Buy, Sell & Trade with Your Campus
                </motion.h1>

                {/* Subheading */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="text-xl text-gray-600 mb-2 max-w-md leading-relaxed"
                >
                  Connect instantly with students. Buy textbooks, find roommates, post bounties, and trade items—safely in one trusted place.
                </motion.p>

                {/* Trust Signal */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm text-gray-500 mb-8 flex items-center gap-2"
                >
                  ✓ Trusted by 5,000+ students on campus
                </motion.p>

                {/* Button Group */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <Link to="/signup" className="w-fit">
                    <motion.button
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all"
                    >
                      Get Started Free
                    </motion.button>
                  </Link>
                  <Link to="/login" className="w-fit">
                    <motion.button
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-8 py-4 bg-white/50 backdrop-blur-md border border-gray-200/50 text-gray-900 font-semibold rounded-xl hover:bg-white/80 transition-all"
                    >
                      Learn More →
                    </motion.button>
                  </Link>
                </motion.div>
              </motion.div>

              {/* Right: Visual Element (Illustration/Placeholder) */}
              <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                className="relative h-96 md:h-full"
              >
                {/* Gradient shapes (pseudo-illustration) */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl overflow-hidden">
                  {/* Floating shapes */}
                  <motion.div
                    animate={{ y: [0, 20, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl opacity-70 blur-2xl"
                  />
                  <motion.div
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute bottom-10 right-10 w-40 h-40 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-3xl opacity-60 blur-3xl"
                  />

                  {/* Content cards (mockup of marketplace) */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ y: [0, 5, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="bg-white rounded-2xl shadow-xl p-4 max-w-xs"
                    >
                      <div className="flex gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-lg" />
                        <div>
                          <div className="h-2 w-24 bg-gray-300 rounded mb-2" />
                          <div className="h-2 w-16 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded mb-2" />
                      <div className="h-2 w-3/4 bg-gray-100 rounded" />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-12 border-y border-gray-200">
          <div className="section-container text-center">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Powered by students</span> • No commission on tips • Verified college emails only
            </p>
          </div>
        </section>

        {/* =============== FEATURES SECTION =============== */}
        <section className="py-20 md:py-32 bg-gray-50">
          <div className="section-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-section-title mb-6">Why Choose CampusSwap?</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Built specifically for college communities. No hidden fees. Real students. Real trust.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: '🔐',
                  title: 'Verified Campus Network',
                  desc: 'Only authenticated college students. No strangers, no scams.'
                },
                {
                  icon: '💰',
                  title: 'Fair Marketplace',
                  desc: 'Peer-to-peer trading. Set your own prices, negotiate freely.'
                },
                {
                  icon: '💬',
                  title: 'Instant Chat',
                  desc: 'Real-time messaging. Negotiate quickly. Make deals safe.'
                },
                {
                  icon: '⭐',
                  title: 'Ratings & Reviews',
                  desc: 'Build reputation. See who you can trust on campus.'
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300"
                >
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-feature-title mb-3 text-gray-900">{feature.title}</h3>
                  <p className="text-body-sm">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* =============== HOW IT WORKS SECTION =============== */}
        <section className="py-20 md:py-32 bg-white">
          <div className="section-container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <h2 className="text-section-title mb-6">Get Started in 3 Steps</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                From signup to first trade in minutes.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  step: '01',
                  title: 'Sign Up',
                  desc: 'Create your account using your college email. Instant verification.'
                },
                {
                  step: '02',
                  title: 'Post or Browse',
                  desc: 'List items for sale or find exactly what you need from peers.'
                },
                {
                  step: '03',
                  title: 'Connect & Trade',
                  desc: 'Chat securely, negotiate, and complete transactions on campus.'
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="relative"
                >
                  {/* Step number background */}
                  <div className="absolute -top-8 -left-8 text-8xl font-display font-black text-indigo-100 opacity-50 blur-sm">
                    {item.step}
                  </div>

                  {/* Content */}
                  <div className="relative z-10 bg-gradient-to-br from-indigo-50 to-transparent rounded-2xl p-8 border border-indigo-100/50">
                    <div className="text-5xl mb-4 font-display font-black text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">
                      {item.step}
                    </div>
                    <h3 className="text-feature-title mb-3 text-gray-900">{item.title}</h3>
                    <p className="text-body-sm">{item.desc}</p>
                  </div>

                  {/* Arrow connector (hidden on last item) */}
                  {i < 2 && (
                    <div className="hidden md:flex absolute -right-6 top-1/2 -translate-y-1/2">
                      <motion.div
                        animate={{ x: [0, 8, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        →
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* =============== FINAL CTA =============== */}
        <section className="py-20 md:py-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600">
          <div className="section-container text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-section-title text-white mb-8">
                Join Your Campus Community Today
              </h2>
              <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto">
                Stop wasting money on overpriced textbooks. Trade smarter with your classmates.
              </p>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all"
                >
                  Create Your Free Account
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 bg-gray-900 text-center text-gray-400">
          <p className="text-sm">© 2024 CampusSwap. Your college marketplace.</p>
        </footer>
      </div>
    </PageTransition>
  );
}
