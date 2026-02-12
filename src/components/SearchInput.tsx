'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "書籍を検索..." }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const clearSearch = () => {
    onChange('');
  };

  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground">
        <Search size={20} />
      </div>
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="pl-12 pr-12 h-10 rounded-lg border border-gray-300 transition-all duration-200 focus:border-gray-500 focus:outline-none"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted"
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
}