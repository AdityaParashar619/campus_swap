import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { noteAPI } from '../services/api';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [previewNote, setPreviewNote] = useState(null);
  const [bookmarked, setBookmarked] = useState({});
  const [filters, setFilters] = useState({ search: '', branch: '', semester: '' });
  const [formData, setFormData] = useState({ title: '', description: '', fileUrl: '', branch: '', semester: '', subject: '' });

  const loadNotes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.branch) params.branch = filters.branch;
      if (filters.semester) params.semester = filters.semester;

      const response = await noteAPI.getAll(params);
      setNotes(response.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [filters.branch, filters.semester]);

  const visibleNotes = useMemo(() => {
    if (!filters.search) return notes;
    const q = filters.search.toLowerCase();
    return notes.filter((n) => `${n.title} ${n.subject} ${n.branch}`.toLowerCase().includes(q));
  }, [notes, filters.search]);

  const createNote = async (e) => {
    e.preventDefault();
    await noteAPI.create(formData);
    setFormData({ title: '', description: '', fileUrl: '', branch: '', semester: '', subject: '' });
    setShowForm(false);
    loadNotes();
  };

  const toggleBookmark = async (id) => {
    await noteAPI.toggleBookmark(id);
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isPdf = (url) => url?.toLowerCase().includes('.pdf');

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-section-title">Notes Exchange</h1>
                <p className="text-body-sm">Search, filter, preview, and bookmark academic resources.</p>
              </div>
              <Button variant="gradient" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'Upload Note'}</Button>
            </div>

            <PremiumCard className="mb-6">
              <div className="grid md:grid-cols-3 gap-3">
                <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search title, subject, branch" className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/70" />
                <input value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} placeholder="Filter by branch" className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/70" />
                <input value={filters.semester} onChange={(e) => setFilters({ ...filters, semester: e.target.value })} placeholder="Filter by semester" className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/70" />
              </div>
            </PremiumCard>

            {showForm && (
              <PremiumCard className="mb-8">
                <form onSubmit={createNote} className="grid md:grid-cols-2 gap-4">
                  {[
                    ['title', 'Title'],
                    ['subject', 'Subject'],
                    ['branch', 'Branch'],
                    ['semester', 'Semester'],
                    ['fileUrl', 'File URL']
                  ].map(([key, label]) => (
                    <input key={key} required value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={label} className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/70" />
                  ))}
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" className="md:col-span-2 px-4 py-3 rounded-xl border border-slate-300/30 bg-white/70" rows="3" />
                  <Button type="submit" variant="gradient">Publish Note</Button>
                </form>
              </PremiumCard>
            )}

            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-44" />)}</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {visibleNotes.map((note) => (
                  <motion.div key={note._id} whileHover={{ y: -4 }}>
                    <PremiumCard>
                      <h3 className="text-feature-title mb-2">{note.title}</h3>
                      <p className="text-body-sm mb-2">{note.subject} • {note.branch} • Sem {note.semester}</p>
                      <p className="text-body-sm mb-4 line-clamp-2">{note.description || 'No description provided.'}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => setPreviewNote(note)}>Preview</Button>
                        <a href={note.fileUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Open</a>
                        <Button size="sm" variant={bookmarked[note._id] ? 'gradient' : 'secondary'} onClick={() => toggleBookmark(note._id)}>
                          {bookmarked[note._id] ? 'Bookmarked' : 'Bookmark'}
                        </Button>
                      </div>
                    </PremiumCard>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {previewNote && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="premium-card w-full max-w-4xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Preview: {previewNote.title}</h3>
                <Button size="sm" variant="secondary" onClick={() => setPreviewNote(null)}>Close</Button>
              </div>
              <div className="h-[70vh] rounded-xl overflow-hidden border border-slate-200/30 bg-white">
                {isPdf(previewNote.fileUrl) ? (
                  <iframe src={previewNote.fileUrl} title="Note preview" className="w-full h-full" />
                ) : (
                  <img src={previewNote.fileUrl} alt={previewNote.title} className="w-full h-full object-contain" />
                )}
              </div>
            </div>
          </div>
        )}
      </Layout>
    </PageTransition>
  );
}
