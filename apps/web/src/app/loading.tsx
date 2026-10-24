import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#fbfbfd]">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl border-4 border-blue-200 border-t-blue-600 animate-spin" />
      </div>
      <p className="mt-4 text-xs font-medium text-zinc-500 animate-pulse">
        Initializing secure workspace...
      </p>
    </div>
  );
}
