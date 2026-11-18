import { useEffect, useRef, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { useAuth } from '../hooks/useAuth';
import { authAPI } from '../services/api';
import { buildProfileForm, buildProfileUpdate, displayProfileValue, getProfileInitials, INSTITUTION_NAME } from '../utils/profileView';
import { getPasswordPolicy, isPasswordStrong } from '../utils/passwordPolicy';

export default function Profile() {
  const { user, applyProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(buildProfileForm());
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirmPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const saveLock = useRef(false);

  const loadProfile = async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await authAPI.getMe();
      const authoritative = response.data.data;
      setProfile(authoritative); setForm(buildProfileForm(authoritative)); setStats(response.data.stats || {});
      applyProfile({ ...user, ...authoritative }, response.data.stats || {});
    } catch (error) { setLoadError(error.userMessage || 'Profile could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadProfile(); }, []);

  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const saveProfile = async (event) => {
    event.preventDefault();
    if (saveLock.current) return;
    const payload = buildProfileUpdate(form);
    if (!payload.name || payload.name.length > 60) { setMessage('Name must be between 1 and 60 characters.'); return; }
    if (payload.bio.length > 300) { setMessage('Bio must be 300 characters or fewer.'); return; }
    saveLock.current = true; setSaving(true); setMessage('');
    try {
      const response = await authAPI.updateMe(payload);
      const updated = response.data.data;
      setProfile(updated); setForm(buildProfileForm(updated)); applyProfile({ ...user, ...updated });
      setMessage('Profile saved successfully.');
    } catch (error) { setMessage(error.userMessage || 'Profile could not be saved. Your edits are preserved.'); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setAvatarError('Choose a JPEG, PNG, or WebP image up to 2 MB.'); return; }
    setAvatarBusy(true); setAvatarError('');
    try {
      const response = await authAPI.uploadAvatar(file); const updated = response.data.data;
      setProfile(updated); applyProfile({ ...user, ...updated });
    } catch (error) { setAvatarError(error.userMessage || 'Profile image could not be uploaded.'); }
    finally { setAvatarBusy(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setPasswordMessage('');
    if (!isPasswordStrong(passwordForm.password) || passwordForm.password !== passwordForm.confirmPassword) { setPasswordMessage('Use a strong password and ensure both new-password fields match.'); return; }
    setPasswordBusy(true);
    try { await authAPI.updatePassword(passwordForm); setPasswordForm({ currentPassword: '', password: '', confirmPassword: '' }); setPasswordMessage('Password updated. Other sessions were revoked.'); }
    catch (error) { setPasswordMessage(error.userMessage || 'Password could not be updated.'); }
    finally { setPasswordBusy(false); }
  };
  const policy = getPasswordPolicy(passwordForm.password);

  return <PageTransition><Layout><div className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-6xl space-y-6">
    <div><h1 className="text-section-title">Profile & account settings</h1><p className="text-body-sm mt-1">Your verified registration details stay synchronized automatically.</p></div>
    {loading ? <div className="grid gap-5 lg:grid-cols-3"><div className="skeleton h-72" /><div className="skeleton h-72 lg:col-span-2" /></div> : loadError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{loadError} <button className="font-bold underline" onClick={loadProfile}>Retry</button></div> : <>
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <PremiumCard hover={false}><div className="text-center"><div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-2xl bg-blue-600 text-3xl font-black text-white">{profile.profilePicture ? <img src={profile.profilePicture} alt={`${profile.name} profile`} className="h-full w-full object-cover" /> : getProfileInitials(profile.name)}</div><h2 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{profile.name}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{displayProfileValue(profile.branch, 'Branch not available')} · {displayProfileValue(profile.semester, 'Semester not available')}</p><p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{INSTITUTION_NAME}</p><label className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{avatarBusy ? 'Uploading…' : 'Change profile picture'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy} onChange={uploadAvatar} /></label>{avatarError && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{avatarError}</p>}</div></PremiumCard>
        <PremiumCard hover={false}><h2 className="text-feature-title">Academic information</h2><p className="text-body-sm mt-1">Verified registration fields are protected from profile editing.</p><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Enrollment number', profile.enrollmentNumber], ['Institutional email', profile.email], ['Branch', profile.branch], ['Department', profile.department], ['Semester / year', profile.semester], ['College', profile.collegeName || INSTITUTION_NAME]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-700"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{displayProfileValue(value)}</dd></div>)}</dl></PremiumCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <PremiumCard hover={false}><h2 className="text-feature-title">Edit profile</h2><form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input className="form-control mt-1" value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} required /></label><label className="text-sm font-semibold">Contact visibility<select className="form-control mt-1" value={form.contactVisibility} onChange={(e) => set('contactVisibility', e.target.value)}><option value="connections">Show contacts to connections</option><option value="private">Keep contacts private</option></select></label><label className="text-sm font-semibold">Phone number<input className="form-control mt-1" value={form.phoneNumber} maxLength={20} onChange={(e) => set('phoneNumber', e.target.value)} /></label><label className="text-sm font-semibold">WhatsApp number<input className="form-control mt-1" value={form.whatsappNumber} maxLength={20} onChange={(e) => set('whatsappNumber', e.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Bio<textarea className="form-control mt-1 min-h-28" value={form.bio} maxLength={300} onChange={(e) => set('bio', e.target.value)} /><span className="mt-1 block text-right text-xs text-slate-500">{form.bio.length}/300</span></label><label className="text-sm font-semibold sm:col-span-2">Interests, comma separated<input className="form-control mt-1" value={form.interests} onChange={(e) => set('interests', e.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Skills, comma separated<input className="form-control mt-1" value={form.skills} onChange={(e) => set('skills', e.target.value)} /></label>{message && <p role="status" className={`sm:col-span-2 text-sm ${message.includes('successfully') ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{message}</p>}<Button type="submit" disabled={saving} className="sm:col-span-2">{saving ? 'Saving…' : 'Save profile'}</Button></form></PremiumCard>
        <PremiumCard hover={false}><h2 className="text-feature-title">Activity</h2><dl className="mt-4 space-y-3">{[['Listings', stats.listingsCount], ['Notes shared', stats.notesCount], ['Requests', stats.requestsCount], ['Connections', stats.connectionsCount], ['Messages', stats.messagesCount]].map(([label, value]) => <div key={label} className="flex justify-between text-sm"><dt className="text-slate-600 dark:text-slate-300">{label}</dt><dd className="font-bold">{value || 0}</dd></div>)}</dl></PremiumCard>
      </div>
      <PremiumCard hover={false}><h2 className="text-feature-title">Security</h2><p className="text-body-sm mt-1">Changing your password revokes other active sessions.</p><form onSubmit={changePassword} className="mt-5 grid gap-4 md:grid-cols-3">{[['currentPassword','Current password','current-password'],['password','New password','new-password'],['confirmPassword','Confirm new password','new-password']].map(([field,label,autoComplete]) => <label key={field} className="text-sm font-semibold">{label}<input type="password" className="form-control mt-1" autoComplete={autoComplete} minLength={field === 'currentPassword' ? undefined : 8} maxLength={128} required value={passwordForm[field]} onChange={(e) => setPasswordForm((current) => ({ ...current, [field]: e.target.value }))} /></label>)}<p className="text-xs text-slate-500 md:col-span-3">Password strength: {Object.values(policy).filter(Boolean).length}/5 requirements met.</p>{passwordMessage && <p role="status" className="text-sm md:col-span-3">{passwordMessage}</p>}<Button type="submit" disabled={passwordBusy} className="md:col-span-3">{passwordBusy ? 'Updating…' : 'Update password'}</Button></form></PremiumCard>
    </>}
  </div></div></Layout></PageTransition>;
}
