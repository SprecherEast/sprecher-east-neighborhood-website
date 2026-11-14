---
name: make-illustration
description: Make a picture for a post or an event with the shared illustration generator — a drawn scene on the left and a large text panel on the right, built from the parts library, checked for panel text, exported as a JPG. Use whenever a post or event needs an illustration, or an existing one has to be redrawn or regenerated.
---

# make-illustration

One tool makes every post and event picture: [`scripts/illustrations/`](../../../scripts/illustrations/README.md).
Read its README for the layout. The rules about what a good picture is live in
[Images made for the site](../../../docs/guidelines/images.md); this skill is the procedure.

## Steps

1. **Find the subject's facts.** Read the post or event (live, through its API page) and take its
   panel lines from it. If the item already has panel text, use it word for word. Check the site for
   an existing picture of the same subject first.
2. **Reuse what is established.** A real place that already has an illustration is a part in
   `places.py`. Use it unchanged. If the owner supplied a photo or aerial, trace it into a new part
   there and name the source in its docstring. If nothing was supplied, draw a sensible scene with no
   invented named landmark and do not stop to ask for a photo.
3. **Mock up first.** Add the scene as a function in `scripts/illustrations/scenes/`, register it in
   `scenes/__init__.py`, and build it: `python3 -m scripts.illustrations.build --out DIR --render
--only NAME`. Look at the JPG at card size, then show the owner and agree the look before the final.
   Build from the parts in `parts.py`; add a part there the second time anything is drawn.
4. **Panel text.** The scene ends with `panel([title lines], [bullets])`. Never shorten a line to
   fit; if the build reports a line too wide, reword the line with the owner or the scene, never
   the sizes in `settings.py`.
5. **Check.** `python3 -m scripts.illustrations.build --check` must report no problems, and the
   picture must keep the card's overlay corner empty (`CLEAR_ZONE` in `settings.py`).
6. **Review, publish, verify.** Run [`visual-design-review`](../visual-design-review/SKILL.md) on the
   finished JPG, then upload it to the CMS with alt text that includes the panel's words, set it
   as both the item's picture and its link-preview picture, and open the live page at phone and
   desktop width.

## Never

- Change a panel size for one picture, drop a bullet, or reword published panel text.
- Redraw an established real subject differently, or invent a named landmark.
- Publish before the owner approved the look, or without viewing the picture at card size.
