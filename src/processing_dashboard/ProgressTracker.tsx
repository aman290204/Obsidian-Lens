"use client";

import { useState, useEffect } from 'react';

export function ProgressTracker({ jobId }: { jobId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('initializing');
  const [chapters, setChapters] = useState<{chapter: number, status: string}[]>([]);
  const [engineStatus, setEngineStatus] = useState({
    activeKeys: 5,
    rpm: 0,
    queueSize: 0
  });

  useEffect(() => {
    const eventSource = new EventSource(`/api/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      setStatus(data.status);
      setChapters(data.chapters || []);

      if (data.engineStatus) {
        setEngineStatus(data.engineStatus);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  const totalChapters = chapters.length;
  const completedChapters = chapters.filter(ch => ch.status === 'completed').length;

  return (
    <div className="glass-card p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Generating Your Video</h1>

      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-300">Overall Progress</span>
          <span className="text-sm font-medium text-white">{progress}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6">
        <p className="text-sm text-gray-300 mb-2">Current Status:</p>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
          <span className="text-white capitalize">{status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Chapter Progress */}
      {totalChapters > 0 && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Chapter Progress</span>
            <span className="text-sm font-medium text-white">
              {completedChapters}/{totalChapters}
            </span>
          </div>
          <div className="space-y-2">
            {chapters.slice(0, 5).map((chapter, index) => (
              <div key={chapter.chapter} className="flex items-center">
                <div className="w-6 h-6 rounded-full mr-3 flex items-center justify-center">
                  {chapter.status === 'completed' ? (
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                  ) : chapter.status === 'failed' ? (
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-white">Chapter {chapter.chapter}</span>
                {index === 4 && totalChapters > 5 && (
                  <span className="text-xs text-gray-400 ml-2">+ {totalChapters - 5} more</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engine Status */}
      <div className="glass-card-inner p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">Live Engine Status</span>
          <span className={`text-sm font-bold ${engineStatus.activeKeys > 2 ? 'text-green-400' : 'text-yellow-400'}`}>
            {engineStatus.activeKeys}/5 API Keys Active
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Current RPM: {engineStatus.rpm}</span>
          <span>Queue Size: {engineStatus.queueSize}</span>
        </div>
      </div>

      {/* Estimated Time */}
      {status !== 'completed' && status !== 'failed' && (
        <div className="text-center text-sm text-gray-400 mt-4">
          Estimated completion in {Math.max(0, Math.round((60 - (progress / 100 * 60))))} minutes
        </div>
      )}

      {/* Actions */}
      {status === 'completed' && (
        <div className="mt-6">
          <button
            onClick={() => window.location.href = `/cinema/${jobId}`}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Watch Your Video
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-6">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Retry Generation
          </button>
        </div>
      )}
    </div>
  );
}