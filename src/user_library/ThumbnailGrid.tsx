"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function ThumbnailGrid() {
  const [videos, setVideos] = useState<Array<{
    id: string;
    title: string;
    duration: number;
    thumbnail: string;
    createdAt: string;
    language: string;
    status: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    language: 'all',
    duration: 'all',
    sort: 'newest'
  });

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(data => {
        setVideos(data.videos);
        setIsLoading(false);
      })
      .catch(err => {
        setError("Failed to load videos");
        setIsLoading(false);
      });
  }, []);

  const filteredVideos = videos.filter(video => {
    if (filter.language !== 'all' && video.language !== filter.language) return false;
    if (filter.duration === 'short' && video.duration > 15) return false;
    if (filter.duration === 'medium' && (video.duration <= 15 || video.duration > 30)) return false;
    if (filter.duration === 'long' && video.duration <= 30) return false;
    return true;
  }).sort((a, b) => {
    if (filter.sort === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (filter.sort === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (filter.sort === 'longest') {
      return b.duration - a.duration;
    } else {
      return a.duration - b.duration;
    }
  });

  if (isLoading) {
    return (
      <div className="glass-card p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-white">Loading videos...</span>
        </div>
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
    <div className="glass-card p-4 rounded-xl shadow-lg">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-800/30 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Language</label>
          <select
            value={filter.language}
            onChange={(e) => setFilter({...filter, language: e.target.value})}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
          >
            <option value="all">All Languages</option>
            <option value="hinglish">Hinglish</option>
            <option value="marathi">Marathi</option>
            <option value="english">English</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Duration</label>
          <select
            value={filter.duration}
            onChange={(e) => setFilter({...filter, duration: e.target.value})}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
          >
            <option value="all">All Durations</option>
            <option value="short">Under 15 min</option>
            <option value="medium">15-30 min</option>
            <option value="long">Over 30 min</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Sort</label>
          <select
            value={filter.sort}
            onChange={(e) => setFilter({...filter, sort: e.target.value})}
            className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="longest">Longest First</option>
            <option value="shortest">Shortest First</option>
          </select>
        </div>
      </div>

      {/* Video Grid */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No videos found matching your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <Link key={video.id} href={`/cinema/${video.id}`} className="block glass-card-small overflow-hidden rounded-lg hover:scale-105 transition-transform">
              <div className="relative h-40 w-full">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {Math.floor(video.duration / 60)}:{video.duration % 60 < 10 ? '0' : ''}{video.duration % 60} min
                </div>
                <div className="absolute top-2 left-2 bg-gray-800/70 text-white text-xs px-2 py-1 rounded capitalize">
                  {video.language}
                </div>
              </div>
              <div className="p-2">
                <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
                <p className="text-xs text-gray-400">{new Date(video.createdAt).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}