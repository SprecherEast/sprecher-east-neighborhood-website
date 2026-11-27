---
name: make-illustration
description: Make a picture for a post or an event with the shared illustration generator — a drawn scene on the left and a large text panel on the right, built from the parts library, checked for panel text, exported as a JPG. Use whenever a post or event needs an illustration, or an existing one has to be redrawn or regenerated.
---

# make-illustration

One tool makes every post and event picture: [`scripts/illustrations/`](../../../scripts/illustrations/README.md).
Read its README for the layout. The rules about what a good picture is live in
[Images made for the site](../../../docs/guidelines/images.md); this skill is the procedure.

## What a good picture is

- **The scene shows the subject.** With the panel hidden, a neighbor can say what the item is about.
  One focal subject is drawn large, taken from what the item is about (the place, the object, the
  action), never generic people on a street. Mark it with `parts.focal` (or `parts.focal_group` for one
  moment made of a few parts). A place the post names is the real one, drawn from photographs; a kind
  of project is one the source documents.
- **One real-world scale.** People, vehicles, buildings and objects in a scene share one
  pixels-per-metre, and buildings and the focal subject are larger than people. Size parts with the
  helpers in `props.py`.
- **Composed in its frame.** Nothing touches or crowds an edge or runs behind the panel, the content
  fills the frame with no large empty band (move the camera closer, keep the scale true). A post
  picture uses the whole canvas; an event picture keeps the corner its card covers with the date badge
  clear (`CLEAR_ZONE` and `EVENT_SCENES` in `settings.py`). Nothing reads as an enclosure or barrier
  unless the subject is one, and a decorative object never sits over a subject.
- **Text sits centred in its part.** Draw the text of a calendar page, sign or lettering only with
  `parts.text_in`; the build fails text that is off centre or crowds its area, text drawn any other way,
  and place lettering that is too small to read at phone width.
- **A layout of its own.** A new scene does not repeat another scene's composition unless both draw
  the same place. Reuse parts, never compositions; don't start from the last scene's file.
- **The established rules hold.** Real neighborhood subjects, agreed outlines reused exactly, no
  invented named landmark, neighbors who reflect the area, a panel that is plain, short, complete
  and legible on a phone.

The build checks scale, safe area, balance, the focal subject, centred text and layout repeats by itself.
What it cannot judge (does the scene say the subject?) is the author's critique, step 4.

## Steps

1. **Find the subject's facts.** Read the post or event (live, through its API page) and take its
   panel lines from it. If the item already has panel text, use it word for word. Check the site for
   an existing picture of the same subject first.
2. **Reuse what is established.** A real place that already has an illustration is a part in
   `places.py`. Use it unchanged. If the owner supplied a photo or aerial, trace it into a new part
   there and name the source in its docstring. If nothing was supplied, draw a sensible scene with no
   invented named landmark and do not stop to ask for a photo.
3. **Concept, then mock up.** Name the focal subject in one sentence, from the item's own text. For a
   new subject sketch two distinct concepts. Add each as a function in `scripts/illustrations/scenes/`,
   register it in `scenes/__init__.py`, and build it: `python3 -m scripts.illustrations.build --out DIR
--render --only NAME`. Build from `parts.py` and `props.py`; a part drawn the second time is added
   there. The scene ends with `panel([title lines], [bullets])`; never shorten a line to fit, reword
   the line with the owner or the scene, never the sizes in `settings.py`.
4. **Critique before anyone sees it.** Render at card size and at phone width and look at each. Write
   down the answers: what is the subject with the panel hidden; what is focal and is it large; is
   everything at one scale; is anything near an edge, or is there dead space; does the layout differ
   from the others; is the panel intact; is every calendar page and sign legible and centred, looked at at full size and at phone width. Fix what fails, render again, and show the picture only when
   you would defend it. Keep the written critique in the pull request.
5. **Agree the look.** Show the owner every mockup beside the current picture at card size, and make
   the final only after he agrees; for a new subject, show each of the two concepts.
6. **Check.** `python3 -m scripts.illustrations.build --check` must report no problems. Pictures made
   before the rules are skipped until redrawn (`PRE_RULES_SCENES`); `--audit` judges them too.
7. **Review, publish, verify.** Run [`visual-design-review`](../visual-design-review/SKILL.md) on the
   finished JPG, then compare every panel line with the published text, upload it to the CMS with alt text that includes the panel's words, set it
   as both the item's picture and its link-preview picture, and open the live page at phone and
   desktop width.

## Never

- Change a panel size for one picture, drop a bullet, or reword published panel text.
- Redraw an established real subject differently, or invent a named landmark.
- Publish before the owner approved the look, or without viewing the picture at card size.
- Silence a failing scene check by editing a limit or the legacy list for one picture.
