import { Link } from 'react-router-dom';
import { PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';

const steps = [
  ['Create your profile', 'Sign up with student details, add your course, semester, skills, interests, and campus context so other students know who they are dealing with.'],
  ['Post or discover', 'Use Marketplace for items, Notes for academic material, Requests for borrowing or help, and Network for student connections.'],
  ['Connect before exchanging', 'Send a connection request, wait for the other student to accept, then use chat to agree on price, timing, location, or academic help.'],
  ['Use reports when needed', 'If a student behaves badly in chat or posts unsafe content, submit a report. Admins can review, warn, block users, or hide listings.']
];

const areas = [
  ['Marketplace', 'Create item listings with condition, price, availability, and owner controls. The listing owner can manage or delete their own listing.'],
  ['Requests', 'Post borrowing or help requests. Other students can respond, and the owner can accept a response when the request is fulfilled.'],
  ['Network', 'Incoming requests appear separately so students can accept or reject. Sent requests stay pending until the recipient responds.'],
  ['Notifications', 'Message and connection notifications include direct actions so students can jump into the right screen quickly.'],
  ['Admin authority', 'Admin users can see reports, review abusive behavior, block users, hide listings, and dismiss invalid reports.']
];

export default function About() {
  return (
    <PageTransition>
      <Layout>
        <main className="min-h-screen py-10">
          <div className="section-container space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="chip mb-4">How CampusSwap works</p>
                <h1 className="text-section-title">A campus-first system for exchange, help, notes, and safer student communication.</h1>
                <p className="mt-5 max-w-3xl text-body-sm">
                  CampusSwap is built around trust between students. Every major action has a clear owner: listing owners control their listings,
                  request owners decide when a request is fulfilled, recipients confirm connection requests, and admins handle reports.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link className="rounded-lg bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20" to="/listings">Explore marketplace</Link>
                  <Link className="rounded-lg bg-slate-200 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600" to="/feedback">Submit feedback</Link>
                </div>
              </div>

              <PremiumCard hover={false} className="bg-slate-950 text-white">
                <p className="text-sm font-semibold text-cyan-200">Student safety loop</p>
                <div className="mt-5 space-y-4">
                  {['Connect', 'Chat', 'Exchange', 'Report if needed', 'Admin review'].map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-black">{index + 1}</span>
                      <span className="font-semibold">{item}</span>
                    </div>
                  ))}
                </div>
              </PremiumCard>
            </section>

            <section>
              <h2 className="text-feature-title mb-4">Student Tutorial</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {steps.map(([title, body], index) => (
                  <PremiumCard key={title} hover={false}>
                    <span className="chip mb-4">Step {index + 1}</span>
                    <h3 className="text-feature-title">{title}</h3>
                    <p className="mt-3 text-body-sm">{body}</p>
                  </PremiumCard>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-feature-title mb-4">What Each Area Does</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {areas.map(([title, body]) => (
                  <PremiumCard key={title} hover={false}>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-2 text-body-sm">{body}</p>
                  </PremiumCard>
                ))}
              </div>
            </section>
          </div>
        </main>
      </Layout>
    </PageTransition>
  );
}
