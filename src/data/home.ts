import type { Locale } from "@/utils/locale-posts";

/** Home page hero copy. Keep it short: who I am, what I do, what I write about. */
export const hero: Record<Locale, { greeting: string; paragraphs: string[] }> =
  {
    en: {
      greeting: "Hi, I'm Chinh.",
      paragraphs: [
        "I'm a full-stack engineer in Hanoi. I have worked at Stringee since 2019, on communication APIs and the StringeeX contact center, and on Cogover since 2024.",
        "Here I write about the real work of building software: decisions, mistakes, and what customers and other engineers teach me.",
      ],
    },
    vi: {
      greeting: "Chào bạn, mình là Chính.",
      paragraphs: [
        "Mình là kỹ sư full-stack ở Hà Nội. Mình làm tại Stringee từ 2019, với communication API và tổng đài StringeeX, và làm thêm ở Cogover từ 2024.",
        "Ở đây mình viết về công việc thật khi làm phần mềm: quyết định, sai lầm, và điều học được từ khách hàng và các kỹ sư khác.",
      ],
    },
  };
