"use client";

export function LanguageSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const languages = [
    { id: 'hinglish', name: 'Hinglish (Hindi + English)' },
    { id: 'marathi', name: 'Marathi' },
    { id: 'english', name: 'Simple English' }
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        Select Language
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 bg-gray-800/50 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      >
        {languages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}