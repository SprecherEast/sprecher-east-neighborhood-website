# Images made for the site

Applies to every illustration, graphic or edited picture we make and publish, whether it ships in
a code change or goes into the CMS. Summary of the owner's direction (2026-11-07, recorded on #812):
the review below happens before anything is published and again on the live page, and an image that
fails it is fixed, not published with a note. The checks come from the baseline in [UI/UX design](ui-ux-design.md#symmetry-and-alignment), applied to a
picture.

Summary of the owner's direction on illustrations for posts and events (2026-11-10, Claude session,
voice, confirmed in text, recorded on #1000): plain scenes were not enough. An illustration is
informative and engaging before anyone opens the item, so rules 5 to 9 add facts, real detail and a
text panel to the checks above.

1. **Keep clear what the layout draws over the image.** Find the component that overlays it (a date
   badge, a title, a gradient) and leave that area empty; put text where the overlay isn't. Read the
   component for the position, don't assume. Only the event card overlays a date badge, in the
   top-left corner, so an event picture keeps that corner empty. A post card puts nothing over its
   picture, so a post picture uses the whole canvas and leaves no space unused for a badge it
   doesn't have.
2. **Legible at the size it is shown.** Look at it at the card size on a phone, not only full size.
   Text that can't be read there is removed or made larger; labels never collide or hide each other.
3. **Say each thing once.** No text that repeats the title, the card's own text or the date badge,
   and the panel in rule 5 never does either.
4. **Everything earns its place.** Each element helps a neighbor recognise the subject (the real
   place, its name or sign, the people involved) or carries a fact. Delete decoration that adds no
   information.
5. **Informative before it is opened.** An illustration for a post or an event carries the few facts
   a neighbor needs that the card does not already show (what it costs, who it is for, what to
   bring, how to take part, as the subject calls for) in a text panel on the right side of the
   image, in type large enough to read at card size. It is written short: a title of a few words
   that names the subject, then a few bullets, each one fact as a short phrase, not a sentence.
   When something is still undecided, the last bullet says so. If the card already shows
   everything, the panel says less, not more. The news scenes in `scripts/illustrations/scenes/`
   are the model.
6. **The panel matches the site's style.** Square corners and the site's muted palette, never a
   pill or a bright badge look. It sits on the right, which also keeps an event picture's top-left
   clear (rule 1).
7. **Match the real thing.** A named place, sign or building looks like it, and the scene shows
   details that fit the real place and subject, not a generic scene. It stays inside one setting
   and doesn't mix unrelated ones.
8. **Safety subjects show the official response, calmly.** Show what neighbors would see the
   authorities do (tape, markers, an officer, as the subject calls for). Never a weapon, an injury,
   or a person who could be taken for a real one.
9. **Alt text includes the panel's words.** The panel's text is information, so the alt text states
   it along with what the scene shows, for people who can't see the image.
10. **Same style as the rest.** Follow the existing illustrations' palette, outline and type.
11. **Review, then publish, then check live.** Preview the finished file, fix what the checks above
    find, publish, and open the live page at phone width and desktop width to confirm.
12. **A picture that carries text is shown whole.** A post or event page shows its picture whole,
    never cropped, at the top of the article, so the text in it stays readable at every width. A
    cropping band behind a title can't promise that: it shows a different part of the picture at
    each width, and a focal point only chooses which part.
13. **The article picture is sized by the screen.** It fills the column above
    the text on a phone, takes about half the column beside the text on a tablet and about a third on
    a desktop, so it never pushes the article down. Its sizes come from the shared figure, never from
    a width typed on a page. It has no Enlarge button and opens no dialog, so the picture starts where
    the text does and is designed to stay readable at its shown size (the owner's decisions,
    2026-11-10, recorded on #1023, and 2026-11-11, recorded on #1055, Claude Code sessions).
14. **A backdrop belongs to the whole page.** A backdrop photo runs behind the page from top to
    bottom, faded, never confined to one band. The theme's background color lies over it as a
    scrim: solid where text is dense, so the text reads as it would on a plain page in light and
    in dark, and thinner where there is little or no text, which is where the photo shows. Text,
    buttons and cards never sit straight on the photo, and the scrim comes from the theme, never
    adjusted per photo. The crop is chosen on purpose for each screen size (phone, tablet,
    desktop), so the part of the photo worth seeing falls where the layout leaves room and its
    shapes and lines work with the text, buttons and blocks around it. Each crop is checked at
    every width, in both themes, before it is published. A photo that cannot do this is not used
    as a backdrop, and neither is a photo showing identifiable people. Where a backdrop still
    shows only behind a title, that is older work to replace, not a pattern to copy.

Summary of the owner's direction on how illustrations are made (2026-11-14, Claude Code session,
recorded on #1027): the principles below were settled by drawing and reviewing a full set, and are
made once, in the shared generator ([`scripts/illustrations/`](../../scripts/illustrations/README.md),
used through the [`make-illustration`](../../.agents/skills/make-illustration/SKILL.md) skill).

15. **The panel stays large.** Its width and its type sizes are fixed named settings in the
    generator, never changed for one picture. Text that does not fit is a reason to rethink the
    scene or the panel's lines, never to shrink the type.
16. **A published panel keeps its wording.** How short a panel is gets decided when it is written
    (rule 5). Once the item is published, every line and every bullet is kept, never trimmed,
    shortened or renamed to make a picture fit. A redraw restores the text from the live item
    rather than rewording it; the review checks each bullet against the published text.
17. **The panel carries the facts and the scene makes the subject recognizable.** The scene does
    not repeat the panel's facts as labels.
18. **Draw what the story needs, not a map.** Show the thing a neighbor should picture (an object,
    an action, the layout that matters), with its parts large enough to read at card size. When a
    concept does not read at that size, change the concept instead of adjusting details.
19. **Believable scale and substance.** Buildings are larger than people, and vehicles, people and
    bicycles are solid, shaped and sit on the ground in the right direction, never flat or paper
    thin. What a place carries (a road's lanes, a building's parts) matches the real place.
20. **Real subjects are reused exactly.** A subject with an agreed illustration keeps that exact
    outline in every picture. Anything the owner supplies (a photo, an aerial) is traced faithfully.
    When nothing is supplied, draw a sensible illustration of the subject with no invented named
    landmark; do not stop to ask for a photo. Mockups come first, and a look is agreed before the
    finals are made.
21. **An approved picture stays as approved.** A later request changes only what was asked.
22. **Finish check at card size.** Look at every final at the size the card shows it, with
    whatever its own card overlays left empty (an event's badge corner), before it is published.
