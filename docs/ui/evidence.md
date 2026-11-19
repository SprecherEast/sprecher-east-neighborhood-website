# Evidence: duplication, inconsistencies, bugs

Part of the [UI inventory](inventory.md) (#170). What the inventory found, with file references. The
duplication is the case for each shared component in the [component set](component-set.md). Route
folders are under `src/app/(frontend)/`. Nothing here is fixed in this change; the fixes belong to
the component work under #163 or to their own issues.

File references are as they were when the inventory was taken. Since then #223 replaced the
form-builder field files under `src/blocks/Form/` (`Width/`, `Error/` and the rest) with `Field`,
#133 moved the form block to `src/modules/contact/ui/FormBlock.client.tsx`, and #134 moved
`login/LoginForm.tsx` and `account/ChangePasswordForm.tsx` to `src/modules/accounts/ui/`
(`SignInForm.client.tsx`, `ChangePasswordForm.client.tsx`). #137 moved the plugin setup from
`src/plugins/index.ts` into `src/payload.config.ts`, and the theme providers and
`ThemeSelector` from `src/providers/` to `src/platform/theme/`.

## Duplication

| ID  | What is repeated                                                                                                                                                                                                                                                                            | Where                                                                                                                                                                                                                                                                                                                                                                                                                           | Shared component                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| D1  | Buttons built from raw classes instead of `Button`, eight times. Heights `h-9`, `min-h-10`, `min-h-11`; corners `rounded-md`, `rounded-lg`, `rounded-xl`; weight medium or semibold.                                                                                                        | `src/modules/site/ui/SiteHeaderBar.client.tsx:125`, `:200`; `src/platform/ui/SidebarCTA.tsx:16`; `events/[slug]/page.tsx:108`; `src/modules/site/ui/HighImpactHero.tsx:12`; `src/modules/site/ui/CallToActionBlock.tsx:34`; `src/platform/ui/LoadMore.client.tsx:150`; `src/platform/ui/VersionCheck.client.tsx:117`                                                                                                            | `Button`                                |
| D2  | Text links built by hand: raw `<a>` in three places, two back links, and the same nav classes written for desktop and mobile.                                                                                                                                                               | `src/modules/events/ui/EventLocation.tsx:20`; `src/modules/directory/ui/ResourceCard.tsx:18`, `:28`; `posts/page/[pageNumber]/page.tsx:43`; `events/list/[scope]/[page]/page.tsx:44`; `src/modules/site/ui/HeaderNav.client.tsx:47`, `:76`, `:101`, `:111`; `src/modules/site/ui/SiteHeaderBar.client.tsx:106`, `:117`, `:169`, `:189`                                                                                          | `Link`                                  |
| D3  | Fourteen card shells, each with its own corner, shadow and padding (`rounded-lg`/`xl`/`2xl`/`[0.8rem]`; `shadow-sm`/`md`/none; `p-4` to `p-12`). Every elevated card has both a border and a shadow; the UI guideline says one or the other. `ui/card.tsx` is unused.                       | `src/modules/news/ui/PostCard.client.tsx:28`; `src/modules/events/ui/EventCard.tsx:61`, `:78`; `src/modules/directory/ui/ResourceCard.tsx:11`; `resources/page.tsx:41`; `src/modules/directory/ui/FaqList.tsx:13`; `account/page.tsx:19`, `:33`; `src/modules/events/ui/EventLocation.tsx:15`; `events/page.tsx:43`; `src/modules/site/ui/ContentBlock.tsx:58`, `:63`, `:70`; `src/modules/contact/ui/FormBlock.client.tsx:111` | `Card`                                  |
| D4  | Form-field scaffolding (label, required mark, error, width) copied into eight files. `Select`, `State` and `Country` are one component written three times. Login and account use a third pattern.                                                                                          | `src/blocks/Form/{Text,Email,Number,Textarea,Select,State,Country,Checkbox}/index.tsx`; `login/LoginForm.tsx:51`; `account/ChangePasswordForm.tsx:65`                                                                                                                                                                                                                                                                           | `Field`                                 |
| D5  | Page header (eyebrow, h1, lead) copied nine times with drift: search has no eyebrow, resources and search lack `text-balance`, bottom margins differ, login and account use a smaller h1.                                                                                                   | `posts/page.tsx:19`; `posts/page/[pageNumber]/page.tsx:36`; `events/page.tsx:22`; `events/list/[scope]/[page]/page.tsx:37`; `faq/page.tsx:19`; `resources/page.tsx:16`; `search/page.tsx:65`; `login/page.tsx:17`; `account/page.tsx:17`                                                                                                                                                                                        | `PageHeader`                            |
| D6  | Six empty states with five looks: boxed or plain, centred or left, `text-lg` or not, `p-8` to `p-12`.                                                                                                                                                                                       | `src/modules/news/ui/PostsFeed.client.tsx:18`; `events/page.tsx:43`; `faq/page.tsx:38`; `resources/page.tsx:41`; `search/page.tsx:77`; `not-found.tsx:9`                                                                                                                                                                                                                                                                        | `EmptyState`                            |
| D7  | The event hero with a photo is a copy of the post hero: same grid, classes and fade. Resolved in #461: both use `PageHeader · image`.                                                                                                                                                       | `src/modules/news/ui/PostHero.tsx:17–56`; `src/modules/events/ui/EventHero.tsx:23–64`                                                                                                                                                                                                                                                                                                                                           | `PageHeader`                            |
| D8  | Two date-badge implementations, and `<time>` plus a format helper written by hand six times, with `dateTime` set two different ways.                                                                                                                                                        | `src/modules/events/ui/EventCard.tsx:20`; `src/modules/events/ui/SidebarEvents.tsx:27`; `src/modules/news/ui/PostCard.client.tsx:59`; `src/modules/events/ui/EventCard.tsx:64`, `:111`; `src/modules/news/ui/PostHero.tsx:45`; `src/modules/events/ui/EventHero.tsx:37`, `:81`                                                                                                                                                  | `DateBadge`, `DateTime`                 |
| D9  | Metadata lists: icon-and-text rows and label-and-value pairs in five layouts.                                                                                                                                                                                                               | `src/modules/events/ui/EventCard.tsx:108`; `src/modules/site/ui/SiteFooter.tsx:54`; `src/modules/news/ui/PostHero.tsx:31`; `src/modules/events/ui/EventHero.tsx:34`, `:78`; `account/page.tsx:21`                                                                                                                                                                                                                               | `MetaList`                              |
| D10 | Option labels kept in more than one place. Event formats (#131), and FAQ and resource categories (#136), are now one list each (the cited lines); event categories now come from the category tree shared with posts (#362). The category pill was a class string; it's `Badge` since #418. | `src/modules/events/domain/locationTypes.ts` and `src/modules/events/cms/events.ts`; `src/modules/directory/domain/categories.ts:8`, `:18`                                                                                                                                                                                                                                                                                      | `Badge`; one `as const` list per module |
| D11 | Rich text restyled from outside with `[&_h1]`, `[&_h2]`, `[&_p]` selectors.                                                                                                                                                                                                                 | `src/modules/site/ui/HighImpactHero.tsx:41`, `:54`; `src/modules/site/ui/LowImpactHero.tsx:25`; `src/modules/site/ui/ArchiveBlock.tsx:20`; `src/modules/site/ui/CallToActionBlock.tsx:20`; `src/modules/site/ui/ContentBlock.tsx:58–73`                                                                                                                                                                                         | `RichText` variants                     |
| D12 | Three different "no image" placeholders.                                                                                                                                                                                                                                                    | `src/modules/news/ui/PostCard.client.tsx:37`; `src/modules/events/ui/EventCard.tsx:88`; `src/modules/news/ui/SidebarPosts.tsx:33`                                                                                                                                                                                                                                                                                               | `Media` `fallback`                      |
| D13 | Five grid class sets for card lists.                                                                                                                                                                                                                                                        | `src/modules/news/ui/PostGrid.tsx:11`; `src/modules/events/ui/EventsFeed.client.tsx:25`; `resources/page.tsx:32`; `src/modules/site/ui/ContentBlock.tsx:36`, `:37`                                                                                                                                                                                                                                                              | `CardGrid`                              |
| D14 | Two ways to make a whole card clickable: a JavaScript hook and a CSS stretched link.                                                                                                                                                                                                        | `src/modules/news/ui/useClickableCard.ts` used by `src/modules/news/ui/PostCard.client.tsx:19`; `src/modules/events/ui/EventCard.tsx:17`                                                                                                                                                                                                                                                                                        | `Card` (`CardTitle href`)               |
| D15 | Header markup written twice (desktop and mobile), and the menu's Escape, focus return and scroll lock written by hand.                                                                                                                                                                      | `src/modules/site/ui/HeaderNav.client.tsx:33–86` and `:88–119`; `src/modules/site/ui/SiteHeaderBar.client.tsx:100–128` and `:162–203`, `:51–82`                                                                                                                                                                                                                                                                                 | `SiteHeader`, `Dialog`                  |

## Bugs found while taking the inventory

Each one is visible in the linked screenshot or was checked in the browser. Worth an issue each;
none is fixed here.

1. **Search sends event results to a 404.** The search index holds posts and events
   (`src/plugins/index.ts:137`), but every result is drawn as a post card linking to
   `/posts/<slug>` (`src/modules/news/ui/PostCard.client.tsx:78`). All four "council" results
   are events and all four links return 404. [Screenshot](screenshots/search-results-1280-light.webp).
2. **A search link loses its query.** Opening `/search?q=council` shows results, then the empty
   box rewrites the address to `/search` after 200 ms (was `src/search/Component.tsx:9–16`; fixed
   in #223).
3. **The search query isn't encoded.** Typing `a&b` produces `?q=a&b`, so the server searches for
   `a` (was `src/search/Component.tsx:15`; the security guideline asks for `encodeURIComponent`;
   fixed in #223).
4. **The header ignores the visitor's theme.** Five pages force a theme on the header, and a sixth
   does when the event has a photo:
   - light: CMS pages (`[slug]/page.client.tsx:10`), `/posts` (`posts/page.client.tsx:10`),
     `/posts/page/[n]` (`posts/page/[pageNumber]/page.client.tsx:10`) and `/search`
     (`search/page.client.tsx:10`);
   - dark: a post (`posts/[slug]/page.client.tsx:10`) and an event with a photo
     (`events/[slug]/page.client.tsx:14`).

   Their comments say "dark" where the code sets light. Dark mode gets a light header on
   [home](screenshots/home-1280-dark.webp); light mode gets a dark header on a
   [post](screenshots/post-1280-light.webp). Fixed in #201: the header always follows the
   visitor's theme, and the forcing code is gone.

5. **A post without a photo gets an empty 80vh band** with a black fade behind the title; the post
   hero has no plain look (`src/modules/news/ui/PostHero.tsx:51`).
   [Screenshot](screenshots/post-no-image-1280-light.webp). Fixed in #461: a post without a photo
   gets the plain `PageHeader`.
6. **The SEO image never reaches the site (#196).** The seed sets `meta.image` on every post, and
   the database stores it, but reads return `meta` without `image`. The cause: `pages`, `posts`
   and `events` each have two `meta` fields. One is the hand-written SEO tab, which has the image
   (`src/modules/news/cms/posts.ts:127`). The other is the group the SEO plugin adds itself,
   because `seoPlugin` is given `collections: ['pages', 'posts', 'events']`
   (`src/plugins/index.ts:74–78`). That group has no image, and reads return it. The Payload
   website template leaves `collections` out of `seoPlugin` for this reason. It's also why the
   generated types lack `meta.image` (the
   [SEO plugin type gap](../guidelines/payload-cms.md#seo-plugin-type-gap)). Impact:
   - post cards and sidebar thumbnails show placeholders (`src/modules/news/ui/PostCard.client.tsx:34`,
     `src/modules/news/ui/SidebarPosts.tsx:33`) ([screenshot](screenshots/home-1280-light.webp));
   - every page, post and event shares the default Open Graph image (`/images/photo.jpeg`)
     instead of its own (`src/platform/seo/generateMeta.ts:25`).

   The fix belongs in the plugin config (#196), not in the cards: making cards read `heroImage`
   would hide the symptom and leave every share image wrong.

7. **Residents see the Payload admin bar** ("Dashboard", "New Page", "Logout") for an admin they
   can't open; it shows for any signed-in user (`src/platform/ui/AdminBar.client.tsx:41`).
   [Screenshot](screenshots/account-1280-light.webp).
8. **Server error text reaches visitors.** The contact form shows "Internal Server Error"
   (then `src/blocks/Form/Component.tsx:119`; fixed by #223, which shows fixed texts in
   `src/modules/contact/ui/FormBlock.client.tsx` since #133); the password form shows the server's message
   (`account/ChangePasswordForm.tsx:49`). The conventions ask for fixed, friendly messages.
   [Screenshot](screenshots/contact-server-error-1280-light.webp).
9. **Half-width form fields never share a row**, and stay half width on phones
   (`src/blocks/Form/Width/index.tsx:9`). [Screenshot](screenshots/ui-fixture-form-errors-375-light.webp).
10. **Field errors are silent to screen readers:** no `role`, no `aria-describedby`, no
    `aria-invalid` (`src/blocks/Form/Error/index.tsx:11`).
11. **White text on the primary colour fails contrast in dark mode:** 3.35:1 on `#4e9b76`, below
    4.5:1. It affects the header's Contact button, form and login buttons, the sidebar box and the
    toast. The home hero and CTA block work around it with `primary-dark`
    (`src/modules/site/ui/HighImpactHero.tsx:73`); the token fix belongs to #146.
12. **`Button`'s `destructive` variant is unreadable:** `--destructive-foreground` equals
    `--destructive` (`src/app/(frontend)/globals.css:120–121`, `:156–157`). Unused today.
13. **The medium-impact hero sits flush under the header** with no top spacing
    (`src/modules/site/ui/MediumImpactHero.tsx:12`). [Screenshot](screenshots/ui-fixture-1280-light.webp).
14. **The empty events page points to a section that isn't there.** With no upcoming events it says
    "browse past events below" (`events/page.tsx:46`), but with no past events either, the past
    section is hidden and the sentence leads nowhere (S2).
    [Screenshot](screenshots/events-empty-1280-light.webp).

## Inconsistencies

- **Reading widths:** five different caps for the same job (L10), plus two form widths (L11).
- **Spacing:** page paddings `pt-24`, `py-16`, `pt-16`, `py-28`; block paddings `py-8 md:py-10`
  and `py-10 md:py-14`. The UI guideline asks for `py-16 md:py-20 lg:py-24` between sections.
- **Corners:** buttons `rounded-md`, `rounded-lg`, `rounded-xl`; cards `rounded-lg`,
  `rounded-2xl`; the form box and framed image `rounded-[0.8rem]`; the banner `rounded`.
- **Heading weight:** the post hero and the event hero with a photo render their h1 at weight 400
  (`globals.css:13` resets heading weight; `PostHero.tsx:29`, `src/modules/events/ui/EventHero.tsx:32`).
  Every other h1, including the plain event hero, is bold. Fixed in #461: `PageHeader · image`
  sets its h1 bold.
- **Wording:** "Log In" in the header and page title, "Sign In" on the button; "Sign Out" in the
  header, "Logout" in the admin bar.
- **Required mark:** before the label on checkboxes, after it elsewhere, missing in login and
  account (where every field is required).
- **Overline headings:** `tracking-widest` in the footer, `tracking-wider` in the sidebar.
- **New-tab links:** the map and register links tell screen readers they open a new tab; "Visit
  Website" and CMS links that open a new tab don't.
- **Repeated date:** the compact event card shows the date in its badge and again as text (C6).
- **Hover without a link:** resource cards lift on hover but go nowhere (`src/modules/directory/ui/ResourceCard.tsx:11`).
- **Colours outside the tokens:** `text-red-500` (`src/blocks/Form/Error/index.tsx:11`),
  `bg-white` and `border-white` in the CTA block (`CallToAction/Component.tsx:38`), `text-white`
  in the toast (`VersionCheck/index.tsx:117`), `bg-black` in the code block
  (`Code/Component.client.tsx:17`), `text-white` in the post placeholder (`PostCard.client.tsx:39`),
  `focus:text-white` on the skip link (`src/app/(frontend)/layout.tsx:44`), and `bg-black` and
  `text-white` on the admin bar (`src/platform/ui/AdminBar.client.tsx:47`, `:55–59`). Rule 9 allows
  white and black only on photos until #146.
- **Inline style:** the form field width uses `style={{ maxWidth }}` (`Width/index.tsx:9`), and the
  admin bar passes a `style` object to Payload's bar (`src/platform/ui/AdminBar.client.tsx:75`).
- **Admin icon in public UI:** the code block's copy button imports Payload's admin icon
  (`src/platform/richtext/CopyButton.client.tsx:3`) instead of Lucide.
- **Unthemed browser control:** the search box shows the browser's blue clear button.

## Code with no visible UI

- `src/blocks/RelatedPosts/Component.tsx`: not used anywhere (removed in #132).
- `src/providers/Theme/ThemeSelector`: built but never rendered, so visitors can't choose a theme;
  dark mode only follows the system setting.
- `src/components/ui/card.tsx`: not used; every card is hand-built (D3). Removed in #135.
- `team-members` and `events.featured`: stored, never shown ([data types](data-types.md#data-with-no-public-ui-today)).
