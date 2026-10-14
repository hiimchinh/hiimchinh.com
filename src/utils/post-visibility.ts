export type PostVisibilityOptions = {
  now: number;
  /** A post due within this many milliseconds is already shown. */
  scheduledMargin: number;
  /** `astro dev`: scheduled posts are shown to make authoring easier. */
  dev: boolean;
  /** Pull-request preview build: drafts and scheduled posts are shown for review. */
  preview: boolean;
};

/** Whether a post is listed and rendered in a build with these options. */
export function isPostVisible(
  post: { draft?: boolean; pubDatetime: Date | string },
  { now, scheduledMargin, dev, preview }: PostVisibilityOptions
): boolean {
  if (preview) return true;
  if (post.draft) return false;
  return dev || now > new Date(post.pubDatetime).getTime() - scheduledMargin;
}
