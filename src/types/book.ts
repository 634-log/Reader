export interface Book {
  id: string;
  title: string;
  author: string;
  opening: string;
  year?: number;
  readingTimeMinutes?: number;
  category?: string;
  isRecommended?: boolean;
  popularityRank?: number;
  durationTag?: string;
  categories?: string[];
  tags?: string[];
  isFavorite?: boolean;
}

export interface Token {
  type: 'text' | 'ruby' | 'quote';
  value?: string;
  base?: string;
  ruby?: string;
  countKuten?: boolean;
}

export interface Sentence {
  offset: number;
  tokens: Token[];
}

export interface BookContent {
  id: string;
  title: string;
  author: string;
  sentences: Sentence[];
}