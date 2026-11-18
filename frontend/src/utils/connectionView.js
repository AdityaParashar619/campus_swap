export const getConnectionActionState = ({ connection, isSelf = false, restricted = false } = {}) => {
  if (isSelf) return 'self';
  if (restricted) return 'restricted';
  if (!connection || connection.status === 'rejected') return 'connect';
  if (connection.status === 'accepted') return 'connected';
  if (connection.status === 'pending' && connection.direction === 'incoming') return 'incoming';
  if (connection.status === 'pending') return 'outgoing';
  return 'restricted';
};

export const updateStudentRelationship = (students, studentId, connection) => students.map((student) => (
  student._id === studentId ? { ...student, connection } : student
));
