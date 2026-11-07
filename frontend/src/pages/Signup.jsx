import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTransition } from '../components/ui';
import { authAPI, getApiErrorMessage } from '../services/api';

const initial = { name: '', email: '', enrollmentNumber: '', department: '', branch: '', semester: '', phoneNumber: '', graduationYear: '', previousEnrollmentNumber: '', company: '', jobTitle: '', password: '', confirmPassword: '' };

export default function Signup() {
  const [kind, setKind] = useState('student');
  const [formData, setFormData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const set = (event) => setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (formData.password !== formData.confirmPassword) throw new Error('Passwords do not match.');
      if (kind === 'student') {
        const response = await authAPI.registerStudent(formData);
        navigate('/verify-email', { state: { email: formData.email, devOtp: response.data.devOtp } });
      } else {
        await authAPI.registerAlumni(formData);
        navigate('/account-status', { state: { message: 'Your alumni verification request is pending institutional review.' } });
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
            {fields.map(([name, label, type]) => <label key={name} className="block text-sm font-medium text-gray-700">{label}<input name={name} type={type} value={formData[name]} onChange={set} required={!name.includes('optional')} min={name === 'graduationYear' ? 1950 : undefined} max={name === 'graduationYear' ? new Date().getFullYear() + 1 : undefined} className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>)}
            <label className="block text-sm font-medium text-gray-700">Password<input name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={set} minLength={12} maxLength={128} autoComplete="new-password" required className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
            <label className="block text-sm font-medium text-gray-700">Confirm password<input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={set} minLength={12} maxLength={128} autoComplete="new-password" required className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />Show password</label>
            <button disabled={loading} className="sm:col-span-2 w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Submitting…' : kind === 'student' ? 'Continue to email verification' : 'Request alumni verification'}</button>
          </form>
          <p className="text-center text-gray-600 mt-5">Already registered? <Link to="/login" className="text-indigo-600 font-bold hover:underline">Login</Link></p>
        </section>
      </main>
    </PageTransition>
  );
}
