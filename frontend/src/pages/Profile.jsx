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

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;

const resizeProfileImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Please select a valid image file.'));
    return;
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    reject(new Error('Image must be smaller than 5 MB.'));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSize = 512;
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Could not process this image.'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => reject(new Error('Could not read this image.'));
    image.src = reader.result;
  };
  reader.onerror = () => reject(new Error('Could not read this file.'));
  reader.readAsDataURL(file);
});

export default function Profile() {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [stats, setStats] = useState({ listingsCount: 0, notesCount: 0, requestsCount: 0, connectionsCount: 0, messagesCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState('');

  const avatarUrl = (profile.profilePicture || user?.profilePicture || '').trim();
  const hasUploadedAvatar = avatarUrl.startsWith('data:image/');
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

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageProcessing(true);
    setImageError('');
    try {
      const imageDataUrl = await resizeProfileImage(file);
      setProfile((current) => ({ ...current, profilePicture: imageDataUrl }));
    } catch (error) {
      setImageError(error.message || 'Could not upload this image.');
    } finally {
      setImageProcessing(false);
      event.target.value = '';
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
                      ['yearSemester', 'Year / Semester']
                    ].map(([key, label]) => (
                      <input
                        key={key}
                        value={profile[key]}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={label}
                        className="px-4 py-3 rounded-xl border border-slate-300/30 bg-white/60"
                      />
                    ))}

                    <div className="md:col-span-2 rounded-2xl border border-slate-300/30 bg-white/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Profile photo</p>
                          <p className="text-xs text-slate-500">Upload JPG, PNG, or WebP. Large photos are resized automatically.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                          {imageProcessing ? 'Processing...' : 'Choose image'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleProfileImageUpload}
                            disabled={imageProcessing}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      {hasUploadedAvatar ? (
                        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm font-medium text-emerald-800">Uploaded image ready. Save profile to keep it.</span>
                          <button
                            type="button"
                            onClick={() => setProfile({ ...profile, profilePicture: '' })}
                            className="text-left text-sm font-semibold text-rose-600 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <input
                          value={profile.profilePicture}
                          onChange={(e) => {
                            setImageError('');
                            setProfile({ ...profile, profilePicture: e.target.value });
                          }}
                          placeholder="Or paste a public image URL"
                          className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-300/40 bg-white/70 text-sm"
                        />
                      )}
                      {imageError ? <p className="mt-2 text-xs font-medium text-rose-600">{imageError}</p> : null}
                    </div>

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
