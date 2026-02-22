'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBookContent } from '@/src/hooks/useBookContent';
import { Segmenter } from '@/src/lib/segmenter';
import { Token, Sentence } from '@/src/types/book';

const TOP_PROGRESS_PX = 4;   // progress bar h-1
const BOTTOM_AD_PX   = 64;  // bottom ad h-16

type ReadingMode = 'default' | 'many' | 'super';

interface PageProps {
  params: { id: string };
}

type FontFamily = 'noto-serif' | 'noto-sans' | 'shippori-mincho';
type FontSize = '14px' | '16px' | '18px' | '20px' | '24px';
type TextColor = 'black' | 'dark-gray' | 'sepia';
type BackgroundColor = 'white' | 'cream' | 'dark';

// フォントサイズに応じた行間を整数pxで返す
function getLineHeight(fontSize: FontSize): string {
  switch (fontSize) {
    case '14px': return '28px';
    case '16px': return '32px';
    case '18px': return '36px';
    case '20px': return '40px';
    case '24px': return '48px';
    default: return '32px';
  }
}

// 文の累積オフセットを計算
function calculateCumulativeOffsets(sentences: Sentence[]): number[] {
  const offsets: number[] = [0];
  let cumulative = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentenceLength = Segmenter.visibleLengthOfTokens(sentences[i].tokens);
    cumulative += sentenceLength;
    offsets.push(cumulative);
  }
  return offsets;
}

// ページの開始オフセットを「ページ長の累積」で計算
function calculatePageOffsets(pages: Token[][]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const page of pages) {
    offsets.push(acc);
    acc += Segmenter.visibleLengthOfTokens(page);
  }
  return offsets;
}

// 絶対オフセットから該当ページを探す（範囲外を安全に処理）
function findPageByOffset(pageOffsets: number[], targetOffset: number): number {
  if (pageOffsets.length === 0) return 0;
  if (targetOffset <= pageOffsets[0]) return 0;
  const lastIdx = pageOffsets.length - 1;
  if (targetOffset >= pageOffsets[lastIdx]) return lastIdx;
  for (let i = lastIdx; i >= 0; i--) {
    if (pageOffsets[i] <= targetOffset) return i;
  }
  return 0;
}

/** 閉じ括弧の直前が文末記号（。！？）なら true */
const END_PUNC_RE = /[。！？]$/;

/** quote 内側の"最後の見える text"を後ろから探す */
function getLastInnerVisibleText(quoteTok: Token | undefined): string | undefined {
  if (!quoteTok || quoteTok.type !== 'quote') return undefined;
  for (let k = quoteTok.value.length - 1; k >= 0; k--) {
    const it = quoteTok.value[k];
    if (it?.type === 'text') {
      const v = it.value.trim();
      if (v) return v;
    }
  }
  return undefined;
}

/* ===== レンダラー（括弧を足さない／括弧の前後だけ改行） ===== */
/** 文末（。！？）または閉じ括弧なら true：地の文→セリフ切替の前改行に使う */
const SENTENCE_END_RE = /[。！？]$/;
function isSentenceEndToken(t?: Token): boolean {
  if (!t || t.type !== 'text') return false;
  const v = (t.value || '').trim();
  return SENTENCE_END_RE.test(v) || v.endsWith('」');
}

/** 直前の"見える"トークンを取得（空白のみはスキップ。括弧はスキップしない） */
function getPrevVisible(tokens: Token[], i: number): Token | undefined {
  for (let j = i - 1; j >= 0; j--) {
    const t = tokens[j];
    if (!t) break;
    if (t.type === 'text' && (!t.value || /^\s+$/.test(t.value))) continue;
    return t;
  }
  return undefined;
}

/** テキスト内の \n を <br/> に */
function renderTextWithBreaks(text: string, keyPrefix: string) {
  const parts = text.split('\n');
  return parts.map((p, idx) =>
    idx === parts.length - 1
      ? <span key={`${keyPrefix}-${idx}`}>{p}</span>
      : <span key={`${keyPrefix}-${idx}`}>{p}<br /></span>
  );
}

