"use client";

export function DurationSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        Video Duration: {value} minutes
      </label>
      <input
        type="range"
        min={5}
        max={60}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>5 min</span>
        <span>60 min</span>
      </div>
    </div>
  );
}