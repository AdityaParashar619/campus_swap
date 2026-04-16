import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-9xl font-black text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-4">
            404
          </h1>
        </motion.div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Home
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition"
          >
            Go Back
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
