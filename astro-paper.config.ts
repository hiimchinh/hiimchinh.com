import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://hiimchinh.com/",
    title: "Chinh Hoang",
    description:
      "Full-stack engineer in Hanoi, working on Stringee and Cogover. Notes on building software.",
    author: "Chinh Hoang",
    profile: "https://hiimchinh.com/about/",
    lang: "en",
    timezone: "Asia/Ho_Chi_Minh",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 5,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    // The repository is private, so an edit link would 404 for readers.
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "x", url: "https://x.com/hiimchinh" },
    { name: "github", url: "https://github.com/hiimchinh" },
    { name: "linkedin", url: "https://www.linkedin.com/in/hiimchinh/" },
    { name: "mail", url: "mailto:chinh@hiimchinh.com" },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
