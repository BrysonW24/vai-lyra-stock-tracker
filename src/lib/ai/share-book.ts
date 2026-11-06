/**
 * A no-account reader's choice to send their device-held book to Lyra's FREE model.
 *
 * Solo's promise is that the book stays in this browser, and a free model is somebody else's
 * computer - so the answer is "no" until the reader says otherwise, and it is asked in the one
 * place it is used (the chat sheet's "Include my book" tick). Every surface that can hand something
 * to the free model reads the same choice: chat, and the brief card's "plain English" button.
 * (A reader's own key is their own arrangement - the book has always travelled with it.)
 *
 * Browser-only: localStorage, wrapped because a private window can throw on any access.
 */
import type { DailyBrief } from '@/lib/daily-brief';

export const SHARE_BOOK_KEY = 'lyra.ai.free-share-book';

export function loadShareBook(): boolean {
  try {
    return window.localStorage.getItem(SHARE_BOOK_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShareBook(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(SHARE_BOOK_KEY, '1');
    else window.localStorage.removeItem(SHARE_BOOK_KEY);
  } catch {
    /* private mode: the choice lasts for this sheet only */
  }
}

/**
 * The brief a free model may be shown. `marketBrief` is the same brief built with no holdings and
 * no watchlist. With an account the reader's book is already covered by the privacy policy; without
 * one it goes only when they have switched "Include my book" on.
 */
export function briefForFreeModel(brief: DailyBrief, marketBrief: DailyBrief, opts: { soloMode: boolean; shareBook: boolean }): DailyBrief {
  return opts.soloMode && !opts.shareBook ? marketBrief : brief;
}
