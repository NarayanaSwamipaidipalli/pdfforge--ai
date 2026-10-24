import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#fbfbfd]">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-600 flex items-center justify-center mb-5 shadow-sm">
        <FileQuestion className="w-7 h-7" />
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
        Page or Tool Not Found (404)
      </h1>

      <p className="text-xs text-zinc-500 max-w-sm mb-6 leading-relaxed">
        The tool or requested document URL could not be resolved. Please select from our catalog of 24+ PDF tools.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/#tools"
          className="px-4 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Browse All Tools</span>
        </Link>
      </div>
    </div>
  );
}
