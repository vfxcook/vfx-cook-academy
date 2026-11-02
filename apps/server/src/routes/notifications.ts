import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';
import { badRequest, parse, route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { toAuthor } from '../lib/serialize.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireUser);

notificationsRouter.get(
  '/',
  route(async (req, res) => {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          actorUser: { select: { id: true, name: true, email: true, image: true } },
          course: { select: { slug: true, title: true } }
        }
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } })
    ]);

    res.json({
      unreadCount,
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        createdAt: item.createdAt,
        actor: item.actorUser ? toAuthor(item.actorUser) : null,
        course: item.course,
        postId: item.postId,
        videoId: item.videoId
      }))
    });
  })
);

notificationsRouter.patch(
  '/',
  route(async (req, res) => {
    const data = parse(
      z.object({ notificationId: z.string().min(1).optional(), markAll: z.boolean().optional() }),
      req.body
    );

    if (data.markAll) {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });
      return res.json({ ok: true });
    }

    if (!data.notificationId) throw badRequest('Pick a notification to mark as read.');

    await prisma.notification.updateMany({
      where: { id: data.notificationId, userId: req.user!.id },
      data: { isRead: true, readAt: new Date() }
    });
    return res.json({ ok: true });
  })
);
