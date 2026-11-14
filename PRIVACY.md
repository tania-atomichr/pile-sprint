# Privacy

Pile Sprint is a script that runs inside a web page. It has no server, no
account and no analytics, and it sends nothing anywhere on its own.

- **Your pile stays where it was.** Cards are drawn from the items the page
  hands in. Photos picked from your computer are shown from the browser's own
  memory and are never uploaded.
- **Something leaves the browser only through a destination the page's code
  chose**: the webhook in `src/destinations.js` sends the id, answer and title
  of each item (never picture addresses), and only when Save is pressed. A
  token goes in the `Authorization` header, never the address.
- **Nothing is deleted.** The folder destination moves dropped files into a
  "Set aside" folder next to them. Bringing one back is a drag in your file
  manager.
- **The demo page** (`index.html`) loads the League Spartan and Source Code
  Pro fonts from Google Fonts. Remove those two `<link>` tags to load nothing
  from outside; the page falls back to your system font.
