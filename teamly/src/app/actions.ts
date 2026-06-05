'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { login } from '@/lib/services/org';
import { createPage, savePageContent } from '@/lib/services/pages';
import { addComment } from '@/lib/services/comments';
import { createSpace } from '@/lib/services/spaces';
import { getSession, createSession, destroySession } from '@/lib/session';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const user = await login(email, password);
  if (!user) redirect('/login?error=1');
  createSession(user.id, user.orgId);
  redirect('/app');
}

export async function logoutAction(): Promise<void> {
  destroySession();
  redirect('/login');
}

export async function createSpaceAction(formData: FormData): Promise<void> {
  requireSession();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const space = await createSpace(workspaceId, name);
  redirect(`/app/spaces/${space.id}`);
}

export async function createPageAction(formData: FormData): Promise<void> {
  requireSession();
  const spaceId = String(formData.get('spaceId') ?? '');
  const parentId = (formData.get('parentId') as string) || null;
  const title = String(formData.get('title') ?? '').trim() || 'Без названия';
  const page = await createPage({ spaceId, parentId, title });
  redirect(`/app/pages/${page.id}`);
}

// Called from the client editor (autosave). Returns the new version number.
export async function savePageAction(
  pageId: string,
  title: string,
  contentJson: unknown,
): Promise<number> {
  const session = requireSession();
  const version = await savePageContent({ pageId, title, contentJson, authorId: session.userId });
  revalidatePath(`/app/pages/${pageId}`);
  return version;
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const session = requireSession();
  const pageId = String(formData.get('pageId') ?? '');
  const body = String(formData.get('body') ?? '');
  if (body.trim()) {
    await addComment({ pageId, authorId: session.userId, body });
    revalidatePath(`/app/pages/${pageId}`);
  }
}

function requireSession() {
  const session = getSession();
  if (!session) redirect('/login');
  return session;
}
