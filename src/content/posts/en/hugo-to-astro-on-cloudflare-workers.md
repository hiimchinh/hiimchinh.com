---
title: "How I moved a Hugo blog to Astro on Cloudflare Workers without breaking old URLs"
description: "My old Hugo 0.73 site on Netlify got 44 HTML views in a day, and almost all of them were bots. Here is how I rebuilt it with Astro, served it as static assets from a Worker, and kept every old URL working with 301 redirects and a test."
pubDatetime: 2026-10-14T17:30:00+07:00
featured: true
draft: true
tags: ["astro", "cloudflare"]
---

<!-- DRAFT NOTES FOR CHINH (remove before publishing):
1. Every number and step below comes from the migration on 12 October 2026. Correct anything that is wrong.
2. Decide whether to say that a coding agent did most of the work. If yes, add one paragraph in your own words.
3. Add one sentence on why you picked Astro over staying on Hugo, if you remember the reason. -->

My personal site ran on Hugo 0.73 on Netlify. It had one post from 2021 and I had not touched it in years.

Before I moved it, I looked at one day of traffic in Cloudflare. About 2,400 requests reached the site. 44 of them were HTML pages that returned 200. As far as I can tell, about one of those was a person. The rest were scanners looking for `.env` files and `wp-login.php`, and AI crawlers.

So I was not migrating to save a popular blog. I wanted a site I would actually write on, in English and Vietnamese, that agents can read as easily as people. Here is what I did, and the part I was most careful about: not breaking the old URLs.

## Table of contents

## The new stack

- **Astro 7** with the AstroPaper theme. It gives a reading column, dark mode, search and accessible defaults.
- **Cloudflare Workers, static assets only.** There is no Worker code. `pnpm build` writes the site to a folder, and Wrangler uploads it.
- **GitHub Actions** runs lint, tests and the build on every push, then deploys `main`.

The whole Worker configuration is this:

```jsonc
{
  "name": "hiimchinh-com",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,
  "assets": {
    "directory": "./dist",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page",
  },
}
```

`html_handling: "auto-trailing-slash"` serves `/about/index.html` at `/about/`, the same URL shape Hugo used. `not_found_handling: "404-page"` returns the built `404.html` with a real 404 status. Without it, a typo in a URL looks like an empty success to a search engine.

## Keeping the old URLs

Hugo put my post at `/2021/05/translate_file_permissions_linux/`. Astro puts it at `/posts/translate-file-permissions-linux/`. A few other Hugo paths also changed: `/post/` became `/posts/`, the feed moved from `/index.xml` to `/rss.xml`, and the contact page became a section of the About page.

Workers static assets read a `_redirects` file in the same format as Netlify and Cloudflare Pages. Mine is short:

```text
/2021/05/translate_file_permissions_linux/ /posts/translate-file-permissions-linux/ 301
/2021/05/translate_file_permissions_linux /posts/translate-file-permissions-linux/ 301
/post/ /posts/ 301
/post /posts/ 301
/index.xml /rss.xml 301
/contact/ /about/#contact 301
/contact /about/#contact 301
```

Each path is listed twice, with and without the trailing slash, because links on the internet use both. Every redirect is a 301, so search engines move the old URL's history to the new one.

## A test so redirects cannot quietly disappear

A redirect file is easy to break later. Rename a post or clean up a line, and an old link dies without any error. So the build has a contract test that reads the built `_redirects` and checks each old URL:

```ts
test("every URL of the Hugo site redirects permanently to its new home", () => {
  const rules = read("_redirects")
    .split("\n")
    .map(line => line.trim().split(/\s+/))
    .filter(parts => parts.length === 3);
  const target = (from: string) => rules.find(([source]) => source === from);
  assert.deepEqual(target(OLD_POST), [OLD_POST, NEW_POST, "301"]);
  assert.deepEqual(target("/post/"), ["/post/", "/posts/", "301"]);
  assert.deepEqual(target("/index.xml"), ["/index.xml", "/rss.xml", "301"]);
  assert.deepEqual(target("/contact/"), [
    "/contact/",
    "/about/#contact",
    "301",
  ]);
});
```

The rule in the repository is simple: every moved URL gets a line in `_redirects` and a case in this test.

## Deploying and switching the domain

The deploy job runs `wrangler deploy` with an API token that can only edit Workers scripts. Then a smoke test curls a few pages and fails the job on anything other than 200.

I deployed to the `workers.dev` URL first and checked it before touching DNS. Then I pointed the domain at the Worker:

1. A route `hiimchinh.com/*` to the `hiimchinh-com` Worker.
2. A redirect rule from `www` to the apex domain.
3. A rule that blocks the scanner paths (`.env`, `.git`, `wp-*`) before they reach the Worker.

Then I checked from the outside with curl. The home page returned 200 without any Netlify header, the old URLs returned 301 to the new ones, and `/.env` returned 403.

## What I would do the same way next time

- **Look at the traffic before you migrate.** Mine showed almost no audience to protect, but the old URLs were still worth keeping. They are cheap to keep and hard to get back once search engines drop them.
- **Put redirects under test.** They break silently.
- **Check the live site with curl, not the dashboard.** A deploy can succeed while the domain still points at the old host.
