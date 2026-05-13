import { siFacebook } from "simple-icons";

export function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: siFacebook.svg }}
    />
  );
}