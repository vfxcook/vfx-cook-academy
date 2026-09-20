import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureStudioDefaults } from '../apps/server/src/lib/studio.js';

const prisma = new PrismaClient();

const COURSE_PRICE_INR = 499;

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

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'itsvfxcook@gmail.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('Set ADMIN_PASSWORD in your environment before seeding.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN', passwordHash, name: 'VFX Cook Admin' },
    create: { email: adminEmail, role: 'ADMIN', passwordHash, name: 'VFX Cook Admin' }
  });
  console.log(`Seeded admin: ${adminEmail}`);

  for (const [index, fullName] of keralaStudentNames.entries()) {
    const local = fullName
      .toLowerCase()
      .replace(/[^a-z]+/g, '.')
      .replace(/(^\.|\.$)/g, '');
    const email = `${local}.${index + 1}@learn.vfxcookacademy.com`;

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

  await ensureStudioDefaults(prisma);
  console.log('Seeded AI Studio credit packs and model pricing');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
