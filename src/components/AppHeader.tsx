import logoInovtech from "@/assets/logo-inovtech.png";

export function AppHeader({ subtitle = "Attendance System" }: { subtitle?: string }) {
  return (
    <header className="bg-card border-b border-border">
      <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden p-1">
          <img src={logoInovtech} alt="Inovtech logo" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-primary leading-tight truncate">
            Inovtech Future Skills Bootcamp
          </h1>
          <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
        </div>
      </div>
    </header>
  );
}