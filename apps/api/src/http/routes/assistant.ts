import { Router } from 'express';
import { z } from 'zod';
import { bi, LANGS } from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError } from '../../domain/errors';
import { currentUser, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';

const askSchema = z.object({
  message: z
    .string({ error: bi('Posez une question', 'Ask a question') })
    .trim()
    .min(2, bi('Posez une question', 'Ask a question'))
    .max(1000, bi('Question trop longue (1 000 caractères max.)', 'Question too long (1,000 characters max)')),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

const id = (raw: unknown) => {
  const r = z.uuid().safeParse(raw);
  if (!r.success) throw new NotFoundError();
  return r.data;
};

/** US-19 à US-23, US-25 : assistant de l'étudiant. */
export function assistantRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('STUDENT'));

  router.post('/ask', async (req, res) => {
    const { message, history } = parseBody(askSchema, req.body);
    res.json(await container.assistant.ask(currentUser(req), message, history));
  });

  router.post('/interactions/:id/feedback', async (req, res) => {
    const { helpful } = parseBody(z.object({ helpful: z.boolean().nullable() }), req.body);
    await container.assistant.feedback(currentUser(req), id(req.params.id), helpful);
    res.status(204).end();
  });

  router.post('/triage', async (req, res) => {
    const { description } = parseBody(z.object({ description: z.string().max(2000) }), req.body);
    res.json({ suggestion: await container.assistant.triage(currentUser(req), description) });
  });

  return router;
}

const faqSchema = z.object({
  question: z.string().trim().min(5, bi('Question trop courte', 'Question too short')).max(300),
  answer: z.string().trim().min(10, bi('Réponse trop courte', 'Answer too short')).max(3000),
  questionEn: z.string().trim().max(300).nullable().optional(),
  answerEn: z.string().trim().max(3000).nullable().optional(),
  keywords: z.array(z.string().trim().min(2).max(60)).max(30).default([]),
  topic: z.string().trim().min(2).max(40).default('autre'),
});

const documentSchema = z.object({
  title: z.string().trim().min(3, bi('Titre trop court', 'Title too short')).max(200),
  content: z.string().trim().min(20, bi('Contenu trop court', 'Content too short')).max(20000),
  language: z.enum(LANGS).default('fr'),
});

/** US-24 : base documentaire, réservée à l'admin. */
export function knowledgeRouter(container: Container): Router {
  const router = Router();
  const kb = container.knowledge;
  router.use(requireRole('ADMIN'));

  router.get('/faq', async (_req, res) => res.json(await kb.listFaq()));
  router.post('/faq', async (req, res) => res.status(201).json(await kb.createFaq(parseBody(faqSchema, req.body))));
  router.patch('/faq/:id', async (req, res) => res.json(await kb.updateFaq(id(req.params.id), parseBody(faqSchema.partial(), req.body))));
  router.delete('/faq/:id', async (req, res) => {
    await kb.deleteFaq(id(req.params.id));
    res.status(204).end();
  });

  router.get('/documents', async (_req, res) => res.json(await kb.listDocuments()));
  router.post('/documents', async (req, res) => {
    await kb.createDocument(parseBody(documentSchema, req.body));
    res.status(201).json(await kb.listDocuments());
  });
  router.patch('/documents/:id', async (req, res) => {
    await kb.updateDocument(id(req.params.id), parseBody(documentSchema.partial(), req.body));
    res.json(await kb.listDocuments());
  });
  router.delete('/documents/:id', async (req, res) => {
    await kb.deleteDocument(id(req.params.id));
    res.status(204).end();
  });

  return router;
}
