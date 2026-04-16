"use client";

import { useState } from 'react';
import { AvatarPicker } from './AvatarPicker';
import { LanguageSelector } from './LanguageSelector';
import { DurationSlider } from './DurationSlider';

export function PromptInput() {
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('hinglish');
  const [duration, setDuration] = useState(10);
  const [avatar, setAvatar] = useState('default');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    // Call backend API to start video generation
    fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, language, duration, avatar })
    })
    .then(res => res.json())
    .then(data => {
      window.location.href = `/processing/${data.jobId}`;
    })
    .catch(err => {
      console.error('Generation error:', err);
      setIsGenerating(false);
    });
  };

  return (
    <div className="glass-card p-6 rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Create Your Video</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            What do you want to explain?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800/50 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Example: Explain how the stock market works..."
            required
          />
        </div>

        <LanguageSelector value={language} onChange={setLanguage} />
        <DurationSlider value={duration} onChange={setDuration} />
        <AvatarPicker value={avatar} onChange={setAvatar} />

        <button
          type="submit"
          disabled={isGenerating}
          className={`w-full py-3 px-4 rounded-lg text-white font-medium ${isGenerating ? 'bg-blue-600' : 'bg-blue-700 hover:bg-blue-600'} transition-colors`}
        >
          {isGenerating ? 'Generating...' : 'Create Video'}
        </button>
      </form>
    </div>
  );
}