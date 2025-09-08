// components/conversations/ConversationsToolbar.tsx
import React from "react";

interface ConversationsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  resolutionFilter: string;
  onResolutionChange: (value: string) => void;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

export default function ConversationsToolbar({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}: ConversationsToolbarProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="relative">

        <input
          type="text"
          placeholder="Search conversations, contacts, or outcomes..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 dark:focus:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div>
        <input
          type="date"
          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
          value={formatDateForInput(dateRange.from)}
          onChange={(e) => {
            const newFrom = new Date(e.target.value);
            onDateRangeChange({ from: newFrom, to: dateRange.to });
          }}
        />
        <input
          type="date"
          className="block w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
          value={formatDateForInput(dateRange.to)}
          onChange={(e) => {
            const newTo = new Date(e.target.value);
            onDateRangeChange({ from: dateRange.from, to: newTo });
          }}
        />
      </div>


    </div>
  );
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

