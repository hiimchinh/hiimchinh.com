import type { UIStrings } from "../types";

export default {
  nav: {
    home: "Trang chủ",
    posts: "Bài viết",
    tags: "Thẻ",
    about: "Giới thiệu",
    archives: "Lưu trữ",
    search: "Tìm kiếm",
    projects: "Dự án",
    switchLanguage: "English",
  },
  post: {
    publishedAt: "Đăng lúc",
    updatedAt: "Cập nhật",
    sharePostIntro: "Chia sẻ bài viết:",
    sharePostOn: "Chia sẻ bài viết lên {{platform}}",
    sharePostViaEmail: "Chia sẻ bài viết qua email",
    tagLabel: "Thẻ",
    backToTop: "Lên đầu trang",
    goBack: "Quay lại",
    editPage: "Sửa trang",
    previousPost: "Bài trước",
    nextPost: "Bài sau",
    onlyInEnglish: "Bài này hiện chỉ có bản tiếng Anh.",
    rawMarkdown: "Markdown",
    copyForLlm: "Copy cho LLM",
    copiedForLlm: "Đã copy",
    openIn: "Mở trong",
  },
  pagination: {
    prev: "Trước",
    next: "Sau",
    page: "Trang",
  },
  home: {
    socialLinks: "Liên kết",
    featured: "Nổi bật",
    recentPosts: "Bài mới",
    allPosts: "Tất cả bài viết",
    selectedProjects: "Dự án",
    allProjects: "Tất cả dự án",
  },
  footer: {
    copyright: "Bản quyền",
    allRightsReserved: "Đã đăng ký bản quyền.",
  },
  pages: {
    tagTitle: "Thẻ",
    tagDesc: "Các bài viết có thẻ",

    tagsTitle: "Thẻ",
    tagsDesc: "Tất cả thẻ dùng trong bài viết.",

    postsTitle: "Bài viết",
    postsDesc: "Tất cả bài mình đã viết.",

    archivesTitle: "Lưu trữ",
    archivesDesc: "Tất cả bài viết theo thời gian.",

    searchTitle: "Tìm kiếm",
    searchDesc: "Tìm bài viết ...",

    projectsTitle: "Dự án",
    projectsDesc: "Những thứ mình đã và đang làm.",
  },
  meta: {
    homeDesc:
      "Kỹ sư full-stack ở Hà Nội, làm việc tại Stringee và Cogover. Ghi chép về việc làm phần mềm.",
    postsDesc:
      "Tất cả bài viết của Chính về việc làm phần mềm, xếp từ mới đến cũ.",
    tagsDesc: "Các chủ đề Chính viết, xếp theo thẻ.",
    tagDesc: 'Bài viết của Chính có thẻ "{{tag}}".',
    archivesDesc: "Bài viết của Chính theo năm và tháng.",
    searchDesc: "Tìm bài viết trên trang của Chính.",
  },
  projectStatus: {
    active: "Đang làm",
    paused: "Tạm dừng",
    archived: "Đã đóng",
  },
  a11y: {
    skipToContent: "Bỏ qua tới nội dung",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
    toggleTheme: "Đổi giao diện sáng/tối",
    searchPlaceholder: "Tìm bài viết...",
    noResults: "Không có kết quả",
    goToPreviousPage: "Tới trang trước",
    goToNextPage: "Tới trang sau",
  },
  socials: {
    email: "Gửi email cho {{name}}",
    profile: "{{name}} trên {{network}}",
  },
  notFound: {
    title: "404 Không tìm thấy",
    message: "Không tìm thấy trang",
    goHome: "Về trang chủ",
  },
} satisfies UIStrings;
