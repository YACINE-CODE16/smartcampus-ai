import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import type { Lang } from '@smartcampus/shared';
import type { KnowledgeBase, Passage } from '../ports/knowledge-base';

/**
 * Amazon Bedrock Knowledge Base (KB_DRIVER=bedrock) : documents indexés depuis S3, recherche sémantique.
 * Le score Bedrock (0–1) est ramené sur l'échelle locale pour être comparable aux passages FAQ.
 */
export class BedrockKnowledgeBase implements KnowledgeBase {
  readonly name = 'bedrock';
  private readonly client: BedrockAgentRuntimeClient;

  constructor(
    private readonly knowledgeBaseId: string,
    region: string,
  ) {
    this.client = new BedrockAgentRuntimeClient({ region });
  }

  async search(query: string, _lang: Lang, limit: number): Promise<Passage[]> {
    const res = await this.client.send(
      new RetrieveCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: limit } },
      }),
    );
    return (res.retrievalResults ?? []).flatMap((r, i) => {
      const text = r.content?.text;
      if (!text) return [];
      const uri = r.location?.s3Location?.uri ?? `kb-${i}`;
      return [{ type: 'document' as const, id: uri, title: uri.split('/').pop() ?? uri, content: text, score: Math.round((r.score ?? 0) * 10) }];
    });
  }
}

/** Combine plusieurs bases (FAQ locale toujours présente + Knowledge Base en production). */
export class CompositeKnowledgeBase implements KnowledgeBase {
  readonly name: string;

  constructor(private readonly bases: KnowledgeBase[]) {
    this.name = bases.map((b) => b.name).join('+');
  }

  async search(query: string, lang: Lang, limit: number): Promise<Passage[]> {
    const results = await Promise.allSettled(this.bases.map((b) => b.search(query, lang, limit)));
    return results
      .flatMap((r) => {
        if (r.status === 'rejected') console.error('[assistant] base documentaire indisponible :', r.reason);
        return r.status === 'fulfilled' ? r.value : [];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
