import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CountUp, PageTransition, Reveal, Stagger, StaggerItem } from '../components/ui';

const faqs = [
  {
    q: 'Is CampusSwap only for my college?',
    a: 'Yes. The platform is designed for campus-first trust, with verified student access and local interactions.'
  },
  {
    q: 'Can students use it for both items and notes?',
    a: 'Absolutely. CampusSwap supports listings, notes exchange, requests, networking, and real-time chat in one app.'
  },
  {
    q: 'How is safety handled?',
    a: 'Moderation tools include reports queue, listing visibility controls, user actions, and admin review workflows.'
  }
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <PageTransition>
      <div className="min-h-screen relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <motion.div className="absolute -top-28 -left-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" animate={{ x: [0, 18, 0], y: [0, 10, 0] }} transition={{ duration: 10, repeat: Infinity }} />
          <motion.div className="absolute top-24 -right-20 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-3xl" animate={{ x: [0, -18, 0], y: [0, -10, 0] }} transition={{ duration: 12, repeat: Infinity }} />
          <motion.div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" animate={{ y: [0, -10, 0] }} transition={{ duration: 9, repeat: Infinity }} />
        </div>

        <motion.nav initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-50 border-b border-slate-200/20 bg-white/60 backdrop-blur-2xl">
          <div className="section-container py-4 flex justify-between items-center">
            <div className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-transparent">CampusSwap</div>
            <div className="flex gap-3">
              <Link to="/login" className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 transition">Login</Link>
              <Link to="/signup" className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-blue-500/30">Get Started</Link>
            </div>
          </div>
        </motion.nav>

        <section className="pt-16 pb-24 md:pt-24 md:pb-28">
          <div className="section-container grid lg:grid-cols-2 gap-12 items-center">
            <Stagger className="space-y-6">
              <StaggerItem><span className="chip">Trusted campus-only ecosystem</span></StaggerItem>
              <StaggerItem>
                <h1 className="text-hero-lg max-w-xl">
                  Student Marketplace,
                  <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent"> Networking, Notes</span>
                  {' '}and Real-Time Chat.
                </h1>
              </StaggerItem>
              <StaggerItem><p className="text-lg text-slate-600 max-w-lg leading-relaxed">CampusSwap brings buying, selling, borrowing, and peer collaboration into one premium student platform.</p></StaggerItem>
              <StaggerItem>
                <div className="flex flex-wrap gap-4">
                  <Link to="/signup" className="px-7 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-violet-500/25">Start Free</Link>
                  <Link to="/login" className="px-7 py-3 rounded-xl font-semibold border border-slate-300/40 bg-white/65 text-slate-700">Explore Demo</Link>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={10} suffix="K+" /></p><p className="text-[11px] text-slate-500">Campus users</p></div>
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={50} suffix="K+" /></p><p className="text-[11px] text-slate-500">Listings posted</p></div>
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={99} suffix="%" /></p><p className="text-[11px] text-slate-500">Safe exchanges</p></div>
                </div>
              </StaggerItem>
            </Stagger>

            <Reveal className="relative" y={0}>
              <div className="premium-card p-6 md:p-8">
                <div className="space-y-4">
                  {[
                    ['Macroeconomics Notes', 'PDF - Semester 4', 'INR 120'],
                    ['Scientific Calculator', 'Excellent - Hostel B', 'INR 700'],
                    ['Need Charger Tonight', 'Request - Urgent', 'Bounty INR 250']
                  ].map((card, idx) => (
                    <motion.div key={card[0]} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * idx }} whileHover={{ y: -4 }} className="rounded-2xl border border-slate-200/40 bg-white/80 p-4">
                      <p className="font-bold text-slate-900">{card[0]}</p>
                      <p className="text-sm text-slate-500 mt-1">{card[1]}</p>
                      <p className="text-sm font-semibold text-blue-600 mt-2">{card[2]}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="pb-20">
          <div className="section-container">
            <Reveal className="text-center mb-12"><h2 className="text-section-title">Built For A Real Student Ecosystem</h2></Reveal>
            <Stagger className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
              {[
                ['Marketplace', 'Sell, swap, and discover trusted student deals with premium search.'],
                ['Notes Exchange', 'Upload and discover academic notes with branch and semester filters.'],
                ['Real-Time Chat', 'Fast conversations, typing states, unread badges, and presence signals.'],
                ['Moderation Layer', 'Reports queue, admin actions, and safer campus interactions by design.']
              ].map((feature) => (
                <StaggerItem key={feature[0]} className="premium-card p-6">
                  <h3 className="text-feature-title">{feature[0]}</h3>
                  <p className="text-body-sm mt-2">{feature[1]}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="pb-20">
          <div className="section-container grid lg:grid-cols-3 gap-6">
            {[
              ['01', 'Create your profile', 'Join with your campus identity and unlock trusted interactions.'],
              ['02', 'Discover or post', 'List items, share notes, post requests, and browse instantly.'],
              ['03', 'Connect and close', 'Message peers in real time and complete safer exchanges.']
            ].map((step, idx) => (
              <Reveal key={step[0]} delay={idx * 0.08} className="premium-card p-6">
                <p className="text-4xl font-black bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">{step[0]}</p>
                <h3 className="mt-2 text-feature-title">{step[1]}</h3>
                <p className="text-body-sm mt-2">{step[2]}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="section-container grid lg:grid-cols-2 gap-8 items-start">
            <Reveal className="premium-card p-8">
              <h2 className="text-section-title text-4xl mb-4">About CampusSwap</h2>
              <p className="text-body-sm text-base">CampusSwap is designed as a student-first ecosystem, not just a listing board. It combines commerce, academic sharing, peer networking, and trusted moderation in one place.</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                {['Marketplace listings', 'Notes and resources', 'Direct student chat', 'Requests and bounties', 'Connections and profiles', 'Admin moderation flow'].map((feature) => (
                  <motion.div key={feature} whileHover={{ y: -2 }} className="premium-surface px-4 py-3 text-sm font-semibold">{feature}</motion.div>
                ))}
              </div>
            </Reveal>
            <Reveal className="premium-card p-8" delay={0.1}>
              <h3 className="text-feature-title text-2xl mb-4">Frequently Asked Questions</h3>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={faq.q} className="premium-surface p-4">
                    <button className="w-full text-left flex items-center justify-between" onClick={() => setOpenFaq((prev) => (prev === idx ? -1 : idx))}>
                      <span className="font-semibold">{faq.q}</span>
                      <span className="text-slate-500">{openFaq === idx ? '-' : '+'}</span>
                    </button>
                    {openFaq === idx && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-body-sm mt-3">{faq.a}</motion.p>}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="pb-20">
          <div className="section-container">
            <div className="premium-card p-8 md:p-10 text-center bg-gradient-to-r from-blue-600/95 via-violet-600/95 to-cyan-600/95 text-white border-0">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Ready to launch CampusSwap on your campus?</h2>
              <p className="mt-4 text-white/85 max-w-2xl mx-auto">From listings and notes to networking and moderation, this is a complete student platform foundation.</p>
              <div className="mt-8">
                <Link to="/signup" className="inline-flex rounded-xl bg-white text-slate-900 font-bold px-7 py-3">Create Account</Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-10 border-t border-slate-200/20">
          <div className="section-container grid md:grid-cols-4 gap-6">
            <div>
              <p className="font-black text-lg bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-transparent">CampusSwap</p>
              <p className="text-body-sm mt-2">Premium student ecosystem platform.</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Platform</p>
              <p className="text-body-sm">Marketplace</p>
              <p className="text-body-sm">Notes</p>
              <p className="text-body-sm">Chat</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Community</p>
              <p className="text-body-sm">Connections</p>
              <p className="text-body-sm">Requests</p>
              <p className="text-body-sm">Moderation</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Access</p>
              <p className="text-body-sm">Login</p>
              <p className="text-body-sm">Signup</p>
              <p className="text-body-sm">Admin</p>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
