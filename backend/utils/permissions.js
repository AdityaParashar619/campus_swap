export const permissionsByRole = Object.freeze({
  student: ['profile:read:self', 'profile:update:self', 'campus:read', 'marketplace:use', 'community:use'],
  alumni: ['profile:read:self', 'profile:update:self', 'campus:read', 'community:use', 'alumni:use'],
  faculty: ['profile:read:self', 'profile:update:self', 'campus:read', 'academic:use'],
  department_coordinator: ['profile:read:self', 'profile:update:self', 'campus:read', 'academic:use', 'department:manage'],
  club_coordinator: ['profile:read:self', 'profile:update:self', 'campus:read', 'clubs:manage'],
  grievance_officer: ['profile:read:self', 'profile:update:self', 'grievances:review'],
  marketplace_moderator: ['profile:read:self', 'profile:update:self', 'marketplace:moderate'],
  college_admin: ['profile:read:self', 'profile:update:self', 'users:read', 'users:manage', 'verifications:review', 'institution:manage'],
  super_admin: ['*'],
  // Legacy administrators retain access to the existing moderation dashboard only.
  admin: ['profile:read:self', 'profile:update:self', 'users:read', 'users:block', 'marketplace:moderate', 'grievances:review']
});

export const getPermissions = (user) => [...(permissionsByRole[user.role] || [])];
export const hasPermission = (user, required) => {
  const permissions = getPermissions(user);
  return permissions.includes('*') || permissions.includes(required);
};
