# HTML page fixtures

Trimmed copies of the list markup on the pages the HTML parsers read (`../../lib/html.mjs`, #390),
as the pages served it on 2026-10-27: the same elements and classes, fewer items, and an extra
item where a test needs a case the live page didn't show (a cancellation, a time range, a month-only date, an empty box, a
link to another site). Navigation, scripts and styles are left out; WisDOT's "Upcoming Virtual Meeting" box keeps its
real text in simpler markup, since the parser reads only its text. Phone numbers and conference IDs are
replaced with placeholders.
