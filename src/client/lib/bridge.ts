import type { MouseEvent } from 'react';
import { requestExpandedMode, showLoginPrompt, showToast } from '@devvit/web/client';

export function onReddit(): boolean {
  return typeof window.devvit !== 'undefined';
}

export function readPostDate(): string | null {
  const value = window.devvit?.context?.postData;
  if (!value || typeof value !== 'object' || !('date' in value)) return null;
  return typeof value.date === 'string' ? value.date : null;
}

export function openGame(event: MouseEvent<HTMLButtonElement>): void {
  if (onReddit()) {
    requestExpandedMode(event.nativeEvent, 'game');
    return;
  }
  window.location.assign('/game.html');
}

export function askToLogIn(): void {
  if (onReddit()) showLoginPrompt();
}

export function toast(message: string): void {
  if (onReddit()) showToast(message);
}
