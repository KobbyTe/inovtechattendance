import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicAnnouncement } from "@/lib/announcements.functions";
import { ArrowUpRight, CalendarDays, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/programs/$slug")({
  loader: ({ params }) => getPublicAnnouncement({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const title = loaderData?.title
      ? `${loaderData.title} — Inovtech STEM Center`
      : "Program — Inovtech STEM Center";
    const description = (loaderData?.body_plain ?? "Inovtech STEM Center programs and cohorts.")
      .slice(0, 155);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (loaderData?.flyer_image_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: loaderData.flyer_image_url });
      meta.push({ name: "twitter:image", content: loaderData.flyer_image_url });
    }
    return { meta };
  },
  errorComponent: () => <Shell><p className="text-muted-foreground">This program page could not be loaded.</p></Shell>,
  notFoundComponent: () => <Shell><p className="text-muted-foreground">Program not found.</p></Shell>,
  component: ProgramPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary leading-tight">Inovtech STEM Center</p>
            <p className="text-[11px] text-muted-foreground leading-tight">Programs & cohorts</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Back to attendance</Link>
      </footer>
    </div>
  );
}

function ProgramPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold mb-2">Program not available</h1>
        <p className="text-muted-foreground">
          This announcement may have been removed or is not published yet.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <article className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(data.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight mb-5">{data.title}</h1>

        {data.flyer_image_url && (
          <img
            src={data.flyer_image_url}
            alt={`${data.title} flyer`}
            loading="lazy"
            className="w-full rounded-xl border border-border shadow-sm mb-6"
          />
        )}

        <div
          className="prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_p]:mb-3"
          // Body is authored by an authenticated admin in the console.
          dangerouslySetInnerHTML={{ __html: data.body_html }}
        />

        {data.program_form_link && (
          <a
            href={data.program_form_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02]"
          >
            Apply / Register now <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
      </article>
    </Shell>
  );
}
