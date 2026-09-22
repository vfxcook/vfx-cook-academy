import { prisma } from './prisma.js';

export type AcademyAccess = {
  /** Paid students (any active enrolment) and admins. Everyone else is a visitor. */
  member: boolean;
  /** Where to send this person after they sign in. */
  landing: string;
};

/**
 * Paid students go straight into the classroom of the course they activated most
 * recently; admins go to the workspace; everyone else gets the dashboard with the offer.
 */
export async function academyAccess(user: { id: string; role: string }): Promise<AcademyAccess> {
  if (user.role === 'ADMIN') return { member: true, landing: '/admin' };

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: [{ activatedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    select: { course: { select: { slug: true } } }
  });

  return enrollment
    ? { member: true, landing: `/learn/${enrollment.course.slug}` }
    : { member: false, landing: '/dashboard' };
}
