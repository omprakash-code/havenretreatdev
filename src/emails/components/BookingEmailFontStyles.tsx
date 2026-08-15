/**
 * The one <style> block shared by every booking email.
 *
 * BookingEmailHeader renders it, so any template with a header gets these rules
 * automatically — there is no second copy to keep in sync.
 *
 * There is deliberately no layout CSS here. The header is a single-column table
 * that stacks identically at every width, so it needs no media query and cannot
 * be broken by a client that strips <style>. What remains is the webfont and
 * the dark-mode protections, both of which are pure progressive enhancement.
 *
 * Note: this is a JS template literal — do not use backticks in the CSS.
 */
export default function BookingEmailFontStyles() {
  return (
    <style>
      {`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Playfair+Display:wght@700;800;900&display=swap');

/* The header is a white band by design. Declaring the scheme stops clients that
   honour it (Apple Mail, iOS, Outlook) from auto-inverting the whole email. */
:root {
  color-scheme: light;
  supported-color-schemes: light;
}

/* --- Dark mode ----------------------------------------------------------
   Keep the header band white with dark text where the client lets us say so.
   Apple Mail and iOS Mail honour prefers-color-scheme; Outlook.com rewrites
   markup and is targeted with its data-ogsc/data-ogsb hooks.
   Gmail's mobile dark mode force-inverts and ignores both — that is a client
   limitation, not something worth breaking compatibility to defeat. */
@media (prefers-color-scheme: dark) {
  .hr-email-header {
    background-color: #ffffff !important;
  }
  .hr-email-header-text {
    color: #111827 !important;
  }
  .hr-email-logo {
    /* Keep the mark on its intended white ground. */
    background-color: #ffffff !important;
  }
}

[data-ogsc] .hr-email-header,
[data-ogsb] .hr-email-header {
  background-color: #ffffff !important;
}
[data-ogsc] .hr-email-header-text,
[data-ogsb] .hr-email-header-text {
  color: #111827 !important;
}
`}
    </style>
  );
}
