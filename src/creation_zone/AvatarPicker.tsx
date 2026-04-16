"use client";

import Image from 'next/image';

export function AvatarPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const avatars = [
    { id: 'default', name: 'Default Presenter', thumbnail: '/avatars/default.png' },
    { id: 'professional', name: 'Professional', thumbnail: '/avatars/professional.png' },
    { id: 'friendly', name: 'Friendly', thumbnail: '/avatars/friendly.png' },
    { id: 'casual', name: 'Casual', thumbnail: '/avatars/casual.png' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        Choose Presenter
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all h-24 ${value === avatar.id ? 'border-primary' : 'border-transparent'}`}
            onClick={() => onChange(avatar.id)}
          >
            <Image
              src={avatar.thumbnail}
              alt={avatar.name}
              fill
              className="object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 z-10">
              {avatar.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}