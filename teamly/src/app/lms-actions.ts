'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { generateCourseFromSpace } from '@/lib/services/courses';
import { enroll, completeLesson, submitQuiz } from '@/lib/services/enrollment';

function requireSession() {
  const s = getSession();
  if (!s) redirect('/login');
  return s;
}

export async function createCourseFromSpaceAction(formData: FormData): Promise<void> {
  requireSession();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const spaceId = String(formData.get('spaceId') ?? '');
  const title = String(formData.get('title') ?? '').trim() || 'Новый курс';
  const course = await generateCourseFromSpace(workspaceId, spaceId, title);
  redirect(`/app/courses/${course.id}`);
}

export async function enrollAction(formData: FormData): Promise<void> {
  const session = requireSession();
  const courseId = String(formData.get('courseId') ?? '');
  await enroll(courseId, session.userId);
  revalidatePath(`/app/courses/${courseId}`);
}

export async function completeLessonAction(formData: FormData): Promise<void> {
  requireSession();
  const enrollmentId = String(formData.get('enrollmentId') ?? '');
  const lessonId = String(formData.get('lessonId') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  await completeLesson(enrollmentId, lessonId);
  redirect(`/app/courses/${courseId}`);
}

export async function submitQuizAction(formData: FormData): Promise<void> {
  requireSession();
  const courseId = String(formData.get('courseId') ?? '');
  const quizId = String(formData.get('quizId') ?? '');
  const enrollmentId = String(formData.get('enrollmentId') ?? '');

  // Inputs named "q:<questionId>" carry the selected option id.
  const submission: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('q:')) submission[key.slice(2)] = [String(value)];
  }
  const result = await submitQuiz(enrollmentId, quizId, submission);
  redirect(
    `/app/courses/${courseId}/quiz/${quizId}?score=${result.score}&passed=${result.passed ? 1 : 0}`,
  );
}
