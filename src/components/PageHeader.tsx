/** Title, an optional line under it and optional actions on the right, as on /websites. */
export default function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </header>
  );
}
