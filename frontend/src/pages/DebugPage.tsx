import React from 'react';
import DebugPanel from '@/components/DebugPanel';

const DebugPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Frontend-Backend Debug</h1>
        <DebugPanel />
        
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            This page helps diagnose connection issues between frontend and backend.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Navigate to <code>/admin</code> once issues are resolved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DebugPage; 