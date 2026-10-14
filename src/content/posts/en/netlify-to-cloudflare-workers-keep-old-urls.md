---
title: "How to move a static site from Netlify to Cloudflare Workers without breaking old URLs"
description: "Serve a static site as Workers static assets, keep every old URL with a _redirects file and a test that fails when a redirect goes missing, then switch the domain and check it with curl."
pubDatetime: 2026-10-14T17:30:00+07:00
featured: true
tags: ["cloudflare", "netlify"]
audience: "Developers with a static site on Netlify who want to move it to Cloudflare Workers"
readerQuestions:
  - "Do I need to write any Worker code to host my static site on Cloudflare Workers?"
  - "My site uses Netlify Forms for a contact form. Can I move it to Workers following this guide?"
  - "My redirects are defined in netlify.toml, not in a _redirects file. What should I do?"
  - "After switching the domain, how do I check the migration worked? Give me exact commands and the expected results."
  - "I have a Next.js site with server-side rendering on Netlify. Does this guide apply to me?"
readerCheck:
  date: 2026-10-14
  full: 5
  total: 5
---

If your static site runs on Netlify and you want it on Cloudflare, you can serve it from a Worker with no Worker code at all. The build output goes up as static assets, and Cloudflare serves it.

The risky part is not the hosting. It is the URLs. Every link to your site from search results, old tweets and other blogs points at a path. If the new site changes that path and you do not redirect it, the link is dead and you will not get an error about it.

I moved my personal site this way in October 2026: an old Hugo site on Netlify, rebuilt with Astro, now on Workers. The steps below work for any static site generator, because Workers only sees the folder of built files.

## Table of contents

## Does this guide apply to you?

It applies when your site is **fully static**: the build produces a folder of HTML, CSS, JavaScript and images, and no page needs a server to render it.

These Netlify features do **not** move with the files. Check for each one before you switch the domain:

| On Netlify                                                                                                                     | On Workers static assets                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Netlify Forms                                                                                                                  | Does not exist. Submissions stop arriving after the switch, with no error. Replace the form backend first, or keep the form on another service.    |
| Netlify Functions, Edge Functions, Identity                                                                                    | Do not exist. They need Worker code, which is outside this guide.                                                                                  |
| Server-side rendering (for example Next.js with SSR)                                                                           | Not served by a static assets setup. Follow Cloudflare's framework guide for your framework instead.                                               |
| Redirects in `netlify.toml`                                                                                                    | Not read. Convert each rule to a line in `_redirects` (step 3).                                                                                    |
| Headers in `netlify.toml`                                                                                                      | Not read. Move them to a `_headers` file in the build folder.                                                                                      |
| `_redirects` rules with conditions (`Country=`, `Language=`, `Cookie=`), query parameter matching, or rewrites with status 404 | Not supported. Plain 301/302/303/307/308 redirects, splats (`*`), placeholders (`:name`) and 200 proxying to paths on the same site are supported. |

Also note: everything in the build folder becomes public. Check that it holds no files you do not want to publish.

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

If your redirects are in `netlify.toml`, convert each `[[redirects]]` block to one line. For example:

```toml
[[redirects]]
  from = "/post/*"
  to = "/posts/:splat"
  status = 301
```

becomes:

```text
/post/* /posts/:splat 301
```

Then delete the block from `netlify.toml` only after the test in step 4 covers it. Workers do not read `netlify.toml`, so any rule left there stops working after the switch.

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

What to expect:

| Request      | Expected on Workers                                                   | Means the switch is not done                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home page    | `HTTP/2 200` and no `x-nf-request-id` header                          | An `x-nf-request-id` header (or `server: Netlify`): the request still reaches Netlify. If the domain is proxied by Cloudflare, `server: cloudflare` alone proves nothing, because it also appears in front of Netlify |
| Old post URL | `HTTP/2 301` and `location: /posts/translate-file-permissions-linux/` | 404, or 200 from Netlify                                                                                                                                                                                              |
| `/.env`      | `HTTP/2 403`, only if you added the scanner rule in step 6            | Without that rule, 404 is also fine                                                                                                                                                                                   |

Run the same check for every line in your `_redirects` file, not only one.

## 8. Disconnect the Netlify site

Moving DNS is not the end. My Netlify site was still connected to the GitHub repository, so every pull request kept getting failing Netlify checks: a deploy preview, header rules, redirect rules. Nothing reached Netlify any more, but the red checks stayed on every PR. Disconnect the repository in the Netlify site settings once the domain has moved.
