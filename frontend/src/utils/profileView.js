export const INSTITUTION_NAME = 'Samrat Ashok Technological Institute, Vidisha';

export const getProfileInitials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

export const buildProfileForm = (profile = {}) => ({
  name: profile.name || '', bio: profile.bio || '',
  interests: (profile.interests || []).join(', '), skills: (profile.skills || []).join(', '),
  phoneNumber: profile.phoneNumber || '', whatsappNumber: profile.whatsappNumber || '',
  contactVisibility: profile.contactVisibility || 'connections'
});

export const buildProfileUpdate = (form) => ({
  name: form.name.trim(), bio: form.bio.trim(), phoneNumber: form.phoneNumber.trim(), whatsappNumber: form.whatsappNumber.trim(),
  contactVisibility: form.contactVisibility,
  interests: form.interests.split(',').map((value) => value.trim()).filter(Boolean),
  skills: form.skills.split(',').map((value) => value.trim()).filter(Boolean)
});

export const displayProfileValue = (value, fallback = 'Not available') => String(value || '').trim() || fallback;
