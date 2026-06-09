import { gradeQuiz } from '@/lib/lms/grade';
import { courseProgress } from '@/lib/lms/progress';

describe('gradeQuiz', () => {
  const questions = [
    { id: 'q1', correctOptionIds: ['a'] },
    { id: 'q2', correctOptionIds: ['c'] },
  ];

  it('scores all-correct as 100 and passes', () => {
    const r = gradeQuiz(questions, { q1: ['a'], q2: ['c'] }, 70);
    expect(r).toMatchObject({ total: 2, correct: 2, score: 100, passed: true });
  });

  it('scores half-correct as 50 and fails a 70 threshold', () => {
    const r = gradeQuiz(questions, { q1: ['a'], q2: ['b'] }, 70);
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
    expect(r.perQuestion).toEqual({ q1: true, q2: false });
  });

  it('requires the exact set for multi-correct questions', () => {
    const multi = [{ id: 'q', correctOptionIds: ['a', 'b'] }];
    expect(gradeQuiz(multi, { q: ['a'] }, 50).passed).toBe(false);
    expect(gradeQuiz(multi, { q: ['a', 'b'] }, 50).passed).toBe(true);
    expect(gradeQuiz(multi, { q: ['a', 'b', 'c'] }, 50).passed).toBe(false);
  });

  it('handles an empty quiz', () => {
    expect(gradeQuiz([], {}, 70)).toMatchObject({ total: 0, score: 0, passed: false });
  });
});

describe('courseProgress', () => {
  const structure = {
    modules: [
      { lessonIds: ['l1', 'l2'], quizId: 'qz1' },
      { lessonIds: ['l3'], quizId: null },
    ],
  };

  it('computes partial progress', () => {
    const p = courseProgress(structure, { completedLessonIds: ['l1'], passedQuizIds: [] });
    expect(p).toMatchObject({ totalUnits: 4, doneUnits: 1, percent: 25, completed: false });
  });

  it('is complete only when all lessons done and quizzes passed', () => {
    const p = courseProgress(structure, {
      completedLessonIds: ['l1', 'l2', 'l3'],
      passedQuizIds: ['qz1'],
    });
    expect(p).toMatchObject({ totalUnits: 4, doneUnits: 4, percent: 100, completed: true });
  });

  it('is not complete if a quiz is unpassed', () => {
    const p = courseProgress(structure, {
      completedLessonIds: ['l1', 'l2', 'l3'],
      passedQuizIds: [],
    });
    expect(p.completed).toBe(false);
  });
});
