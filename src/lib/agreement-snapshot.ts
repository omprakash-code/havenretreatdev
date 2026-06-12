import {
  HAVEN_AGREEMENT_ACKNOWLEDGMENT,
  HAVEN_AGREEMENT_DEFAULT_TITLE,
  HAVEN_AGREEMENT_DEFAULT_VERSION,
  HAVEN_AGREEMENT_INTRO,
  HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS,
  HAVEN_AGREEMENT_SECTIONS,
} from "@/constants/haven-agreement-content";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildHavenAgreementHtmlSnapshot(input: {
  title?: string | null;
  version?: string | null;
  acknowledgedClauses: number[];
}) {
  const acknowledgedSet = new Set(input.acknowledgedClauses);
  const sections = [
    ...HAVEN_AGREEMENT_SECTIONS.map((section, index) => ({
      number: index + 1,
      eyebrow: section.eyebrow,
      title: section.title,
      body: section.body,
    })),
    ...HAVEN_AGREEMENT_REQUIRED_ACKNOWLEDGMENTS.map((section) => ({
      number: section.number,
      eyebrow: `Section ${section.number}`,
      title: `${section.number}. ${section.title}`,
      body: section.body,
    })),
  ];
  const sectionMarkup = sections
    .map(
      (section) =>
        `<section data-clause-number="${section.number}" data-acknowledged="${acknowledgedSet.has(
          section.number
        )}"><p>${escapeHtml(section.eyebrow)}</p><h2>${escapeHtml(
          section.title
        )}</h2><p>${escapeHtml(section.body.join("\n")).replaceAll(
          "\n",
          "<br />"
        )}</p><p><strong>Acknowledged</strong></p></section>`
    )
    .join("");

  return `
    <article>
      <header>
        <h1>${escapeHtml(input.title || HAVEN_AGREEMENT_DEFAULT_TITLE)}</h1>
        <p>Version ${escapeHtml(
          input.version || HAVEN_AGREEMENT_DEFAULT_VERSION
        )}</p>
      </header>
      <section>${HAVEN_AGREEMENT_INTRO.map(
        (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
      ).join("")}</section>
      ${sectionMarkup}
      <section>
        <h2>Final Acknowledgment</h2>
        <p>${escapeHtml(HAVEN_AGREEMENT_ACKNOWLEDGMENT)}</p>
      </section>
    </article>
  `.trim();
}
