# Design

## Purpose

1. A visitor from X learns in five seconds who Chinh is, what he builds, and what to read.
2. Long posts are comfortable to read on a phone and a desktop.
3. Writing a post or updating a project needs no layout work.

## Direction

Text-first personal site, in the spirit of world.hey.com/dhh and sive.rs, with a
small portfolio section. Base theme: AstroPaper. Borrowed: its reading column,
dark mode, search and accessible defaults. Changed: typography, home page
(hero, projects, recent posts), navigation (Posts, Projects, About, language).

## Tokens

- Text: IBM Plex Sans (400–700, Latin + Vietnamese subsets). Code and OG
  images: Google Sans Code. Be Vietnam Pro is banned.
- Colours: `src/styles/theme.css`. Light and dark values must both pass WCAG AA
  for body text and links.
- Reading width: AstroPaper's `max-w-app`.

## Rules

- Dark mode follows the system on the first visit; the reader's choice is stored.
- One accent colour for links and headings. No decorative imagery.
- Every page works with keyboard only and shows a visible focus ring.
- Home page order: hero, projects (up to three), recent posts.
