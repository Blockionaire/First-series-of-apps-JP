/**
 * The shared shape of the header's icon controls — theme, language, account.
 *
 * They sit next to each other in a single row, so any drift between them is
 * immediately visible. One constant, imported by all three, is cheaper to keep
 * honest than three copies of the same class list.
 *
 * No border: the row reads as a set of glyphs rather than a strip of boxes,
 * which is why the framed theme switch was pulled out of the old system bar in
 * the first place. The square padding keeps a comfortable tap target (~36px)
 * around a 16px icon.
 */
export const HEADER_ICON_BTN =
  "inline-flex h-9 w-9 items-center justify-center rounded-sm text-cream-400 " +
  "transition-colors hover:text-cream-100 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cream-400)]";
