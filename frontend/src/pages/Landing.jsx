import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CountUp, PageTransition, Reveal, Stagger, StaggerItem } from '../components/ui';
import satiCampus from '../assets/sati-campus.png';
import satiLogo from '../assets/sati-logo.jpg';

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
      <div className="relative min-h-screen overflow-hidden">
        <motion.nav initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.28)]">
          <div className="section-container flex items-center justify-between gap-3 py-3">
            <Link to="/" className="flex items-center gap-2">
              <img src={satiLogo} alt="SATI logo" className="h-10 w-10 rounded-lg border border-white/15 bg-white object-contain p-1" />
              <span className="leading-tight">
                <span className="block text-lg font-black tracking-tight">CampusSwap</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-300 sm:block">Samrat Ashok Technological Institute</span>
              </span>
            </Link>
            <div className="flex shrink-0 gap-2 sm:gap-3">
              <Link to="/login" className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 sm:px-4">Login</Link>
              <Link to="/signup" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300 sm:px-5">Get Started</Link>
            </div>
          </div>
        </motion.nav>

        <section className="border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.10),rgba(255,255,255,0)_32%),linear-gradient(315deg,rgba(245,158,11,0.10),rgba(255,255,255,0)_36%)] pb-24 pt-16 md:pb-28 md:pt-24">
          <div className="section-container grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <Stagger className="space-y-6">
              <StaggerItem><span className="chip">SATI verified campus-only ecosystem</span></StaggerItem>
              <StaggerItem>
                <h1 className="text-hero-lg max-w-xl">
                  CampusSwap Student Marketplace,
                  <span className="bg-gradient-to-r from-teal-700 via-blue-700 to-amber-600 bg-clip-text text-transparent"> Networking, Notes</span>
                  {' '}and Real-Time Chat.
                </h1>
              </StaggerItem>
              <StaggerItem><p className="max-w-lg text-lg leading-relaxed text-slate-600">Built for Samrat Ashok Technological Institute (SATI), Vidisha: buying, selling, borrowing, reports, and peer collaboration in one student platform.</p></StaggerItem>
              <StaggerItem>
                <div className="flex flex-wrap gap-4">
                  <Link to="/signup" className="rounded-lg bg-slate-950 px-7 py-3 font-black text-white shadow-lg shadow-slate-950/20">Start Free</Link>
                  <Link to="/login" className="rounded-lg border border-slate-300/70 bg-white px-7 py-3 font-bold text-slate-800 shadow-sm hover:bg-slate-50">Explore Demo</Link>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="grid max-w-md grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={10} suffix="K+" /></p><p className="text-[11px] text-slate-500">Campus users</p></div>
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={50} suffix="K+" /></p><p className="text-[11px] text-slate-500">Listings posted</p></div>
                  <div className="premium-card p-3 text-center"><p className="text-xl font-extrabold"><CountUp to={99} suffix="%" /></p><p className="text-[11px] text-slate-500">Safe exchanges</p></div>
                </div>
              </StaggerItem>
            </Stagger>

            <Reveal className="relative" y={0}>
              <div className="premium-card border-slate-200/80 bg-white p-6 md:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <p className="font-bold text-slate-900">Live campus board</p>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Verified</span>
                </div>
                <div className="space-y-4">
                  {[
                    ['Macroeconomics Notes', 'PDF - Semester 4', 'INR 120'],
                    ['Scientific Calculator', 'Excellent - Hostel B', 'INR 700'],
                    ['Need Charger Tonight', 'Request - Urgent', 'Bounty INR 250']
                  ].map((card, idx) => (
                    <motion.div key={card[0]} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * idx }} whileHover={{ y: -4 }} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="font-bold text-slate-900">{card[0]}</p>
                      <p className="text-sm text-slate-500 mt-1">{card[1]}</p>
                      <p className="mt-2 text-sm font-bold text-teal-700">{card[2]}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden py-20">
          <img src={satiCampus} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.14]" />
          <div className="absolute inset-0 bg-white/82 backdrop-blur-[1px] dark:bg-slate-950/86" />
          <div className="section-container relative z-10">
            <Reveal className="text-center mb-12">
              <p className="chip mb-4">For SATI Vidisha</p>
              <h2 className="text-section-title">Built For A Real Student Ecosystem</h2>
            </Reveal>
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
                <p className="bg-gradient-to-r from-teal-700 via-blue-700 to-amber-600 bg-clip-text text-4xl font-black text-transparent">{step[0]}</p>
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
            <div className="premium-card border-0 bg-slate-950 p-8 text-center text-white md:p-10">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Ready to launch CampusSwap on your campus?</h2>
              <p className="mt-4 text-white/85 max-w-2xl mx-auto">From listings and notes to networking and moderation, this is a complete student platform foundation.</p>
              <div className="mt-8">
                <Link to="/signup" className="inline-flex rounded-lg bg-amber-400 px-7 py-3 font-black text-slate-950 hover:bg-amber-300">Create Account</Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-800 bg-slate-950 py-10 text-white">
          <div className="section-container grid md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2">
                <img src={satiLogo} alt="SATI logo" className="h-10 w-10 rounded-lg border border-white/15 bg-white object-contain p-1" />
                <p className="text-lg font-black text-white">CampusSwap</p>
              </div>
              <p className="mt-2 text-sm text-slate-300">For Samrat Ashok Technological Institute, Vidisha.</p>
              <a className="mt-3 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100" href="https://www.satiengg.in/" target="_blank" rel="noreferrer">
                SATI College Verified
              </a>
            </div>
            <div>
              <p className="font-semibold mb-2">Platform</p>
              <p className="text-sm text-slate-300">Marketplace</p>
              <p className="text-sm text-slate-300">Notes</p>
              <p className="text-sm text-slate-300">Chat</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Community</p>
              <p className="text-sm text-slate-300">Connections</p>
              <p className="text-sm text-slate-300">Requests</p>
              <p className="text-sm text-slate-300">Moderation</p>
            </div>
            <div>
              <p className="font-semibold mb-2">Access</p>
              <p className="text-sm text-slate-300">Login</p>
              <p className="text-sm text-slate-300">Signup</p>
              <p className="text-sm text-slate-300">Admin</p>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
