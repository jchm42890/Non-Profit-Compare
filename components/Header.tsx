import Link from "next/link";
import { Heart } from "lucide-react";
import { CompareBadge } from "@/components/CompareBadge";
import { SearchBar } from "@/components/SearchBar";

interface HeaderProps {
  showSearch?: boolean;
}

export function Header({ showSearch = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm hidden sm:block">Nonprofit Compare</span>
        </Link>

        {showSearch && (
          <div className="flex-1 max-w-xl">
            <SearchBar size="default" placeholder="Search nonprofits…" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/search" className="hover:text-foreground transition-colors">Search</Link>
          </nav>
          <CompareBadge />
        </div>
      </div>
    </header>
  );
}
