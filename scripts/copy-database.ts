/**
 * One-off move of the Academy's data from the old Supabase Postgres to Render Postgres.
 *
 *   SOURCE_DATABASE_URL=postgres://…supabase…  TARGET_DATABASE_URL=postgres://…render…  npm run db:copy
 *
 * The target must already have the schema (`npm run db:push` against it, or one Render
 * deploy) and must be empty — the copy refuses to merge into live data. Rows keep their ids,
 * so enrolments, payments and progress stay attached to the same people. Sign-in sessions
 * and one-time tokens are not copied: everyone simply signs in again.
 */
import { PrismaClient } from '@prisma/client';

type Row = Record<string, unknown>;

/** The slice of a Prisma model delegate this copy needs. */
type Delegate = {
  count(): Promise<number>;
  findMany(args: { take: number; orderBy: Row; cursor?: Row; skip?: number }): Promise<Row[]>;
  createMany(args: { data: Row[]; skipDuplicates: boolean }): Promise<{ count: number }>;
};

// Parents before children, so every foreign key already exists when its row arrives.
const TABLES: Array<{ model: string; key: string; selfParent?: string }> = [
  { model: 'user', key: 'id' },
  { model: 'account', key: 'id' },
  { model: 'course', key: 'id' },
  { model: 'video', key: 'id' },
  { model: 'enrollment', key: 'id' },
  { model: 'timestampComment', key: 'id', selfParent: 'parentId' },
  { model: 'timestampCommentLike', key: 'id' },
  { model: 'paymentRequest', key: 'id' },
  { model: 'videoProgress', key: 'id' },
  { model: 'courseResource', key: 'id' },
  { model: 'trendingPrompt', key: 'id' },
  { model: 'studioCreditPack', key: 'id' },
  { model: 'studioModelPricing', key: 'id' },
  { model: 'studioCreditBalance', key: 'id' },
  { model: 'studioCreditPurchase', key: 'id' },
  { model: 'studioCreditLedger', key: 'id' },
  { model: 'studioWorkflow', key: 'id' },
  { model: 'studioGeneration', key: 'id' },
  { model: 'communityPost', key: 'id' },
  { model: 'communityPostComment', key: 'id', selfParent: 'parentId' },
  { model: 'communityPostReaction', key: 'id' },
  { model: 'notification', key: 'id' },
  { model: 'appSetting', key: 'key' },
  { model: 'giftCoupon', key: 'id' }
];

const BATCH = 500;

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error('Set SOURCE_DATABASE_URL (old Supabase) and TARGET_DATABASE_URL (Render).');
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error('Source and target are the same database.');
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

const delegate = (client: PrismaClient, model: string) =>
  (client as unknown as Record<string, Delegate>)[model];

async function readAll(model: string, key: string) {
  const rows: Row[] = [];
  let cursor: Row | undefined;
  for (;;) {
    const page = await delegate(source, model).findMany({
      take: BATCH,
      orderBy: { [key]: 'asc' },
      ...(cursor ? { cursor, skip: 1 } : {})
    });
    rows.push(...page);
    if (page.length < BATCH) return rows;
    cursor = { [key]: page[page.length - 1][key] };
  }
}

async function write(model: string, rows: Row[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await delegate(target, model).createMany({ data: rows.slice(i, i + BATCH), skipDuplicates: true });
  }
}

/** Threads reference their own table, so replies wait until their parent has landed. */
async function writeThreaded(model: string, rows: Row[], parentField: string) {
  const placed = new Set<unknown>();
  let pending = rows;
  while (pending.length > 0) {
    const ready = pending.filter(row => row[parentField] == null || placed.has(row[parentField]));
    if (ready.length === 0) throw new Error(`${model}: ${pending.length} rows point at parents that do not exist.`);
    await write(model, ready);
    for (const row of ready) placed.add(row.id);
    pending = pending.filter(row => !ready.includes(row));
  }
}

async function main() {
  const existing = await delegate(target, 'user').count();
  if (existing > 0 && !process.argv.includes('--force')) {
    throw new Error(`The target already has ${existing} users. Copy into an empty database, or pass --force to top up.`);
  }

  console.log('table                     source   target');
  for (const { model, key, selfParent } of TABLES) {
    const rows = await readAll(model, key);
    if (selfParent) await writeThreaded(model, rows, selfParent);
    else await write(model, rows);

    const copied = await delegate(target, model).count();
    const flag = copied >= rows.length ? '' : '   <- short';
    console.log(`${model.padEnd(24)} ${String(rows.length).padStart(7)} ${String(copied).padStart(8)}${flag}`);
  }

  const paid = await target.enrollment.count({ where: { isActive: true } });
  console.log(`\nDone. ${paid} active enrolments now live on the target.`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => Promise.all([source.$disconnect(), target.$disconnect()]));
