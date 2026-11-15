import { normalizeInstitutionalEmail } from './institutionalEmail.js';

export const submitStudentRegistration = async ({ formData, registerStudent, navigate }) => {
  const registration = { ...formData, email: normalizeInstitutionalEmail(formData.email) };
  const response = await registerStudent(registration);
  navigate('/verify-email', { state: { email: registration.email, devMailPreviewToken: response.data.devMailPreviewToken } });
  return response;
};