/** ルビ対応：Token[] / string を安全に描画（括弧は"そのまま"描画） */
function renderSentence(tokens: Token[] | string) {
  if (typeof tokens === 'string') return <span>{tokens}</span>;
  if (!Array.isArray(tokens)) return null;

  return tokens.map((tok, i) => {
    // ruby
    if (tok?.type === 'ruby') {
      return (
        <ruby key={`rb-${i}`}>
          {tok.base}
          <rt>{tok.ruby}</rt>
        </ruby>
      );
    }

    // quote：改行は入れない（閉じカッコ側で入れる）。中身だけ再帰描画
    if (tok?.type === 'quote') {
      // 親配列（ページ単位）の直前トークンを見る
      const prevVisible = getPrevVisible(tokens, i);
      // 地の文の文末（。！？）の後、または直前が閉じカッコで終わっている場合は改行
      let breakBefore =
        isSentenceEndToken(prevVisible) ||
        (prevVisible?.type === 'text' && prevVisible.value === '」');
      // 直前が quote の場合でも、その内側が「…」で終わっていれば改行（＝」「 のケース）
      if (!breakBefore && prevVisible?.type === 'quote') {
        const lastInner = getLastInnerVisibleText(prevVisible);
        if (lastInner && lastInner.endsWith('」')) breakBefore = true;
      }

      return (
        <span key={`q-${i}`} className="quote">
          {breakBefore && <br />}
          {renderSentence(tok.value)}
        </span>
      );
    }

    // text
    if (tok?.type === 'text') {
      const v = tok.value ?? '';

      // 空白のみは描画しない
      if (/^\s+$/.test(v)) return null;

      // 開きカッコ：直前が文末（。！？）または閉じ括弧なら前改行（同一ページ内のみ）
      if (v === '「') {
        const prevVisible = getPrevVisible(tokens, i);
        let needBreakBefore = false;

        if (isSentenceEndToken(prevVisible)) {
          needBreakBefore = true;
        } else if (prevVisible?.type === 'text' && prevVisible.value === '」') {
          needBreakBefore = true;
        } else if (prevVisible?.type === 'quote') {
          // quote の中身の最後を調べる
          const lastInner = getLastInnerVisibleText(prevVisible);
          if (lastInner && lastInner.endsWith('」')) {
            needBreakBefore = true;
          }
        }

        return (
          <span key={`open-${i}`}>
            {needBreakBefore && <br />}
            {v}
          </span>
        );
      }

      // 閉じカッコ：同一ページ内では必ず改行
      if (v === '」') {
        const prevVisible = getPrevVisible(tokens, i);
        let shouldBreak = false;

        if (prevVisible?.type === 'quote') {
          const lastInner = getLastInnerVisibleText(prevVisible);
          shouldBreak = !!(lastInner && END_PUNC_RE.test(lastInner));
        } else if (prevVisible?.type === 'text') {
          const pv = (prevVisible.value || '').trim();
          shouldBreak = !!(pv && END_PUNC_RE.test(pv));
        }

        return (
          <span key={`close-${i}`}>
            {v}
            {shouldBreak && <br />}
          </span>
        );
      }

      // テキスト内の改行は <br/> に
      if (v.includes('\n')) {
        return <span key={`tbr-${i}`}>{renderTextWithBreaks(v, `tbr-${i}`)}</span>;
      }

      // 通常テキスト
      return <span key={`t-${i}`}>{v}</span>;
    }
  });
}

