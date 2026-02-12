// segmenter.ts

// ========= Types =========
export interface Token {
  type: 'text' | 'ruby' | 'quote';
  value?: string;            // text 用
  base?: string;             // ruby 用
  ruby?: string;             // ruby 用
  countKuten?: boolean;      // quote ピースの末尾だけ true（句点カウント用）
}

export interface Mode {
  kutenTarget: number; // 目標句点数
  cap: number;         // 1ページの最大可視文字
}
export type ModeName = 'default' | 'many' | 'super';

// ========= モード =========
const MODES: Record<ModeName, Mode> = {
  default: { kutenTarget: 1, cap: 75 },
  many:    { kutenTarget: 2, cap: 120 },
  super:   { kutenTarget: 3, cap: 160 },
};
let currentMode: Mode = MODES.default;

// ========= 可視長 =========
function visibleLengthOfToken(tok: Token): number {
  if (!tok) return 0;
  if (tok.type === 'ruby') return Array.from(tok.base || '').length;
  if (tok.type === 'quote') {
    const arr = (tok as unknown as { value: Token[] }).value || [];
    return visibleLengthOfTokens(arr);
  }
  return Array.from(tok.value || '').length;
}
function visibleLengthOfTokens(tokens: Token[]): number {
  return tokens.reduce((n, t) => n + visibleLengthOfToken(t), 0);
}

