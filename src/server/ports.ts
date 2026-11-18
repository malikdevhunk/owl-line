export type Actor = {
  userId: string | null;
  username: string | null;
};

export type RedditPort = {
  runtime: 'devvit' | 'local';
  submitPost(input: { title: string; date: string; fallback: string }): Promise<string>;
  commentAsApp(postId: string, text: string): Promise<string | null>;
  stickyComment(commentId: string): Promise<void>;
  unstickyPost(postId: string): Promise<void>;
  commentAsUser(postId: string, text: string): Promise<string | null>;
  subscribe(): Promise<void>;
  setFlair(username: string, text: string): Promise<void>;
};

export const EVENTS = [
  'splash',
  'play_start',
  'first_move',
  'solve',
  'abandon',
  'share',
  'workshop_open',
  'workshop_publish',
] as const;

export type JourneyEvent = (typeof EVENTS)[number];
