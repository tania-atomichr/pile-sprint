# Security policy

## Reporting a problem

Please do **not** open a public issue for a security problem.

Report it privately through
[GitHub's private vulnerability reporting](../../security/advisories/new)
(the **Security** tab, then **Report a vulnerability**). Include what you
found, how to reproduce it, and what someone could do with it.

You should hear back within a week. Once a fix is released we will credit
you in the release notes, unless you would rather not be named.

## Supported versions

Only the latest release gets security fixes.

## What counts

Anything that breaks the promises in the README's Privacy section, for
example:

- text from a pile (an email, a CSV cell, a file name) running as HTML or
  script on the card;
- a link or picture address that is not http, https, blob or a picture
  `data:` address reaching the page;
- anything changing in a pile before Save is pressed, or a file being deleted
  instead of moved into the set-aside folder;
- a token or a pile's contents being sent anywhere other than the destination
  the page's own code chose, or a token ending up in a URL.