// ========= ユーティリティ =========
function escapeHTML(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function isOpenQuote(t: Token): boolean {
  return t.type === 'text' && typeof t.value === 'string' && t.value.includes('「');
}
function isCloseQuote(t: Token): boolean {
  return t.type === 'text' && typeof t.value === 'string' && t.value.includes('」');
}
function splitTextByComma(t: Token): Token[] {
  if (t.type !== 'text') return [t];
  const txt = t.value || '';
  if (!txt.includes('、')) return [t];
  const parts = txt.split('、');
  return parts
    .map((p, i, a) => ({ type: 'text' as const, value: i < a.length - 1 ? p + '、' : p }))
    .filter(x => x.value !== '');
}
function splitTextByKuten(t: Token): Token[] {
  if (t.type !== 'text') return [t];
  const txt = t.value || '';
  if (!txt.includes('。')) return [t];
  const raw = txt.split('。');
  return raw
    .map((p, i) => ({ type: 'text' as const, value: i < raw.length - 1 ? p + '。' : p }))
    .filter(x => x.value !== '');
}
function forceCutTextToken(tok: Token, room: number): { head: Token[]; rest: Token | null } {
  const s = tok.value || '';
  const arr = Array.from(s);
  if (arr.length <= room) return { head: [tok], rest: null };
  const head = arr.slice(0, room).join('');
  const tail = arr.slice(room).join('');
  return {
    head: head ? [{ type: 'text' as const, value: head }] : [],
    rest: tail ? { type: 'text' as const, value: tail } : null,
  };
}

// ========= 核：文をまたいでセリフを1ブロック化 =========
/**
 * 入力: sentencesTokens ... 1文 = Token[] の配列
 * 出力: 正規化済みの 1 列トークン
 * - 「...」のランを sentence を越えて 1 つの quote に畳み込み
 * - 内部の旧 quote はフラット化（value 配列を中身に展開）
 * - 途中の地の文はランを閉じる
 * - 開きっぱなしはそのまま（countKuten は付けない）
 */
function normalizeQuoteRunsAcrossSentences(sentencesTokens: Token[][]): Token[] {
  const out: Token[] = [];
  let inRun = false;
  let buf: Token[] = [];
  let hadOpen = false;
  let hadClose = false;

  const flushRun = (closed: boolean) => {
    if (buf.length === 0) return;
    const q: Token = { type: 'quote', countKuten: closed } as Token;
    (q as unknown as { value: Token[] }).value = buf;
    out.push(q);
    buf = [];
    inRun = false;
    hadOpen = false;
    hadClose = false;
  };

  for (const sent of sentencesTokens) {
    for (const tok of sent) {
      // ラン外
      if (!inRun) {
        if (isOpenQuote(tok)) {
          // ラン開始（開き括弧は内部に保持）
          inRun = true;
          hadOpen = true;
          buf.push(tok); // 「 を中身に
          continue;
        }
        if (tok.type === 'quote') {
          // まれなケース: 括弧トークンが欠落していて、内容だけが来た場合
          // そのまま地の文として扱うのではなく、ランとして扱う（括弧は無いまま）
          inRun = true;
          // 旧 quote の中身をフラットに取り込む
          const inner = (tok as unknown as { value: Token[] }).value || [];
          buf.push(...inner);
          continue;
        }
        out.push(tok);
        continue;
      }

      // ラン内
      if (isCloseQuote(tok)) {
        hadClose = true;
        buf.push(tok);        // 」 を中身に
        flushRun(true);       // 正規に閉じる
        continue;
      }

      if (tok.type === 'quote') {
        // 旧 quote は中身をフラットに
        const inner = (tok as unknown as { value: Token[] }).value || [];
        buf.push(...inner);
        continue;
      }

      // ラン途中の text/ruby はそのまま取り込む
      buf.push(tok);
    }
  }

  // ファイル末尾で開きっぱなし（閉じ忘れ）は、そのまま吐く（countKuten=false）
  if (inRun && buf.length) flushRun(false);

  return out;
}

// ========= quote 超過時の cap 分割 =========
function breakLongQuote(quoteTok: Token, cap: number): Token[] {
  const original = (quoteTok as unknown as { value: Token[] }).value || [];
  const hadOpen = original.some(t => isOpenQuote(t));
  const hadClose = original.some(t => isCloseQuote(t));

  // 1) 括弧を一旦取り除いた中身
  const inner: Token[] = original.filter(t => !(t.type === 'text' && (t.value === '「' || t.value === '」')));

  // 2) text を「、」「。」で細切れ（ruby は塊のまま）
  const atoms: Token[] = [];
  inner.forEach(t => {
    if (t.type === 'text') {
      splitTextByComma(t).forEach(tt => atoms.push(...splitTextByKuten(tt)));
    } else {
      atoms.push(t);
    }
  });

  // 3) cap 以下でピースにパック
  const pieces: Token[][] = [];
  let buf: Token[] = [];
  let len = 0;
  const flush = () => {
    if (buf.length) {
      pieces.push(buf);
      buf = [];
      len = 0;
    }
  };

  for (let i = 0; i < atoms.length; i++) {
    const t = atoms[i];
    const tl = visibleLengthOfToken(t);

    if (len === 0 || len + tl <= cap) {
      buf.push(t);
      len += tl;
      continue;
    }

    // 現ピースを確定
    flush();

    // 単体で cap 以下なら新ピースに
    if (tl <= cap) {
      buf.push(t);
      len = tl;
      continue;
    }

    // まだ大きい text は強制分割
    if (t.type === 'text') {
      let rest: Token | null = t;
      while (rest) {
        const cut = forceCutTextToken(rest, cap);
        if (cut.head.length) pieces.push(cut.head);
        rest = cut.rest;
      }
    } else {
      pieces.push([t]);
    }
  }
  flush();

  // 4) 先頭/末尾ピースにだけ括弧を付与
  const out: Token[] = pieces.map((arr, idx) => {
    const v: Token[] = [];
    if (idx === 0 && hadOpen) v.push({ type: 'text', value: '「' });
    v.push(...arr);
    if (idx === pieces.length - 1 && hadClose) v.push({ type: 'text', value: '」' });

    const q: Token = { type: 'quote', countKuten: idx === pieces.length - 1 } as Token;
    (q as unknown as { value: Token[] }).value = v;
    return q;
  });

  return out;
}

// ========= ページング本体 =========
function paginateSentences(sentencesTokens: Token[][], modeNameOrObj?: ModeName | Mode): Token[][] {
  const mode = typeof modeNameOrObj === 'string' ? (MODES[modeNameOrObj] || currentMode) : (modeNameOrObj || currentMode);
  const { kutenTarget, cap } = mode;

  // 1) 文をまたいでセリフを正規化（地の文 + quote-run の一次列）
  const normalized = normalizeQuoteRunsAcrossSentences(sentencesTokens);

  // 2) 一次列を整形
  //   - 地の文 text は「、」「。」で細切れ
  //   - quote-run は cap 判定：超過ならピース列へ、<=cap ならそのまま（countKuten=true を保証）
  const stream: Token[] = [];
  for (const tok of normalized) {
    if (tok.type === 'quote') {
      const len = visibleLengthOfToken(tok);
      if (len > cap) {
        const frags = breakLongQuote(tok, cap);
        stream.push(...frags);
      } else {
        tok.countKuten = true; // 1 ブロック = 句点 1
        stream.push(tok);
      }
      continue;
    }

    if (tok.type === 'text') {
      splitTextByComma(tok).forEach(tt => stream.push(...splitTextByKuten(tt)));
    } else {
      stream.push(tok);
    }
  }

  // 3) ページング
  const pages: Token[][] = [];
  let page: Token[] = [];
  let pageLen = 0;
  let kutenCount = 0;

  const pushPage = () => {
    if (!page.length) return;
    pages.push(page);
    page = [];
    pageLen = 0;
    kutenCount = 0;
  };

  for (let i = 0; i < stream.length; i++) {
    const tok = stream[i];
    const tl = visibleLengthOfToken(tok);

    // cap 超なら改ページしてから置く（原子は割らない）
    if (pageLen > 0 && pageLen + tl > cap) pushPage();

    page.push(tok);
    pageLen += tl;

    // 句点カウント
    if (tok.type === 'text') {
      const v = tok.value || '';
      if (/[。！？]$/.test(v)) kutenCount++;
    } else if (tok.type === 'quote') {
      if (tok.countKuten !== false) kutenCount++;
    }

    if (kutenCount >= kutenTarget) pushPage();
  }
  pushPage();

  return pages;
}

// ========= HTML化（デバッグ用） =========
function tokensToHTML(tokens: Token[]): string {
  return tokens
    .map(tok => {
      if (tok.type === 'ruby') {
        return `<ruby>${escapeHTML(tok.base || '')}<rt>${escapeHTML(tok.ruby || '')}</rt></ruby>`;
      } else if (tok.type === 'quote') {
        const arr = (tok as unknown as { value: Token[] }).value || [];
        return tokensToHTML(arr); // 再帰
      } else {
        return escapeHTML(tok.value || '');
      }
    })
    .join('');
}

// ========= 外部 API =========
export const Segmenter = {
  setMode(name: ModeName): Mode {
    currentMode = MODES[name] || MODES.default;
    return currentMode;
  },
  getMode(): Mode {
    return currentMode;
  },
  paginateSentences,
  tokensToHTML,
  visibleLengthOfTokens,
};