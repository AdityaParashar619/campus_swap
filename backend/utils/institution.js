export const INSTITUTION_NAME = 'Samrat Ashok Technological Institute, Vidisha';

export const academicProfile = (user = {}) => ({
  collegeName: INSTITUTION_NAME,
  course: user.branch || user.course || '',
  yearSemester: user.semester || user.yearSemester || ''
});
