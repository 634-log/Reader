'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { BookCard } from '@/src/components/BookCard';
import { SearchInput } from '@/src/components/SearchInput';
import { useBooks } from '@/src/hooks/useBooks';
import { BookOpen, Library, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Book } from '@/src/types/book';

export default function Home() {
  const { books, loading, error } = useBooks();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBooks = useMemo(() => {
    if (!searchQuery) return books;

    const query = searchQuery.toLowerCase();
    return books.filter((book: Book) =>
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query)
    );
  }, [books, searchQuery]);

  // Get popular books sorted by rank
  const popularBooks = useMemo(() => {
    return books
      .filter((book: Book) => book.popularityRank)
      .sort((a: Book, b: Book) => (a.popularityRank || 0) - (b.popularityRank || 0));
  }, [books]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">書籍を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={32} className="mx-auto mb-4 text-gray-400" />
          <p className="text-red-600">エラー: {error}</p>
        </div>
      </div>
    );
  }

  // If searching, show search results
  if (searchQuery) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Library className="h-5 w-5 text-gray-900" />
              <h1 className="text-xl font-bold text-gray-900">
                readbeat
              </h1>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              スマホに特化した新しい読書リーダー
            </p>

            {/* Search */}
            <div className="max-w-md mx-auto">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="タイトルや著者で検索..."
              />
            </div>
          </header>

          {/* Results count */}
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              「{searchQuery}」の検索結果: {filteredBooks.length}件
            </p>
          </div>

          {/* Books grid */}
          {filteredBooks.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">検索結果がありません</h3>
              <p className="text-gray-600">
                別のキーワードで検索してみてください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredBooks.map((book: Book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-2">
            <Library className="h-5 w-5 text-gray-900" />
            <h1 className="text-xl font-bold text-gray-900">
              readbeat
            </h1>
          </div>
          <p className="text-sm text-gray-600 mb-8">
            スマホに特化した新しい読書リーダー
          </p>
          
          {/* Search */}
          <div className="max-w-md mx-auto">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="タイトルや著者で検索..."
            />
          </div>
        </header>

        {/* Popular Ranking */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">人気ランキング</h2>
          
          <div className="space-y-3">
            {popularBooks.map((book: Book, index: number) => (
              <Link key={book.id} href={`/book/${book.id}`}>
                <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-xs flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-1">{book.author}</p>
                      <h3 className="font-bold text-gray-900 mb-2 leading-tight">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                        {book.opening}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}