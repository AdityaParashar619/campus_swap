import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTransition } from '../components/ui';
import { authAPI, getApiErrorMessage } from '../services/api';
import { getPasswordPolicy, isPasswordStrong } from '../utils/passwordPolicy';
import { isValidInstitutionalEmail } from '../utils/institutionalEmail';
import { submitStudentRegistration } from '../utils/studentRegistration';

const initial = { name: '', email: '', enrollmentNumber: '', department: '', branch: '', semester: '', phoneNumber: '', graduationYear: '', previousEnrollmentNumber: '', company: '', jobTitle: '', password: '', confirmPassword: '' };

export default function Signup() {
  const [kind, setKind] = useState('student');
  const [formData, setFormData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordPolicy = getPasswordPolicy(formData.password);
  const emailValid = kind !== 'student' || !formData.email || isValidInstitutionalEmail(formData.email);
  const navigate = useNavigate();
  const set = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (kind === 'student' && !isValidInstitutionalEmail(formData.email)) throw new Error('Enter a valid SATI student email, for example example27cs987@satiengg.in.');
      if (!isPasswordStrong(formData.password)) throw new Error('Password must be 8–128 characters and include uppercase, lowercase, a number, and a special character.');
      if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match.');
      if (kind === 'student') {
        await submitStudentRegistration({ formData, registerStudent: authAPI.registerStudent, navigate });
      } else {
        const response = await authAPI.registerAlumni(formData);
        navigate('/account-status', { state: { message: 'Your alumni verification request is pending institutional review.', devMailPreviewToken: response.data.devMailPreviewToken } });
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const fields = kind === 'student'
    ? [['name', 'Full name', 'text'], ['email', 'College email', 'email'], ['enrollmentNumber', 'Enrollment number', 'text'], ['department', 'Department', 'text'], ['branch', 'Branch', 'text'], ['semester', 'Current semester/year', 'text'], ['phoneNumber', 'Phone number', 'tel']]
    : [['name', 'Full name', 'text'], ['email', 'Personal email', 'email'], ['graduationYear', 'Graduation year', 'number'], ['department', 'Department', 'text'], ['branch', 'Branch', 'text'], ['previousEnrollmentNumber', 'Previous enrollment number (optional)', 'text'], ['company', 'Company or organization (optional)', 'text'], ['jobTitle', 'Current role (optional)', 'text']];

  return (
    <PageTransition>
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center px-4 py-8">
        <section className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create an account</h1>
          <p className="text-gray-600 mb-5">Join your campus community.</p>
          <div className="grid grid-cols-2 gap-2 mb-5" role="group" aria-label="Account type">
            {['student', 'alumni'].map((value) => <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} className={`rounded-lg py-2 font-semibold capitalize ${kind === value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{value}</button>)}
          </div>
          {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {fields.map(([name, label, type]) => <label key={name} className="block text-sm font-medium text-gray-700">{label}<input name={name} type={type} value={formData[name]} onChange={set} required={!name.includes('optional')} min={name === 'graduationYear' ? 1950 : undefined} max={name === 'graduationYear' ? new Date().getFullYear() + 1 : undefined} aria-invalid={name === 'email' && kind === 'student' && !emailValid} className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />{name === 'email' && kind === 'student' && formData.email && !emailValid && <span className="mt-1 block text-sm text-red-700">Use the SATI format, such as example27cs987@satiengg.in.</span>}</label>)}
            <label className="block text-sm font-medium text-gray-700">Password<input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={set} minLength={8} maxLength={128} autoComplete="new-password" required aria-describedby="signup-password-policy" className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /><span id="signup-password-policy" className="mt-2 block text-xs font-normal text-gray-600">Use at least 8 characters with an uppercase letter, lowercase letter, number, and special character.</span><ul className="mt-1 grid grid-cols-2 gap-x-2 text-xs font-normal" aria-live="polite">{[['minLength', '8+ characters'], ['uppercase', 'Uppercase letter'], ['lowercase', 'Lowercase letter'], ['number', 'Number'], ['special', 'Special character']].map(([rule, label]) => <li key={rule} className={passwordPolicy[rule] ? 'text-green-700' : 'text-gray-500'}>{passwordPolicy[rule] ? '✓' : '○'} {label}</li>)}</ul></label>
            <label className="block text-sm font-medium text-gray-700">Confirm password<input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={set} minLength={8} maxLength={128} autoComplete="new-password" required aria-invalid={Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword} className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />{formData.confirmPassword && formData.password !== formData.confirmPassword && <span className="mt-1 block text-sm text-red-700">Passwords do not match.</span>}</label>
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show password</label>
            <button disabled={loading || (kind === 'student' && !emailValid)} className="sm:col-span-2 w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Submitting…' : kind === 'student' ? 'Continue to email verification' : 'Request alumni verification'}</button>
          </form>
          <p className="text-center text-gray-600 mt-5">Already registered? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Login</Link></p>
        </section>
      </main>
    </PageTransition>
  );
}
