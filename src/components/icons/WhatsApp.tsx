import { siWhatsapp } from "simple-icons/icons";

export function WhatsAppIcon({ size = 22, className = "" }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <path d={siWhatsapp.path} />
    </svg>
  );
}
