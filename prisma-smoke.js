const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.course.findMany();
  console.log(rows.length);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
