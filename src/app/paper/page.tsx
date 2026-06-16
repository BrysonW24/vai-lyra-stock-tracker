import { redirect } from 'next/navigation';

/**
 * Paper Trading has been consolidated into Paper Bot (/paper-bot).
 * Redirect so any existing bookmarks or links still work.
 */
export default function PaperTradingPage() {
  redirect('/paper-bot');
}
