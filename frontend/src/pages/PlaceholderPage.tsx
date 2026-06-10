interface PlaceholderPageProps {
  title: string;
}

/** Stand-in for pages that land in later phases (GLD-10 → GLD-12). */
export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This page is coming in a later phase.
      </p>
    </div>
  );
}
