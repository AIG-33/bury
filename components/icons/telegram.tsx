type Props = {
  className?: string;
};

/** Telegram paper-plane glyph, fills `currentColor`. */
export function TelegramIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.13.56l.4-5.62 10.2-9.22c.44-.4-.1-.62-.69-.23l-12.6 7.94-5.43-1.7c-1.18-.37-1.2-1.18.25-1.75L22.39 2.08c.98-.37 1.84.22 1.52 1.71Z" />
    </svg>
  );
}
