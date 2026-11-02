import { PrismaClient } from '@prisma/client';
import { ensureStudioDefaults } from '../apps/server/src/lib/studio.js';

const prisma = new PrismaClient();

const COURSE_PRICE_INR = 499;

/** Demo accounts live on a reserved domain, so nothing can ever be emailed to them. */
const DEMO_DOMAIN = 'students.academy.example';
/** Domain the v1 seed used for the same accounts; renamed below, never created. */
const LEGACY_DEMO_DOMAIN = 'learn.vfxcookacademy.com';

const keralaStudentNames = [
  'Aarav Nair', 'Adithya Menon', 'Akhil Raj', 'Amal Krishna', 'Anand Mohan',
  'Arjun Suresh', 'Ashwin Prasad', 'Avinash Babu', 'Basil Mathew', 'Devanand Pillai',
  'Edwin Thomas', 'Gokul Rajan', 'Harikrishnan Nair', 'Joel Varghese', 'Kiran Jose',
  'Manu Mohan', 'Nikhil Ramesh', 'Rahul Narayanan', 'Rohit Balan', 'Sanjay Krishnan',
  'Sidharth Menon', 'Vishnu Prasad', 'Abhinav Shaji', 'Alwin Francis', 'Nivin Joseph',
  'Jithin Das', 'Rohan Mathew', 'Sreehari Nair', 'Muhammed Ameen', 'Fasil Rahman',
  'Ijas Ahmed', 'Shamil Ali', 'Archa Nair', 'Anagha Suresh', 'Anjana Raj',
  'Aparna Menon', 'Ardra Mohan', 'Arya Krishna', 'Aswathy Pillai', 'Devika Prasad',
  'Diya Mathew', 'Fathima Noor', 'Gayathri Nair', 'Gopika Ramesh', 'Hannah Thomas',
  'Keerthana Babu', 'Lakshmi Narayanan', 'Meera Suresh', 'Neha Joseph', 'Nandana Rajan',
  'Parvathy Menon', 'Riya Varghese', 'Sandra Thomas', 'Sneha Raj', 'Swathy Mohan',
  'Tanvi Nair', 'Vaishnavi Prasad', 'Anitta Jose', 'Diya Mary', 'Aleena Francis',
  'Shahana Rahman', 'Aisha Fathima', 'Nila Krishna', 'Malavika Suresh', 'Kavya Nair',
  'Teresa Mathew', 'Ziya Ahmed'
];

const LESSONS = [
  {
    title: 'Welcome and the six stages',
    description:
      'How the Academy maps onto the pipeline you will use in the studio, and what you will have built by the end.',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    order: 1,
    durationSec: 360
  },
  {
    title: 'Writing a frame, not a prompt',
    description:
      'Composition, lens choice, lighting and blocking written as language a model can actually hold.',
    videoUrl: 'https://www.youtube.com/embed/ysz5S6PUM-U',
    order: 2,
    durationSec: 540
  },
  {
    title: 'Locking the cast and the places',
    description: 'Reference stills that keep a character and a location consistent across a scene.',
    videoUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
    order: 3,
    durationSec: 620
  }
];

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: 'ai-vfx-video-creation' },
    update: {
      title: 'Master Cinematic AI Video Creation in Malayalam',
      description:
        'Learn professional AI-powered filmmaking in Malayalam, from writing the frame to a polished cinematic finish.',
      priceInr: COURSE_PRICE_INR,
      isPublished: true,
      freePreviewFirstLesson: true
    },
    create: {
      slug: 'ai-vfx-video-creation',
      title: 'Master Cinematic AI Video Creation in Malayalam',
      description:
        'Learn professional AI-powered filmmaking in Malayalam, from writing the frame to a polished cinematic finish.',
      priceInr: COURSE_PRICE_INR,
      isPublished: true,
      freePreviewFirstLesson: true,
      thumbnailUrl: '/bg/3.jpeg',
      videos: { create: LESSONS }
    }
  });
  console.log(`Seeded course: ${course.title}`);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    throw new Error('Set ADMIN_EMAIL in your environment before seeding.');
  }

  // No password: this account signs in with Google like everyone else, and the API
  // promotes whoever matches ADMIN_EMAIL to ADMIN as they arrive.
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', name: 'Academy Admin' },
    create: { email: adminEmail, role: 'ADMIN', name: 'Academy Admin' }
  });
  console.log(`Seeded admin: ${adminEmail}`);

  // Demo students are opt-in. A production database should hold real people only:
  // an active enrolment nobody paid for is the exact thing the access rules exist to stop.
  if (process.argv.includes('--demo-students')) {
    // Re-seeding a v1 database renames its demo accounts instead of adding a second set.
    // An address already taken on the new domain is left alone rather than colliding.
    const renamed = await prisma.$executeRaw`
      UPDATE "User" AS legacy
      SET email = replace(legacy.email, ${'@' + LEGACY_DEMO_DOMAIN}, ${'@' + DEMO_DOMAIN})
      WHERE legacy.email LIKE ${'%@' + LEGACY_DEMO_DOMAIN}
        AND NOT EXISTS (
          SELECT 1 FROM "User" AS taken
          WHERE taken.email = replace(legacy.email, ${'@' + LEGACY_DEMO_DOMAIN}, ${'@' + DEMO_DOMAIN})
        )
    `;
    if (renamed > 0) console.log(`Moved ${renamed} demo accounts to @${DEMO_DOMAIN}`);

    for (const [index, fullName] of keralaStudentNames.entries()) {
      const local = fullName
        .toLowerCase()
        .replace(/[^a-z]+/g, '.')
        .replace(/(^\.|\.$)/g, '');
      const email = `${local}.${index + 1}@${DEMO_DOMAIN}`;

      const student = await prisma.user.upsert({
        where: { email },
        update: { name: fullName, role: 'STUDENT' },
        create: { email, name: fullName, role: 'STUDENT' }
      });

      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: student.id, courseId: course.id } },
        update: { isActive: true, activatedAt: new Date() },
        create: {
          userId: student.id,
          courseId: course.id,
          isActive: true,
          activatedAt: new Date()
        }
      });
    }
    console.log(`Seeded ${keralaStudentNames.length} students with active enrolments`);
  } else {
    console.log('Skipped demo students — pass --demo-students to add them');
  }

  await ensureStudioDefaults(prisma);
  console.log('Seeded AI Studio credit packs and model pricing');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
