"use client";

import { useState, useEffect, useRef } from 'react';

export function VideoPlayer({ videoId }: { videoId: string }) {
  const [videoData, setVideoData] = useState({
    url: '',
    title: '',
    duration: 0,
    thumbnail: '',
    createdAt: '',
    language: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`/api/video/${videoId}`)
      .then(res => res.json())
      .then(data => {
        setVideoData({
          url: data.webContentLink,
          title: data.title || `Generated Video - ${new Date(data.createdAt).toLocaleDateString()}`,
          duration: data.duration || 0,
          thumbnail: data.thumbnail || '/default-thumbnail.jpg',
          createdAt: data.createdAt,
          language: data.language || 'hinglish'
        });
        setIsLoading(false);
      })
      .catch(err => {
        setError("Failed to load video data");
        setIsLoading(false);
      });
  }, [videoId]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 rounded-xl shadow-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-white">Loading video...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 rounded-xl shadow-lg text-center">
        <div className="text-red-500 mb-2">⚠️</div>
        <p className="text-white">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`glass-card rounded-xl shadow-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Video Container */}
      <div className="relative bg-black">
        <video
          ref={videoRef}
          className="w-full"
          poster={videoData.thumbnail}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        >
          <source src={videoData.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a3 3 0 116 0v6a3 3 0 11-6 0V7z" clipRule="evenodd"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                </svg>
              )}
            </button>

            {/* Progress Bar */}
            <div className="flex-1 flex items-center">
              <span className="text-xs text-white w-12">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={videoData.duration || 100}
                value={currentTime}
                onChange={(e) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Number(e.target.value);
                  }
                }}
                className="flex-1 h-1 bg-gray-600 rounded appearance-none cursor-pointer mx-2"
              />
              <span className="text-xs text-white w-12 text-right">
                {videoData.duration ? formatTime(videoData.duration) : '--:--'}
              </span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-blue-400 transition-colors"
            >
              {isFullscreen ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.707 4.293a1 1 0 0 0-1.414 1.414L8.586 10H5a1 1 0 1 0 0 2h4.586l-5.293 5.293a1 1 0 1 0 1.414 1.414L10 12.414l5.293 5.293a1 1 0 0 0 1.414-1.414L11.414 10l5.293-5.293a1 1 0 0 0-1.414-1.414L10 8.586 4.707 3.293z" clipRule="evenodd"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.586 5.586a2 2 0 112.828 2.828L10 6.414l2.586 2.586a2 2 0 11-2.828 2.828L10 10.828l-2.586 2.586a2 2 0 11-2.828-2.828L7.172 8 4.586 5.586z" clipRule="evenodd"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-4 space-y-2">
        <h2 className="text-xl font-bold text-white">{videoData.title}</h2>
        <div className="flex justify-between text-sm text-gray-300">
          <span>
            {new Date(videoData.createdAt).toLocaleDateString()} • {videoData.duration ? `${Math.floor(videoData.duration / 60)} min` : '--'}
          </span>
          <span className="capitalize">{videoData.language}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => navigator.clipboard.writeText(videoData.url)}
            className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            Copy Link
          </button>
          <a
            href={videoData.url}
            download
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm text-center transition-colors"
          >
            Download
          </a>
          <button
            onClick={() => window.open(`https://drive.google.com/uc?export=download&id=${videoId.split('-')[0]}`)}
            className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
          >
            Save to Drive
          </button>
        </div>
      </div>
    </div>
  );
}