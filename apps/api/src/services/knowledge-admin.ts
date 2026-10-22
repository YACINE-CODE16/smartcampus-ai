import { isLang, type FaqEntryDto, type KbDocumentDto, type Lang } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { NotFoundError } from '../domain/errors';
import { normalize } from '../adapters/assistant-text';

export interface FaqInput {
  question: string;
  answer: string;
  questionEn?: string | null;
  answerEn?: string | null;
  keywords: string[];
  topic: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  language: Lang;
}

const faqSelect = { id: true, question: true, answer: true, questionEn: true, answerEn: true, keywords: true, topic: true } as const;

/** Mots-clés stockés normalisés (sans accents, minuscules) pour la recherche locale. */
const cleanKeywords = (k: string[]) => [...new Set(k.map((x) => normalize(x).trim()).filter(Boolean))];

/** US-24 : gestion de la base documentaire de l'assistant (FAQ + documents). */
export class KnowledgeAdminService {
  constructor(private readonly prisma: PrismaClient) {}

  listFaq(): Promise<FaqEntryDto[]> {
    return this.prisma.faqEntry.findMany({ orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }], select: faqSelect });
  }

  async createFaq(input: FaqInput): Promise<FaqEntryDto> {
    const last = await this.prisma.faqEntry.aggregate({ _max: { order: true } });
    return this.prisma.faqEntry.create({
      data: { ...input, keywords: cleanKeywords(input.keywords), order: (last._max.order ?? 0) + 1 },
      select: faqSelect,
    });
  }

  async updateFaq(id: string, input: Partial<FaqInput>): Promise<FaqEntryDto> {
    await this.ensure('faq', id);
    return this.prisma.faqEntry.update({
      where: { id },
      data: { ...input, ...(input.keywords ? { keywords: cleanKeywords(input.keywords) } : {}) },
      select: faqSelect,
    });
  }

  async deleteFaq(id: string): Promise<void> {
    await this.ensure('faq', id);
    await this.prisma.faqEntry.delete({ where: { id } });
  }

  async listDocuments(): Promise<KbDocumentDto[]> {
    const docs = await this.prisma.kbDocument.findMany({ orderBy: { updatedAt: 'desc' } });
    return docs.map((d) => ({ id: d.id, title: d.title, content: d.content, language: isLang(d.language) ? d.language : 'fr', updatedAt: d.updatedAt.toISOString() }));
  }

  async createDocument(input: DocumentInput): Promise<void> {
    await this.prisma.kbDocument.create({ data: input });
  }

  async updateDocument(id: string, input: Partial<DocumentInput>): Promise<void> {
    await this.ensure('document', id);
    await this.prisma.kbDocument.update({ where: { id }, data: input });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.ensure('document', id);
    await this.prisma.kbDocument.delete({ where: { id } });
  }

  private async ensure(kind: 'faq' | 'document', id: string) {
    const found =
      kind === 'faq'
        ? await this.prisma.faqEntry.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.kbDocument.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundError();
  }
}
