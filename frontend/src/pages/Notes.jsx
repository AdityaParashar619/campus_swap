import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { getApiErrorMessage, noteAPI } from '../services/api';

const safeHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [previewNote, setPreviewNote] = useState(null);
  const [bookmarked, setBookmarked] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({ search: '', branch: '', semester: '' });
  const [formData, setFormData] = useState({ title: '', description: '', fileUrl: '', branch: '', semester: '', subject: '' });

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.branch) params.branch = filters.branch;
      if (filters.semester) params.semester = filters.semester;

      const response = await noteAPI.getAll(params);
      setNotes(response.data.data || []);
      setBookmarked(Object.fromEntries((response.data.data || []).map((note) => [note._id, Boolean(note.isBookmarked)])));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Notes could not be loaded.'));
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
    setSubmitting(true);
    setError('');
    try {
      await noteAPI.create(formData);
      setFormData({ title: '', description: '', fileUrl: '', branch: '', semester: '', subject: '' });
      setShowForm(false);
      await loadNotes();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Note could not be published.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBookmark = async (id) => {
    setError('');
    try {
      const response = await noteAPI.toggleBookmark(id);
      setBookmarked((prev) => ({ ...prev, [id]: response.data.bookmarked }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Bookmark could not be updated.'));
    }
  };

  const openPreview = (note) => {
    if (safeHttpsUrl(note.fileUrl)) setPreviewNote(note);
    else setError('This preserved note has an unsafe or unavailable file URL and cannot be opened.');
  };

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

            {error && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

            <PremiumCard className="mb-6">
              <div className="grid md:grid-cols-3 gap-3">
                <input aria-label="Search notes" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search title, subject, branch" className="form-control" />
                <input aria-label="Filter by branch" value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} placeholder="Filter by branch" className="form-control" />
                <select aria-label="Filter by semester" value={filters.semester} onChange={(e) => setFilters({ ...filters, semester: e.target.value })} className="form-control"><option value="">All semesters</option>{[1,2,3,4,5,6,7,8].map((value) => <option key={value}>{value}</option>)}</select>
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
                    <input key={key} aria-label={label} type={key === 'fileUrl' ? 'url' : 'text'} required value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder={label} className="form-control" />
                  ))}
                  <textarea aria-label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" className="form-control md:col-span-2" rows="3" />
                  <Button type="submit" variant="gradient" disabled={submitting}>{submitting ? 'Publishing…' : 'Publish Note'}</Button>
                </form>
              </PremiumCard>
            )}

            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-44" />)}</div>
            ) : (
              visibleNotes.length === 0 ? <PremiumCard hover={false}><p className="text-body-sm">No notes match these filters.</p></PremiumCard> : <div className="grid md:grid-cols-2 gap-6">
                {visibleNotes.map((note) => (
                  <motion.div key={note._id} whileHover={{ y: -4 }}>
                    <PremiumCard>
                      <h3 className="text-feature-title mb-2">{note.title}</h3>
                      <p className="text-body-sm mb-2">{note.subject} · {note.branch} · Semester {note.semester}</p>
                      <p className="text-body-sm mb-4 line-clamp-2">{note.description || 'No description provided.'}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => openPreview(note)} disabled={!safeHttpsUrl(note.fileUrl)}>Preview</Button>
                        {safeHttpsUrl(note.fileUrl) && <a href={safeHttpsUrl(note.fileUrl)} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Open</a>}
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
          <div role="dialog" aria-modal="true" aria-labelledby="note-preview-title" className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="premium-card w-full max-w-4xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 id="note-preview-title" className="font-semibold">Preview: {previewNote.title}</h3>
                <Button size="sm" variant="secondary" onClick={() => setPreviewNote(null)}>Close</Button>
              </div>
              <div className="h-[70vh] rounded-xl overflow-hidden border border-slate-200/30 bg-white">
                {previewNote.fileType === 'image' ? <img src={safeHttpsUrl(previewNote.fileUrl)} alt={previewNote.title} className="w-full h-full object-contain" /> : <iframe sandbox="" referrerPolicy="no-referrer" src={safeHttpsUrl(previewNote.fileUrl)} title="Note preview" className="w-full h-full" />}
              </div>
            </div>
          </div>
        )}
      </Layout>
    </PageTransition>
  );
}
