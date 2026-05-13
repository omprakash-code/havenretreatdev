type AdminIdentity = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AvatarSurface = "header" | "profile";

const DEFAULT_HEADER_IMAGE = "/media/site/shared/arpan-mittal.webp";
const DEFAULT_PROFILE_IMAGE = "/media/site/shared/arpan-mittal-profile.png";
const VEDVART_IMAGE = "/media/site/shared/vedvart.png";

const VEDVART_EMAILS = new Set(["vedvarthooda@gmail.com"]);
const VEDVART_PHONES = ["7011134959"];

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function isVedvartAdmin(identity: AdminIdentity) {
  const normalizedEmail = normalizeText(identity.email);
  if (normalizedEmail && VEDVART_EMAILS.has(normalizedEmail)) {
    return true;
  }

  const normalizedPhone = normalizeDigits(identity.phone);
  if (
    normalizedPhone &&
    VEDVART_PHONES.some((phone) => normalizedPhone.endsWith(phone))
  ) {
    return true;
  }

  const normalizedName = normalizeText(identity.fullName);
  if (
    normalizedName.includes("vedvart") ||
    normalizedName.includes("vedvert")
  ) {
    return true;
  }

  return false;
}

export function resolveAdminProfileImage(
  identity: AdminIdentity,
  surface: AvatarSurface
) {
  if (isVedvartAdmin(identity)) {
    return VEDVART_IMAGE;
  }

  return surface === "profile" ? DEFAULT_PROFILE_IMAGE : DEFAULT_HEADER_IMAGE;
}

