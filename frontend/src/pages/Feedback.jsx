import { useEffect, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { reportAPI } from '../services/api';

const categories = [
  ['feedback', 'General feedback'],
  ['abusive_chat', 'Abusive chat'],
  ['harassment', 'Harassment'],
  ['spam', 'Spam'],
  ['scam', 'Scam'],
  ['illegal_content', 'Unsafe content'],
  ['other', 'Other issue']
];

export default function Feedback() {
  const [reason, setReason] = useState('feedback');
  const [explanation, setExplanation] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMine = async () => {
    try {
      const response = await reportAPI.getMine();
      setSubmissions(response.data.data || []);
    } catch {
      setSubmissions([]);
    }
  };

  useEffect(() => {
    loadMine();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      await reportAPI.create({
        targetType: 'feedback',
        targetId: 'platform-feedback',
        reason,
        explanation
      });
      setStatus('Submitted to admin authority');
      setExplanation('');
      await loadMine();
    } catch (error) {
      setStatus(error.userMessage || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <main className="min-h-screen py-10">
          <div className="section-container grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <section>
              <p className="chip mb-4">Feedback and reports</p>
              <h1 className="text-section-title">Submit a report to admin authority.</h1>
              <p className="mt-3 max-w-2xl text-body-sm">
                Use this form for product feedback, abusive chat behavior, scams, spam, or unsafe content. Admins can review every submission from the moderation dashboard.
              </p>

              <PremiumCard className="mt-6" hover={false}>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Category</label>
                    <select className="premium-surface w-full px-4 py-3" value={reason} onChange={(event) => setReason(event.target.value)}>
                      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">Details</label>
                    <textarea
                      className="premium-surface w-full px-4 py-3"
                      rows="7"
                      placeholder="Explain what happened, who was involved, and what admin should review."
                      value={explanation}
                      onChange={(event) => setExplanation(event.target.value)}
                      required
                    />
                  </div>

                  {status && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{status}</p>}

                  <Button type="submit" variant="gradient" disabled={submitting}>
                    {submitting ? 'Submitting' : 'Submit to Admin'}
                  </Button>
                </form>
              </PremiumCard>
            </section>

            <aside>
              <PremiumCard hover={false}>
                <h2 className="text-feature-title mb-4">My submissions</h2>
                {submissions.length === 0 ? (
                  <p className="text-body-sm">No feedback or reports submitted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.slice(0, 8).map((item) => (
                      <div key={item._id} className="rounded-lg border border-slate-200/60 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold capitalize">{item.reason.replace('_', ' ')}</p>
                          <span className="chip">{item.status}</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-slate-500">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </PremiumCard>
            </aside>
          </div>
        </main>
      </Layout>
    </PageTransition>
  );
}
