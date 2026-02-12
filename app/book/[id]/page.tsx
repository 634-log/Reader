import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BookOpen, Clock, Calendar, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

async function getBook(id: string) {
  try {
    // public/books/books.json を直接読み込む
    const filePath = join(process.cwd(), 'public', 'books', 'books.json');
    const fileContents = readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);

    return data.items.find((book: any) => book.id === id);
  } catch {
    return null;
  }
}

interface PageProps {
  params: { id: string };
}

export default async function BookDetailPage({ params }: PageProps) {
  const book = await getBook(params.id);

  if (!book) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        {/* Back button */}
        <div className="mb-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </Link>
        </div>

        {/* Book details card */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm relative">
          <CardHeader className="text-center pb-6 pt-8">
            {/* タイトルと著者 */}
            <div className="mb-6">
              <CardTitle className="text-3xl font-bold leading-relaxed mb-3 text-gray-900">
                {book.title}
              </CardTitle>
              <CardDescription className="text-lg text-gray-500">
                {book.author}
              </CardDescription>
            </div>

            {/* メタデータ - バッジ風デザイン */}
            <div className="flex flex-wrap gap-3 justify-center">
              {book.year && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  {book.year}年発表
                </Badge>
              )}
              {book.readingTimeMinutes && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <Clock className="h-3.5 w-3.5" />
                  約{book.readingTimeMinutes}分
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* 冒頭テキスト - 引用カードスタイル */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                  冒頭
                </Badge>
              </div>
              <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl p-6 border-l-4 border-primary/60 shadow-sm">
                <p className="text-base leading-relaxed text-gray-700 font-medium">
                  {book.opening}
                </p>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="pt-6 space-y-4">
              {/* メインCTA - 読み始めるボタン */}
              <Link href={`/reader/${book.id}`}>
                <Button 
                  size="lg" 
                  className="w-full h-16 text-xl font-bold rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
                >
                  <BookOpen className="h-6 w-6 mr-3" />
                  読み始める
                </Button>
              </Link>

              {/* サブアクション - Amazonリンク */}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-10 text-sm font-medium rounded-xl text-gray-600 border-gray-200 hover:bg-gray-50 transition-all duration-200"
                asChild
              >
                <a href={`https://www.amazon.co.jp/s?k=${encodeURIComponent(book.title + ' ' + book.author)}&tag=your-affiliate-id`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Amazonで関連書籍を見る
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}