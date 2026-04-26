import Link from "next/link";
import { ArrowRight, BarChart3, Search, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { Card, CardContent } from "@/components/ui/card";

const FEATURED_ORGS = [
  { ein: "13-1837418", name: "American Red Cross", category: "Human Services" },
  { ein: "23-7327691", name: "Feeding America", category: "Food & Nutrition" },
  { ein: "13-1788491", name: "Doctors Without Borders", category: "Health Care" },
  { ein: "52-1693387", name: "World Wildlife Fund", category: "Environment" },
  { ein: "82-2230781", name: "Khan Academy", category: "Education" },
  { ein: "04-2103594", name: "Partners in Health", category: "Health Care" },
];

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary font-medium mb-6">
          <BarChart3 className="h-4 w-4" />
          IRS Form 990 Data Explorer
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Compare Nonprofits{" "}
          <span className="text-primary">Side by Side</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
          Search thousands of US nonprofits, analyze Form 990 financials, and compare
          program efficiency, growth, and executive compensation.
        </p>
        <div className="mt-8 max-w-xl mx-auto">
          <SearchBar size="lg" autoFocus />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
          <span>Try:</span>
          {["Red Cross", "Food Bank", "Education", "Health Care"].map((s) => (
            <Link
              key={s}
              href={`/search?q=${encodeURIComponent(s)}`}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {[
          {
            icon: Search,
            title: "Search & Discover",
            desc: "Find nonprofits by name, EIN, city, or category. Autocomplete search across 14 organizations.",
          },
          {
            icon: BarChart3,
            title: "Deep Financial Analysis",
            desc: "KPI cards, multi-year trend charts, expense ratios, and growth metrics — all from Form 990 data.",
          },
          {
            icon: GitCompare,
            title: "Side-by-Side Compare",
            desc: "Add up to 6 nonprofits to the compare tab. View 20+ metrics in a structured table with charts.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <Card key={title}>
            <CardContent className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Featured orgs */}
      <section className="mt-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Featured Nonprofits</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/search">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_ORGS.map((org) => (
            <Card key={org.ein} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <Link
                  href={`/nonprofit/${org.ein}`}
                  className="font-semibold text-sm hover:text-primary transition-colors"
                >
                  {org.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{org.category}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" asChild className="flex-1 text-xs h-7">
                    <Link href={`/nonprofit/${org.ein}`}>View Profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
