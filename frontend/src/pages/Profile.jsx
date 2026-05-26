import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../services/api';

const emptyProfile = {
  name: '',
  collegeName: '',
  course: '',
  yearSemester: '',
  bio: '',
  interests: '',
  skills: '',
  profilePicture: ''
};

export default function Profile() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [stats, setStats] = useState({ listingsCount: 0, notesCount: 0, requestsCount: 0, connectionsCount: 0, messagesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const avatarUrl = (profile.profilePicture || user?.profilePicture || '').trim();
  const displayName = profile.name || user?.name || 'Student';
  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    (async () => {
      try {
        const response = await authAPI.getMe();
        const me = response.data.data;
        setProfile({
          name: me.name || '',
          collegeName: me.collegeName || '',
          course: me.course || '',
          yearSemester: me.yearSemester || '',
          bio: me.bio || '',
          interests: (me.interests || []).join(', '),
          skills: (me.skills || []).join(', '),
          profilePicture: me.profilePicture || ''
        });
        setStats(response.data.stats || stats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...profile,
        profilePicture: profile.profilePicture.trim(),
        interests: profile.interests.split(',').map((v) => v.trim()).filter(Boolean),
        skills: profile.skills.split(',').map((v) => v.trim()).filter(Boolean)
      };
      const response = await authAPI.updateMe(payload);
      const updated = response.data.data;
      const token = localStorage.getItem('token');
      if (token) login(updated, token);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <Layout>
        <div className="min-h-screen py-10">
          <div className="section-container">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h1 className="text-section-title mb-2">Your Student Profile</h1>
              <p className="text-body-sm">Build trust, showcase skills, and grow your campus network.</p>
            </motion.div>

            {loading ? (
              <div className="grid md:grid-cols-2 gap-6"><div className="skeleton h-96" /><div className="skeleton h-96" /></div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                <PremiumCard className="lg:col-span-1">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center text-white text-3xl font-black mb-4 overflow-hidden ring-4 ring-white/70 shadow-xl">
                      {avatarUrl && !avatarFailed ? (
                        <img
                          src={avatarUrl}
                          alt={`${displayName} profile`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        <span>{initials || '?'}</span>
                      )}
                    </div>
                    <h2 className="text-feature-title mb-1">{displayName}</h2>
                    <p className="text-body-sm">{user?.email}</p>
                    <div className="mt-4 text-xs inline-flex px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Trust Score: {user?.trustScore ?? 0}</div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      ['Listings', stats.listingsCount],
                      ['Notes Shared', stats.notesCount],
                      ['Requests', stats.requestsCount],
                      ['Connections', stats.connectionsCount],
                      ['Messages', stats.messagesCount]
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </PremiumCard>

                <PremiumCard className="lg:col-span-2">
                  <form onSubmit={saveProfile} className="grid md:grid-cols-2 gap-4">
                    {[
                      ['name', 'Full Name'],
                      ['collegeName', 'College Name'],
                      ['course', 'Course / Branch'],
                      ['yearSemester', 'Year / Semester'],
                      ['profilePicture', 'Profile Image URL']
                    ].map(([key, label]) => (
                      <input
                        key={key}
                        value={profile[key]}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={label}
                        className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/60"
                      />
                    ))}

                    <p className="md:col-span-2 -mt-2 text-xs text-slate-500">
                      Use a public direct image link, such as a JPG, PNG, or WebP URL.
                    </p>

                    <textarea
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Bio / About"
                      rows="3"
                      className="md:col-span-2 px-4 py-3 rounded-xl border border-slate-300/30 bg-white/60"
                    />

                    <input
                      value={profile.interests}
                      onChange={(e) => setProfile({ ...profile, interests: e.target.value })}
                      placeholder="Interests (comma separated)"
                      className="md:col-span-2 px-4 py-3 rounded-xl border border-slate-300/30 bg-white/60"
                    />
                    <input
                      value={profile.skills}
                      onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                      placeholder="Skills (comma separated)"
                      className="md:col-span-2 px-4 py-3 rounded-xl border border-slate-300/30 bg-white/60"
                    />

                    <Button type="submit" variant="gradient" className="md:col-span-2">{saving ? 'Saving...' : 'Save Profile'}</Button>
                  </form>
                </PremiumCard>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </PageTransition>
  );
}
