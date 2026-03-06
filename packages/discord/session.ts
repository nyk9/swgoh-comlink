/**
 * Discord スレッド会話セッション管理
 *
 * スレッドID をキーに、会話の文脈（システムプロンプト入力 + 会話履歴）を
 * インメモリで保持する。サーバー再起動でリセットされる軽量な実装。
 *
 * セッションの有効期限: SESSION_TTL_MS（デフォルト 1時間）
 * 有効期限切れのセッションは cleanupExpiredSessions() で明示的に削除できる。
 */

import type { ChatSystemPromptInput } from "../core/advisor/prompt.ts";
import type { ChatMessage } from "../core/advisor/client.ts";

// -------------------------------------------------------
// 定数
// -------------------------------------------------------

/** セッション有効期限（ミリ秒）: 1時間 */
const SESSION_TTL_MS = 60 * 60 * 1000;

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

/**
 * 1つのスレッドに紐付く会話セッション
 */
export interface ChatSession {
  /** システムプロンプト生成に必要なデータ（セッション開始時に固定） */
  systemPromptInput: ChatSystemPromptInput;
  /** これまでの会話履歴（user / assistant の交互のメッセージ） */
  history: ChatMessage[];
  /** セッション作成時刻（Unix ミリ秒） */
  createdAt: number;
  /** 最終アクティブ時刻（Unix ミリ秒） */
  lastActiveAt: number;
}

// -------------------------------------------------------
// ストア
// -------------------------------------------------------

/** スレッドID → セッション のインメモリマップ */
const sessions = new Map<string, ChatSession>();

// -------------------------------------------------------
// パブリック API
// -------------------------------------------------------

/**
 * 新しいセッションを作成してストアに登録する
 *
 * @param threadId      - Discord スレッドの ID
 * @param input         - システムプロンプト生成に必要なデータ
 * @param initialHistory - 初回アドバイス時の user/assistant メッセージ
 */
export function createSession(
  threadId: string,
  input: ChatSystemPromptInput,
  initialHistory: ChatMessage[],
): void {
  const now = Date.now();
  sessions.set(threadId, {
    systemPromptInput: input,
    history: [...initialHistory],
    createdAt: now,
    lastActiveAt: now,
  });
}

/**
 * スレッドIDに対応するセッションを取得する
 *
 * 有効期限切れの場合は削除して undefined を返す。
 *
 * @param threadId - Discord スレッドの ID
 * @returns セッション、または undefined（存在しない / 期限切れ）
 */
export function getSession(threadId: string): ChatSession | undefined {
  const session = sessions.get(threadId);
  if (session === undefined) return undefined;

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(threadId);
    return undefined;
  }

  return session;
}

/**
 * セッションの会話履歴にメッセージを追記し、lastActiveAt を更新する
 *
 * セッションが存在しない場合は何もしない。
 *
 * @param threadId - Discord スレッドの ID
 * @param message  - 追記する会話メッセージ（user または assistant）
 */
export function appendToHistory(
  threadId: string,
  message: ChatMessage,
): void {
  const session = sessions.get(threadId);
  if (session === undefined) return;
  session.history.push(message);
  session.lastActiveAt = Date.now();
}

/**
 * 有効期限切れのセッションを全て削除する
 *
 * messageCreate イベントのたびに呼び出すことでメモリリークを防ぐ。
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

/**
 * 現在アクティブなセッション数を返す（デバッグ用）
 */
export function getSessionCount(): number {
  return sessions.size;
}
