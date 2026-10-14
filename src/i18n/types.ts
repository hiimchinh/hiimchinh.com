export interface UIStrings {
  nav: {
    home: string;
    posts: string;
    tags: string;
    about: string;
    projects: string;
    switchLanguage: string;
    archives: string;
    search: string;
  };
  post: {
    publishedAt: string;
    updatedAt: string;
    sharePostIntro: string;
    sharePostOn: string;
    sharePostViaEmail: string;
    tagLabel: string;
    backToTop: string;
    goBack: string;
    editPage: string;
    previousPost: string;
    nextPost: string;
    onlyInEnglish: string;
    rawMarkdown: string;
    copyForLlm: string;
    /** Heading of the contents list beside a long post. */
    contents: string;
    copiedForLlm: string;
    openIn: string;
  };
  pagination: {
    prev: string;
    next: string;
    page: string;
  };
  home: {
    socialLinks: string;
    featured: string;
    recentPosts: string;
    allPosts: string;
    selectedProjects: string;
    allProjects: string;
  };
  footer: {
    copyright: string;
    allRightsReserved: string;
  };
  pages: {
    tagTitle: string;
    tagDesc: string;

    tagsTitle: string;
    tagsDesc: string;

    postsTitle: string;
    postsDesc: string;

    archivesTitle: string;
    archivesDesc: string;

    searchTitle: string;
    searchDesc: string;

    projectsTitle: string;
    projectsDesc: string;
  };
  /** Meta descriptions for listing pages; each must be unique on the site. */
  meta: {
    homeDesc: string;
    postsDesc: string;
    tagsDesc: string;
    /** Uses the {{tag}} placeholder. */
    tagDesc: string;
    archivesDesc: string;
    searchDesc: string;
  };
  projectStatus: {
    active: string;
    paused: string;
    archived: string;
  };
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    toggleTheme: string;
    searchPlaceholder: string;
    noResults: string;
    goToPreviousPage: string;
    goToNextPage: string;
  };
  /** Labels for social links; use the {{name}} and {{network}} placeholders. */
  socials: {
    email: string;
    profile: string;
  };
  notFound: {
    title: string;
    message: string;
    goHome: string;
  };
}
