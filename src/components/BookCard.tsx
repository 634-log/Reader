import Link from 'next/link';
import { Star } from 'lucide-react';
import { Book } from '@/src/types/book';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BookCardProps {
  book: Book & {
    durationTag?: string;
    categories?: string[];
    tags?: string[];
    isFavorite?: boolean;
  };
  variant?: 'grid' | 'list';
  onToggleFavorite?: () => void;
}

export function BookCard({ book, variant = 'grid', onToggleFavorite }: BookCardProps) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.();
  };

  if (variant === 'list') {
    return (
      <Link href={`/book/${book.id}`}>
        <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600">
          {/* お気に入りボタン（左側） */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavoriteClick}
            className="flex-shrink-0 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Star 
              className={`h-4 w-4 ${
                book.isFavorite 
                  ? 'fill-yellow-400 text-yellow-400' 
                  : 'text-gray-400 dark:text-gray-500'
              }`} 
            />
          </Button>

          {/* メインコンテンツ */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {book.author}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                  {book.opening}
                </p>
              </div>
              
              {/* 所要時間バッジ（右端） */}
              {(book.durationTag || book.readingTimeMinutes) && (
                <Badge variant="secondary" className="flex-shrink-0 text-xs">
                  {book.durationTag || `${book.readingTimeMinutes}分`}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Grid mode (default)
  return (
    <Link href={`/book/${book.id}`}>
      <Card className="h-full transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer relative bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        {/* お気に入りボタン（右上） */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFavoriteClick}
          className="absolute top-2 right-2 z-10 h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Star 
            className={`h-4 w-4 ${
              book.isFavorite 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-400 dark:text-gray-500'
            }`} 
          />
        </Button>

        {/* 擬似表紙デザイン */}
        <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center p-4 text-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-2 leading-tight">
            {book.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {book.author}
          </p>
        </div>

        <CardContent className="p-4 flex-1 flex flex-col">
          {/* 冒頭文（1行） */}
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1 mb-3 leading-relaxed flex-1">
            {book.opening}
          </p>

          {/* 所要時間バッジ */}
          <div className="flex justify-center">
            {(book.durationTag || book.readingTimeMinutes) && (
              <Badge variant="secondary" className="text-xs">
                {book.durationTag || `${book.readingTimeMinutes}分`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}