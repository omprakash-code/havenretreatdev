import { siX } from "simple-icons";

export function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: siX.svg }}
    />
  );
}