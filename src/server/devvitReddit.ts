import { isT1, isT3 } from '@devvit/shared-types/tid.js';
import { context, reddit } from '@devvit/web/server';
import type { RedditPort } from './ports';

export function devvitReddit(): RedditPort {
  return {
    runtime: 'devvit',
    async submitPost({ title, date, fallback }) {
      const post = await reddit.submitCustomPost({
        title,
        entry: 'default',
        postData: { date },
        textFallback: { text: fallback },
        styles: {
          heightPixels: 512,
          backgroundColor: '#141A2EFF',
          backgroundColorDark: '#0E1324FF',
        },
      });
      return post.id;
    },
    async commentAsApp(postId, text) {
      if (!isT3(postId)) return null;
      try {
        const comment = await reddit.submitComment({ id: postId, text, runAs: 'APP' });
        return comment.id;
      } catch (error) {
        console.error('Owl Line could not post the spoiler note', error);
        return null;
      }
    },
    async stickyComment(commentId) {
      if (!isT1(commentId)) return;
      try {
        const comment = await reddit.getCommentById(commentId);
        await comment.distinguish(true);
      } catch (error) {
        console.error('Owl Line could not pin the spoiler note', error);
      }
    },
    async unstickyPost(postId) {
      if (!isT3(postId)) return;
      try {
        const post = await reddit.getPostById(postId);
        await post.unsticky();
      } catch (error) {
        console.error('Owl Line could not unstick yesterday', error);
      }
    },
    async commentAsUser(postId, text) {
      if (!isT3(postId)) return null;
      try {
        const comment = await reddit.submitComment({ id: postId, text, runAs: 'USER' });
        return comment.id;
      } catch (error) {
        console.error('Owl Line could not share the time', error);
        return null;
      }
    },
    async subscribe() {
      try {
        await reddit.subscribeToCurrentSubreddit();
      } catch (error) {
        console.error('Owl Line could not subscribe', error);
      }
    },
    async setFlair(username, text) {
      try {
        await reddit.setUserFlair({
          subredditName: context.subredditName,
          username,
          text,
          backgroundColor: '#1A2340',
          textColor: 'light',
        });
      } catch (error) {
        console.error('Owl Line left flair alone', error);
      }
    },
  };
}
