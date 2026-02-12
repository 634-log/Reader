import useSWR from 'swr';
import { Book } from '@/src/types/book';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useBooks() {
  const { data, error, isLoading } = useSWR('/books/books.json', fetcher);

  return {
    books: data?.items ?? [],
    loading: isLoading,
    error: error?.message || null
  };
}