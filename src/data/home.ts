import type { Locale } from "@/utils/locale-posts";

/** Home page hero copy. Keep it short: who I am, what I do, what I write about. */
export const hero: Record<Locale, { greeting: string; paragraphs: string[] }> =
  {
    en: {
      greeting: "Hi, I'm Chinh.",
      paragraphs: [
        "I build software in Hanoi. Seven years of contact center, CRM and ERP work, and since 2026 a small studio of my own, HC Labs.",
        "I'm learning to build a business in public. Here I write about the real work: decisions, mistakes, and what customers and other builders teach me.",
      ],
    },
    vi: {
      greeting: "Chào bạn, mình là Chính.",
      paragraphs: [
        "Mình làm phần mềm ở Hà Nội. Bảy năm làm tổng đài, CRM và ERP, và từ 2026 có một studio nhỏ của riêng mình, HC Labs.",
        "Mình đang học cách xây doanh nghiệp một cách công khai. Ở đây mình viết về việc thật: quyết định, sai lầm, và điều học được từ khách hàng và những người cùng làm.",
      ],
    },
  };
