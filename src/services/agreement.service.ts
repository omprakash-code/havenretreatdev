import { findActiveAgreementTemplate } from "@/repos/agreement.repo";

export async function getActiveAgreementTemplate() {
  const template = await findActiveAgreementTemplate();
  if (!template) {
    return null;
  }

  return {
    id: template.id,
    title: template.title,
    content: template.content,
    version: template.version,
    isActive: template.isActive,
  };
}
