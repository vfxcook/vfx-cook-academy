import { PrismaClient } from "../src/generated/prisma";
import { hashPassword } from "../src/lib/password";

import { coursePriceInr } from "../src/lib/course-offer";

const prisma = new PrismaClient();
const keralaStudentNames = [
  "Aarav Nair",
  "Adithya Menon",
  "Akhil Raj",
  "Amal Krishna",
  "Anand Mohan",
  "Arjun Suresh",
  "Ashwin Prasad",
  "Avinash Babu",
  "Basil Mathew",
  "Devanand Pillai",
  "Edwin Thomas",
  "Gokul Rajan",
  "Harikrishnan Nair",
  "Joel Varghese",
  "Kiran Jose",
  "Manu Mohan",
  "Nikhil Ramesh",
  "Rahul Narayanan",
  "Rohit Balan",
  "Sanjay Krishnan",
  "Sidharth Menon",
  "Vishnu Prasad",
  "Abhinav Shaji",
  "Alwin Francis",
  "Nivin Joseph",
  "Jithin Das",
  "Rohan Mathew",
  "Sreehari Nair",
  "Muhammed Ameen",
  "Fasil Rahman",
  "Ijas Ahmed",
  "Shamil Ali",
  "Archa Nair",
  "Anagha Suresh",
  "Anjana Raj",
  "Aparna Menon",
  "Ardra Mohan",
  "Arya Krishna",
  "Aswathy Pillai",
  "Devika Prasad",
  "Diya Mathew",
  "Fathima Noor",
  "Gayathri Nair",
  "Gopika Ramesh",
  "Hannah Thomas",
  "Keerthana Babu",
  "Lakshmi Narayanan",
  "Meera Suresh",
  "Neha Joseph",
  "Nandana Rajan",
  "Parvathy Menon",
  "Riya Varghese",
  "Sandra Thomas",
  "Sneha Raj",
  "Swathy Mohan",
  "Tanvi Nair",
  "Vaishnavi Prasad",
  "Anitta Jose",
  "Diya Mary",
  "Aleena Francis",
  "Shahana Rahman",
  "Aisha Fathima",
  "Nila Krishna",
  "Malavika Suresh",
  "Kavya Nair",
  "Teresa Mathew",
  "Ziya Ahmed",
];

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: "ai-vfx-video-creation" },
    update: {
      title: "Master Cinematic AI Video Creation in Malayalam",
      description:
        "Learn professional AI-powered filmmaking in Malayalam, from prompts to polished cinematic output.",
      priceInr: coursePriceInr,
      isPublished: true,
    },
    create: {
      slug: "ai-vfx-video-creation",
      title: "Master Cinematic AI Video Creation in Malayalam",
      description:
        "Learn professional AI-powered filmmaking in Malayalam, from prompts to polished cinematic output.",
      priceInr: coursePriceInr,
      isPublished: true,
      thumbnailUrl:
        "https://images.unsplash.com/photo-1574717024453-3540567f7a10?auto=format&fit=crop&w=1200&q=80",
      videos: {
        create: [
          {
            title: "Welcome and Course Roadmap",
            description: "Course setup and outcomes.",
            videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            order: 1,
            durationSec: 360,
          },
          {
            title: "Prompting for Cinematic Shots",
            description: "Build scene prompts that convert better.",
            videoUrl: "https://www.youtube.com/embed/ysz5S6PUM-U",
            order: 2,
            durationSec: 540,
          },
        ],
      },
    },
  });

  console.log(`Seeded course: ${course.title}`);

  const adminEmail = (process.env.ADMIN_EMAIL ?? "itsvfxcook@gmail.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Teamdfg4679$";
  const adminHash = await hashPassword(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "ADMIN",
      passwordHash: adminHash,
      name: "VFX Cook Admin",
      phone: "9999999999",
    },
    create: {
      email: adminEmail,
      role: "ADMIN",
      passwordHash: adminHash,
      name: "VFX Cook Admin",
      phone: "9999999999",
    },
  });
  console.log(`Seeded admin: ${adminEmail}`);

  for (const [index, fullName] of keralaStudentNames.entries()) {
    const emailLocal = fullName.toLowerCase().replace(/[^a-z]+/g, ".").replace(/(^\.|\.$)/g, "");
    const email = `${emailLocal}.${index + 1}@learn.vfxcookacademy.com`;
    const student = await prisma.user.upsert({
      where: { email },
      update: {
        name: fullName,
        role: "STUDENT",
      },
      create: {
        email,
        name: fullName,
        role: "STUDENT",
      },
    });

    await prisma.enrollment.upsert({
      where: {
        userId_courseId: {
          userId: student.id,
          courseId: course.id,
        },
      },
      update: {
        isActive: true,
        activatedAt: new Date(),
      },
      create: {
        userId: student.id,
        courseId: course.id,
        isActive: true,
        activatedAt: new Date(),
      },
    });
  }
  console.log(`Seeded ${keralaStudentNames.length} Kerala students and activated enrollments`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
