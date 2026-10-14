---
title: "How to move a static site from Netlify to Cloudflare Workers without breaking old URLs"
description: "Serve a static site as Workers static assets, keep every old URL with a _redirects file and a test that fails when a redirect goes missing, then switch the domain and check it with curl."
pubDatetime: 2026-10-14T17:30:00+07:00
featured: true
draft: true
tags: ["cloudflare", "netlify"]
---

<!-- DRAFT NOTES FOR CHINH (remove before publishing):
1. Every number and step below comes from the migration on 12 October 2026. Correct anything that is wrong.
2. Decide whether to say that a coding agent did most of the work. If yes, add one paragraph in your own words. -->

If your static site runs on Netlify and you want it on Cloudflare, you can serve it from a Worker with no Worker code at all. The build output goes up as static assets, and Cloudflare serves it.

The risky part is not the hosting. It is the URLs. Every link to your site from search results, old tweets and other blogs points at a path. If the new site changes that path and you do not redirect it, the link is dead and you will not get an error about it.

I moved my personal site this way in October 2026: an old Hugo site on Netlify, rebuilt with Astro, now on Workers. The steps below work for any static site generator, because Workers only sees the folder of built files.

## Table of contents

## 1. Serve the build folder as static assets

This is the whole Wrangler configuration:

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

There is no `main` entry, so there is no Worker script. Two settings matter:

- `html_handling: "auto-trailing-slash"` serves `about/index.html` at `/about/`. This is the URL shape most static site generators use, so your existing paths keep working.
- `not_found_handling: "404-page"` returns your built `404.html` with a real 404 status. Without it, a missing page can look like a success to a search engine.

Deploy it with `wrangler deploy`. With `workers_dev: true` the site is also available on a `workers.dev` address, so you can check it before you touch DNS.

## 2. List every old URL that changes

Make a list of the paths that will move. On my site:

- The only post moved from `/2021/05/translate_file_permissions_linux/` to `/posts/translate-file-permissions-linux/`.
- The post list moved from `/post/` to `/posts/`.
- The feed moved from `/index.xml` to `/rss.xml`.
- The contact page became a section of the About page.

The feed is easy to forget. Anyone who subscribed in a reader stops getting posts if the feed URL dies.

## 3. Redirect them with a `_redirects` file

Workers static assets read a `_redirects` file from the build folder. The format is the same one Netlify uses: source, destination, status code.

```text
/2021/05/translate_file_permissions_linux/ /posts/translate-file-permissions-linux/ 301
/2021/05/translate_file_permissions_linux /posts/translate-file-permissions-linux/ 301
/post/ /posts/ 301
/post /posts/ 301
/index.xml /rss.xml 301
/contact/ /about/#contact 301
/contact /about/#contact 301
```

Two details:

- **List each path with and without the trailing slash.** Links in the wild use both.
- **Use 301, not 302.** A 301 tells search engines the move is permanent, so the old URL's ranking moves to the new one.

Put the file where your generator copies static files into the build folder. In Astro that is `public/`.

## 4. Add a test that fails when a redirect goes missing

A redirect file breaks quietly. Someone renames a post or cleans up a line, and an old link dies with no error. So I test the built file, after `pnpm build`:

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

It reads the file from the build folder, not from the source folder, so it also catches a build step that drops the file. The rule in my repository is: every moved URL gets a line in `_redirects` and a case in this test.

## 5. Deploy from CI with a narrow token

My GitHub Actions workflow runs lint, tests and the build, then `wrangler deploy`. The Cloudflare API token can only edit Workers scripts, nothing else in the account. After the deploy, a smoke test requests a few pages and fails the job if any of them is not 200:

```bash
for path in / /posts/translate-file-permissions-linux/ /llms.txt; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://hiimchinh-com.ch-nh.workers.dev$path")
  echo "$path $code"
  test "$code" = 200
done
```

## 6. Switch the domain

When the `workers.dev` version looked right, I pointed the domain at it:

1. A route `hiimchinh.com/*` to the Worker.
2. A redirect rule from `www` to the apex domain.
3. A rule that blocks common scanner paths such as `.env`, `.git` and `wp-*` before they reach the Worker.

The third one is optional, but look at your traffic first. In one day before the move, my site got about 2,400 requests. Only 44 were HTML pages that returned 200, and I could find about one real person among them. Most of the rest were bots looking for leaked config files.

## 7. Check the live site with curl

The dashboard tells you a deploy succeeded. It does not tell you where the domain points. Check from outside:

```bash
curl -sI https://hiimchinh.com/
curl -sI https://hiimchinh.com/2021/05/translate_file_permissions_linux/
curl -sI https://hiimchinh.com/.env
```

I expected three things: the home page returns 200 with no Netlify headers, the old post URL returns 301 to the new one, and `/.env` returns 403.

## 8. Disconnect the Netlify site

Moving DNS is not the end. My Netlify site was still connected to the GitHub repository, so every pull request kept getting failing Netlify checks: a deploy preview, header rules, redirect rules. Nothing reached Netlify any more, but the red checks stayed on every PR. Disconnect the repository in the Netlify site settings once the domain has moved.
