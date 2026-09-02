import { Link } from "@tanstack/react-router"

export default function Header() {
  return (
    <header className="border-border bg-bg sticky top-0 z-50 border-b">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-14 max-w-md items-center justify-between px-6"
      >
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 text-sm font-bold tracking-wide text-white no-underline"
          aria-label="Strength AI dashboard"
        >
          <span
            aria-hidden="true"
            className="bg-accent h-2.5 w-2.5 rounded-sm"
          />
          STRENGTH AI
        </Link>

        <Link
          to="/"
          className="text-muted flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold no-underline transition-colors hover:text-white"
          activeProps={{ className: "bg-surface-selected text-accent" }}
        >
          Today
        </Link>
      </nav>
    </header>
  )
}
