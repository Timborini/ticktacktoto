import { AlertTriangle } from 'lucide-react';

export function ConfigError({ missingVars }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-lg shadow-2xl">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuration Missing</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The app cannot connect to Firebase because the following environment variables are missing or invalid:
        </p>
        <ul className="list-disc list-inside mb-6 text-sm font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          {missingVars.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Please set these in your deployment platform (e.g., Netlify dashboard) and redeploy.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
