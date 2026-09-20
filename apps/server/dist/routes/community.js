import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { badRequest, forbidden, notFound, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { toAuthor } from '../lib/serialize.js';
import { COMMUNITY_IMAGE_BYTES, assertImage, saveUpload } from '../lib/storage.js';
export const communityRouter = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: COMMUNITY_IMAGE_BYTES }
});
communityRouter.use(requireUser);
async function assertCourseAccess(userId, role, courseId) {
    if (role === 'ADMIN')
        return;
    const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { isActive: true }
    });
    if (!enrollment?.isActive)
        throw forbidden('Activate this course to see the community wall.');
}
const postInclude = {
    user: { select: { id: true, name: true, email: true, image: true } },
    reactions: { select: { type: true, userId: true } },
    comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true, image: true } } }
    }
};
const REACTIONS = ['LIKE', 'FIRE', 'CLAP'];
function shapePost(post, viewerId) {
    const counts = Object.fromEntries(REACTIONS.map(type => [type, post.reactions.filter(r => r.type === type).length]));
    const mine = new Set(post.reactions.filter(r => r.userId === viewerId).map(r => r.type));
    return {
        id: post.id,
        title: post.title,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        createdAt: post.createdAt,
        author: toAuthor(post.user),
        isMine: post.userId === viewerId,
        reactions: REACTIONS.map(type => ({ type, count: counts[type], mine: mine.has(type) })),
        comments: post.comments.map(comment => ({
            id: comment.id,
            content: comment.content,
            parentId: comment.parentId,
            createdAt: comment.createdAt,
            author: toAuthor(comment.user),
            isMine: comment.userId === viewerId
        }))
    };
}
communityRouter.get('/posts', route(async (req, res) => {
    const courseId = String(req.query.courseId ?? '').trim();
    if (!courseId)
        throw badRequest('Pick a course first.');
    await assertCourseAccess(req.user.id, req.user.role, courseId);
    const posts = await prisma.communityPost.findMany({
        where: { courseId },
        orderBy: { createdAt: 'desc' },
        include: postInclude
    });
    res.json({ posts: posts.map(post => shapePost(post, req.user.id)) });
}));
const createPostSchema = z.object({
    courseId: z.string().min(1),
    title: z.string().trim().min(2, 'Give your work a title.').max(140),
    caption: z.string().trim().min(2, 'Add a short caption.').max(1500),
    mediaUrl: z.string().url().optional().or(z.literal(''))
});
communityRouter.post('/posts', upload.single('mediaFile'), route(async (req, res) => {
    const data = parse(createPostSchema, {
        courseId: String(req.body.courseId ?? '').trim(),
        title: String(req.body.title ?? '').trim(),
        caption: String(req.body.caption ?? '').trim(),
        mediaUrl: String(req.body.mediaUrl ?? '').trim()
    });
    await assertCourseAccess(req.user.id, req.user.role, data.courseId);
    let mediaUrl = data.mediaUrl || null;
    if (req.file) {
        assertImage(req.file, COMMUNITY_IMAGE_BYTES, 'Student work');
        mediaUrl = await saveUpload(req.file, 'community');
    }
    const post = await prisma.communityPost.create({
        data: {
            courseId: data.courseId,
            userId: req.user.id,
            title: data.title,
            caption: data.caption,
            mediaUrl
        },
        include: postInclude
    });
    const classmates = await prisma.enrollment.findMany({
        where: { courseId: data.courseId, isActive: true, userId: { not: req.user.id } },
        select: { userId: true }
    });
    if (classmates.length > 0) {
        await prisma.notification.createMany({
            data: classmates.map(row => ({
                userId: row.userId,
                actorUserId: req.user.id,
                type: 'NEW_POST_IN_ENROLLED_COURSE',
                title: 'New student work in the community',
                message: data.title.slice(0, 180),
                courseId: data.courseId,
                postId: post.id
            }))
        });
    }
    res.status(201).json({ post: shapePost(post, req.user.id) });
}));
communityRouter.delete('/posts/:id', route(async (req, res) => {
    const post = await prisma.communityPost.findUnique({
        where: { id: req.params.id },
        select: { id: true, userId: true }
    });
    if (!post)
        throw notFound('That post is no longer there.');
    if (post.userId !== req.user.id && req.user.role !== 'ADMIN') {
        throw forbidden('You can only delete your own post.');
    }
    await prisma.communityPost.delete({ where: { id: post.id } });
    res.json({ ok: true });
}));
communityRouter.post('/comments', route(async (req, res) => {
    const data = parse(z.object({
        postId: z.string().min(1),
        parentId: z.string().min(1).optional(),
        content: z.string().trim().min(2, 'Write a little more.').max(800)
    }), req.body);
    const post = await prisma.communityPost.findUnique({
        where: { id: data.postId },
        select: { id: true, userId: true, courseId: true }
    });
    if (!post)
        throw notFound('That post is no longer there.');
    await assertCourseAccess(req.user.id, req.user.role, post.courseId);
    const parent = data.parentId
        ? await prisma.communityPostComment.findUnique({
            where: { id: data.parentId },
            select: { id: true, postId: true, userId: true }
        })
        : null;
    if (data.parentId && (!parent || parent.postId !== post.id)) {
        throw badRequest('That reply target is no longer there.');
    }
    const comment = await prisma.communityPostComment.create({
        data: {
            postId: post.id,
            userId: req.user.id,
            parentId: parent?.id ?? null,
            content: data.content
        },
        include: { user: { select: { id: true, name: true, email: true, image: true } } }
    });
    const recipient = parent ? parent.userId : post.userId;
    if (recipient !== req.user.id) {
        await prisma.notification.create({
            data: {
                userId: recipient,
                actorUserId: req.user.id,
                type: parent ? 'REPLY_ON_COMMENT' : 'COMMENT_ON_POST',
                title: parent ? 'New reply on your comment' : 'New comment on your post',
                message: data.content.slice(0, 180),
                courseId: post.courseId,
                postId: post.id,
                commentId: comment.id
            }
        });
    }
    res.status(201).json({
        comment: {
            id: comment.id,
            content: comment.content,
            parentId: comment.parentId,
            createdAt: comment.createdAt,
            author: toAuthor(comment.user),
            isMine: true
        }
    });
}));
communityRouter.post('/reactions', route(async (req, res) => {
    const data = parse(z.object({ postId: z.string().min(1), type: z.enum(REACTIONS) }), req.body);
    const post = await prisma.communityPost.findUnique({
        where: { id: data.postId },
        select: { id: true, userId: true, courseId: true }
    });
    if (!post)
        throw notFound('That post is no longer there.');
    await assertCourseAccess(req.user.id, req.user.role, post.courseId);
    const existing = await prisma.communityPostReaction.findUnique({
        where: { postId_userId_type: { postId: post.id, userId: req.user.id, type: data.type } }
    });
    if (existing) {
        await prisma.communityPostReaction.delete({ where: { id: existing.id } });
        return res.json({ active: false });
    }
    await prisma.communityPostReaction.create({
        data: { postId: post.id, userId: req.user.id, type: data.type }
    });
    if (post.userId !== req.user.id) {
        await prisma.notification.create({
            data: {
                userId: post.userId,
                actorUserId: req.user.id,
                type: 'REACTION_ON_POST',
                title: 'New reaction on your post',
                message: `Someone reacted with ${data.type.toLowerCase()} to your post.`,
                courseId: post.courseId,
                postId: post.id
            }
        });
    }
    return res.json({ active: true });
}));
//# sourceMappingURL=community.js.map