import { CategoryChip, ContentCard, PageContainer, PageHeader, SectionHeader } from "../../components/layout.js";

export function GenericPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <ContentCard>
        <SectionHeader
          title="Main Content Area"
          description="This page intentionally keeps the Home shell untouched and only swaps the content section."
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <CategoryChip active>Primary Context</CategoryChip>
          <CategoryChip>Secondary Filter</CategoryChip>
          <CategoryChip>Audience Segment</CategoryChip>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            "Reusable navbar and sidebar remain identical to Home.",
            "Color tokens, card styles, and spacing reuse the same system values.",
            "This placeholder proves new pages only change content, not permanent layout.",
          ].map((copy, index) => (
            <div
              key={index}
              className="rounded-xl border border-[rgb(64_72_93_/_0.22)] bg-surface-container-high p-5 text-sm text-on-surface-variant"
            >
              {copy}
            </div>
          ))}
        </div>
      </ContentCard>
    </PageContainer>
  );
}