export default function ReaderPage({ params }: PageProps) {
  const { bookContent, loading, error } = useBookContent(params.id);

  // ページ分割と読書位置
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<Token[][]>([]);
  const [absoluteOffset, setAbsoluteOffset] = useState(0);
  const [cumulativeOffsets, setCumulativeOffsets] = useState<number[]>([]);
  const [pageOffsets, setPageOffsets] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 表示設定
  const [isVertical, setIsVertical] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ヘッダ制御（初期は非表示）
  const [showHeader, setShowHeader] = useState(false);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ガイド（必要なら後で使う）
  const [showTapGuide] = useState(false);

  // 文字まわり
  const [fontFamily, setFontFamily] = useState<FontFamily>('noto-serif');
  const [fontSize, setFontSize] = useState<FontSize>('18px');
  const [textColor, setTextColor] = useState<TextColor>('black');
  const [backgroundColor, setBackgroundColor] = useState<BackgroundColor>('white');
  const [readingMode, setReadingMode] = useState<ReadingMode>('many');

  // スライダー用のインデックス値
  const fontSizeIndex =
    fontSize === '14px' ? 0 :
    fontSize === '16px' ? 1 :
    fontSize === '18px' ? 2 :
    fontSize === '20px' ? 3 : 4;

  const readingModeIndex =
    readingMode === 'default' ? 0 :
    readingMode === 'many' ? 1 : 2;

  // bookContentが読み込まれたらページ分割を実行
  useEffect(() => {
    if (bookContent?.sentences) {
      // 累積オフセットを計算
      const offsets = calculateCumulativeOffsets(bookContent.sentences);
      setCumulativeOffsets(offsets);

      // ページ分割
      Segmenter.setMode(readingMode);
      const paginatedPages = Segmenter.paginateSentences(
        bookContent.sentences.map(s => s.tokens),
        readingMode
      );

      // ページオフセット（ページ長の累積）
      const pOffsets = calculatePageOffsets(paginatedPages);
      setPageOffsets(pOffsets);

      // JSONのクレジットがあれば末尾に追加（文字列想定）
      const creditText = 'source' in bookContent
        ? ((bookContent.source as any)?.credits ?? (bookContent.source as any)?.credit)
        : ((bookContent as any)?.credits ?? (bookContent as any)?.credit);
      if (typeof creditText === 'string' && creditText.trim().length > 0) {
        paginatedPages.push([{ type: 'text', value: creditText }]);
      }
      setPages(paginatedPages);

      // 初回ロード or モード変更後の位置復元
      if (!initialized) {
        setCurrentPage(0);
        setAbsoluteOffset(0);
        setInitialized(true);
      } else {
        const targetPage = findPageByOffset(pOffsets, absoluteOffset);
        setCurrentPage(Math.min(targetPage, paginatedPages.length - 1));
      }
    }
  }, [bookContent, readingMode, initialized, absoluteOffset]);

  // モード変更ハンドラー
  const handleModeChange = (mode: ReadingMode) => {
    // モード変更前に現在ページの絶対オフセットを保存
    if (pageOffsets.length > 0) {
      const currentPageOffset = pageOffsets[currentPage] ?? 0;
      setAbsoluteOffset(currentPageOffset);
    }
    setReadingMode(mode);
  };

  // ==== ページ移動 ====
  const nextPage = () => {
    setCurrentPage(prev => {
      const newPage = Math.min(prev + 1, pages.length - 1);
      if (pageOffsets.length > 0 && newPage < pageOffsets.length) {
        setAbsoluteOffset(pageOffsets[newPage]);
      }
      return newPage;
    });
  };
  const prevPage = () => {
    setCurrentPage(prev => {
      const newPage = Math.max(prev - 1, 0);
      if (pageOffsets.length > 0 && newPage < pageOffsets.length) {
        setAbsoluteOffset(pageOffsets[newPage]);
      }
      return newPage;
    });
  };

  const handleLeftTap = () => {
    isVertical ? nextPage() : prevPage();
  };
  const handleRightTap = () => {
    isVertical ? prevPage() : nextPage();
  };

  // ==== ヘッダ表示トグル（上部タップ） ====
  const handleTopTap = () => {
    setShowHeader(v => !v);
  };

  // ==== ヘッダ表示後 3 秒で自動非表示 ====
  useEffect(() => {
    if (!showHeader) {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      return;
    }
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => {
      setShowHeader(false);
      autoHideTimerRef.current = null;
    }, 3000);
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [showHeader]);

  // ==== ヘッダ上スワイプで非表示 ====
  const startYRef = useRef<number | null>(null);
  const onHeaderTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };
  const onHeaderTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current == null) return;
    const deltaY = startYRef.current - e.touches[0].clientY; // 上へスワイプで正
    if (deltaY > 50) {
      setShowHeader(false);
      startYRef.current = null;
    }
  };
  const onHeaderTouchEnd = () => {
    startYRef.current = null;
  };

  // クラス系
  const getFontClass = () => {
    switch (fontFamily) {
      case 'noto-serif': return 'font-serif';
      case 'noto-sans': return 'font-sans';
      case 'shippori-mincho': return 'font-serif';
      default: return 'font-serif';
    }
  };
  const getFontSizeClass = () => {
    switch (fontSize) {
      case '14px': return 'text-sm';
      case '16px': return 'text-base';
      case '18px': return 'text-lg';
      case '20px': return 'text-xl';
      case '24px': return 'text-2xl';
      default: return 'text-base';
    }
  };
  const getTextColorClass = () => {
    switch (textColor) {
      case 'black': return 'text-black';
      case 'dark-gray': return 'text-gray-800';
      case 'sepia': return 'text-amber-900';
      default: return 'text-black';
    }
  };
  const getBackgroundColorClass = () => {
    switch (backgroundColor) {
      case 'white': return 'bg-white';
      case 'cream': return 'bg-amber-50';
      case 'dark': return 'bg-gray-900';
      default: return 'bg-white';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">本文を読み込んでいます…</p>
      </div>
    );
  }
  if (error || !bookContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-3">読み込みエラー</p>
          <Link href={`/book/${params.id}`}>
            <Button variant="outline">詳細ページに戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  // クレジット判定（末尾ページを横書き・小さめ・左寄せで描画する）
  const creditTextValue = 'source' in bookContent
    ? ((bookContent.source as any)?.credits ?? (bookContent.source as any)?.credit)
    : ((bookContent as any)?.credits ?? (bookContent as any)?.credit);
  const hasCredit =
    typeof creditTextValue === 'string' && creditTextValue.trim().length > 0;
  const isCreditPage = hasCredit && pages.length > 0 && (currentPage === pages.length - 1);

  // 進捗計算（クレジットページ除外）
  const totalPages = Math.max(1, pages.length - (hasCredit ? 1 : 0));
  const currentProgress = Math.min(currentPage + 1, totalPages);
  const progress = Math.round((currentProgress / totalPages) * 100);

  return (
    <div className={`h-screen overflow-hidden ${getBackgroundColorClass()}`}>
      {/* Progress bar with percentage */}
      <div className="fixed top-0 left-0 right-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex-1 bg-gray-200/30 h-1">
            <div className="bg-gray-400/60 h-1 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] text-gray-500 tabular-nums min-w-[32px] text-right" aria-live="polite">
            {progress}%
          </span>
        </div>
      </div>

      {/* 上部タップエリア（ヘッダ表示トグル） */}
      <div
        className="absolute top-0 left-0 right-0 h-16 z-20 cursor-pointer"
        onClick={handleTopTap}
      />

      {/* ヘッダ（表示後 3 秒で自動非表示 / 上スワイプで非表示） */}
      {showHeader && (
        <header
          className="fixed top-0 left-0 right-0 z-40"
          onTouchStart={onHeaderTouchStart}
          onTouchMove={onHeaderTouchMove}
          onTouchEnd={onHeaderTouchEnd}
        >
          <div className="container max-w-4xl mx-auto px-4 py-6">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <Link href={`/book/${params.id}`}>
                  <Button variant="ghost" size="sm" className="rounded-full text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    戻る
                  </Button>
                </Link>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-center py-2">
                <h1 className="font-bold text-xl text-gray-900 mb-1">{bookContent.title}</h1>
                <p className="text-sm text-gray-500">{bookContent.author}</p>
              </div>
              <div className="flex justify-center text-xs text-gray-500">
                <span>{currentPage + 1} / {pages.length}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* 本文とタップエリア */}
      <div className="relative flex h-full">
        {/* 左右タップエリア */}
        <div className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer" onClick={handleLeftTap} />
        <div className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer" onClick={handleRightTap} />

        {/* 本文 */}
        <div className="container max-w-4xl mx-auto px-3 h-full overflow-hidden">
          <div
            className={`flex w-full h-full ${
              isVertical
                ? `items-start ${isCreditPage ? 'justify-start pt-[12vh]' : 'justify-end pt-0'}`
                : 'items-start justify-start pt-[20vh]'
            }`}
          >
            <div
              className={`reader-text ${isCreditPage ? 'text-sm' : getFontSizeClass()} ${getTextColorClass()} ${getFontClass()} font-medium ${
                isCreditPage ? 'px-6' : (isVertical ? 'reader-vertical pr-4' : 'px-6')
              }`}
              style={
                isCreditPage
                  ? {
                      // クレジットは常に横書き・小さめ・左寄せ
                      writingMode: 'horizontal-tb',
                      textOrientation: 'mixed',
                      lineHeight: getLineHeight('14px'),
                      textAlign: 'left',
                    }
                  : {
                      lineHeight: getLineHeight(fontSize),
                      ...(isVertical ? {} : { textAlign: 'left' }),
                    }
              }
            >
              {pages.length > 0 && renderSentence(pages[currentPage])}
            </div>
          </div>
        </div>
      </div>

      {/* 底部広告 */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-gray-100 border-t border-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-500">広告エリア</p>
      </div>

      {/* 設定ダイアログ */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>読書設定</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 縦書きモード */}
            <div className="flex items-center justify-between">
              <Label htmlFor="vertical-mode" className="text-sm font-medium">縦書きモード</Label>
              <Switch id="vertical-mode" checked={isVertical} onCheckedChange={setIsVertical} />
            </div>

            <div className="border-t pt-6" />

            {/* フォント選択 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">フォント</Label>
              <Select value={fontFamily} onValueChange={(value: FontFamily) => setFontFamily(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noto-serif">Noto Serif JP</SelectItem>
                  <SelectItem value="noto-sans">Noto Sans JP</SelectItem>
                  <SelectItem value="shippori-mincho">Shippori Mincho B1</SelectItem>
                </SelectContent>
              </Select>
              <div className={`text-lg mt-2 p-2 bg-gray-50 rounded ${getFontClass()}`}>
                吾輩は猫である
              </div>
            </div>

            <div className="border-t pt-6" />

            {/* 文字サイズ */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">文字サイズ</Label>
              <Slider
                min={0}
                max={4}
                step={1}
                value={[fontSizeIndex]}
                onValueChange={(val) => {
                  const map: FontSize[] = ['14px', '16px', '18px', '20px', '24px'];
                  setFontSize(map[val[0]]);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>14px</span>
                <span>16px</span>
                <span>18px</span>
                <span>20px</span>
                <span>24px</span>
              </div>
            </div>

            <div className="border-t pt-6" />

            {/* 文字数モード */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">1ページの文字数</Label>
              <Slider
                min={0}
                max={2}
                step={1}
                value={[readingModeIndex]}
                onValueChange={(val) => {
                  const map: ReadingMode[] = ['default', 'many', 'super'];
                  handleModeChange(map[val[0]]);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>短め<br />約60文字</span>
                <span>ふつう<br />約100文字</span>
                <span>長め<br />約140文字</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}