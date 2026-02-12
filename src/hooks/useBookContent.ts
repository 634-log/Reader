'use client';

import { useState, useEffect } from 'react';
import { BookContent } from '@/src/types/book';

export function useBookContent(id: string) {
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookContent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/books/${id}.json`);
        if (!response.ok) {
          throw new Error('Failed to fetch book content');
        }
        const data = await response.json();
        setBookContent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchBookContent();
    }
  }, [id]);

  return { bookContent, loading, error };
}