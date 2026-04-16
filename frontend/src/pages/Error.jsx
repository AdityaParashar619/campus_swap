import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ErrorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const error = location.state?.error || 'Something went wrong';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </motion.div>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Oops!</h1>
        <p className="text-gray-600 mb-6">Something went wrong</p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8"
        >
          <p className="text-sm text-red-700">{error}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition inline-block"
          >
            Go Home
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
