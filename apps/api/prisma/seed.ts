/**
 * Données de démo (idempotent : vide puis recrée tout).
 * - 5 comptes de démo (2 étudiants, 2 agents, 1 admin) + 18 étudiants fictifs non connectables
 * - 6 catégories, 5 bâtiments, 20 FAQ
 * - 60 tickets sur 30 jours, tous statuts, historiques cohérents,
 *   dont 2 Sécurité et 3 tickets NOUVEAU de plus de 24 h (en retard)
 */
import { readFileSync } from 'node:fs';
import { buildTitle, computePriority, type IncidentStatus, type Priority, type Urgency } from '@smartcampus/shared';
import { hashPassword } from '../src/adapters/password';
import { env } from '../src/config/env';
import { createPrismaClient } from '../src/db';
import type { ActorRole, EventType } from '../src/generated/prisma/client';

const prisma = createPrismaClient(env.DATABASE_URL);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Générateur pseudo-aléatoire déterministe : même seed → mêmes données à chaque exécution.
let state = 20261023;
function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
const between = (min: number, max: number) => min + rand() * (max - min);

const DEMO_USERS = [
  { key: 'alice', email: 'alice.martin@esiea.fr', name: 'Alice Martin', role: 'STUDENT' },
  { key: 'bob', email: 'bob.durand@esiea.fr', name: 'Bob Durand', role: 'STUDENT' },
  { key: 'karim', email: 'karim.benali@esiea.fr', name: 'Karim Benali', role: 'AGENT' },
  { key: 'julie', email: 'julie.robert@esiea.fr', name: 'Julie Robert', role: 'AGENT' },
  { key: 'claire', email: 'claire.moreau@esiea.fr', name: 'Claire Moreau', role: 'ADMIN' },
] as const;

const EXTRA_STUDENTS = [
  'Lucas Bernard', 'Emma Petit', 'Hugo Richard', 'Léa Dubois', 'Nathan Thomas', 'Chloé Laurent',
  'Louis Simon', 'Manon Michel', 'Gabriel Garcia', 'Camille Roux', 'Arthur Fournier', 'Inès Girard',
  'Jules Mercier', 'Sarah Lambert', 'Adam Faure', 'Zoé Bonnet', 'Raphaël André', 'Lina Fontaine',
];

const CATEGORIES = [
  { slug: 'salle', label: 'Salle', description: 'Fermée, réservée, inaccessible', autoPriority: null },
  { slug: 'materiel', label: 'Matériel', description: 'Vidéoprojecteur, PC, mobilier', autoPriority: null },
  { slug: 'reseau', label: 'Réseau', description: 'Wifi, câblé, accès comptes', autoPriority: null },
  { slug: 'proprete', label: 'Propreté / sanitaires', description: 'Salissures, sanitaires, chauffage', autoPriority: null },
  { slug: 'securite', label: 'Sécurité', description: 'Porte, éclairage, danger — traité en priorité critique', autoPriority: 'CRITIQUE' },
  { slug: 'autre', label: 'Autre', description: 'Tout autre problème', autoPriority: null },
] as const satisfies readonly { slug: string; label: string; description: string; autoPriority: Priority | null }[];

const BUILDINGS = [
  { code: 'A', name: 'Bâtiment A – Enseignement', rooms: ['A101', 'A102', 'A204', 'A208', 'A305', 'Hall'] },
  { code: 'B', name: 'Bâtiment B – Laboratoires', rooms: ['B101', 'B104', 'B204', 'B210', 'Labo électronique', 'Salle info B3'] },
  { code: 'C', name: 'Bâtiment C – Administration', rooms: ['C012', 'C105', 'Accueil', 'Salle du conseil'] },
  { code: 'BIB', name: 'Bibliothèque', rooms: ['Salle de lecture', 'Box 2', 'Box 5', 'Étage 1'] },
  { code: 'RU', name: 'Restaurant universitaire', rooms: ['Salle principale', 'Cafétéria', 'Terrasse'] },
] as const;

/** Poids des bâtiments : A et B concentrent les problèmes (US-30 parlant). */
const BUILDING_WEIGHTS = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'BIB', 'BIB', 'RU'] as const;

const DESCRIPTIONS: Record<string, string[]> = {
  salle: [
    'La salle est fermée à clé alors que nous avons cours à 8h30.',
    'Salle réservée sur l’ENT mais occupée par un autre groupe.',
    'La porte de la salle ne se ferme plus correctement.',
    'Impossible d’accéder à la salle, le badge est refusé.',
  ],
  materiel: [
    'Le vidéoprojecteur ne s’allume pas, impossible de projeter le cours.',
    'Plusieurs PC de la salle ne démarrent pas.',
    'Chaise cassée au deuxième rang, pied fendu.',
    'Le câble HDMI du bureau enseignant est arraché.',
    'Le tableau blanc n’a plus de feutres et l’éponge a disparu.',
  ],
  reseau: [
    'Le wifi eduroam se déconnecte toutes les 5 minutes.',
    'Pas de réseau sur les prises murales de la salle.',
    'Impossible de me connecter à l’ENT depuis ce matin.',
    'Le wifi est très lent, impossible de suivre le TP en ligne.',
  ],
  proprete: [
    'Les toilettes du rez-de-chaussée sont bouchées.',
    'Plus de papier ni de savon dans les sanitaires.',
    'Il fait 14 °C dans la salle, le chauffage ne fonctionne pas.',
    'Poubelles qui débordent près des distributeurs.',
  ],
  securite: [
    'Éclairage de l’escalier de secours hors service, on ne voit plus les marches.',
    'La porte coupe-feu du couloir est bloquée ouverte par une cale.',
  ],
  autre: [
    'Le distributeur de boissons garde la monnaie.',
    'Fuite d’eau au plafond près de l’entrée.',
    'L’ascenseur est en panne depuis hier.',
  ],
};

const START_COMMENTS = ['Pris en charge, intervention prévue dans la journée.', 'Technicien en route.', 'Je passe vérifier sur place.', null];
const RESOLVE_COMMENTS = ['Problème corrigé, merci pour le signalement.', 'Matériel remplacé.', 'Réparation effectuée, tout fonctionne.', 'Réglage effectué.'];
const CONTEST_COMMENTS = ['Le problème est revenu ce matin.', 'Toujours pas réglé, désolé.'];
const REJECT_REASONS = ['Doublon du ticket déjà en cours pour cette salle.', 'Hors périmètre : à adresser à la scolarité.', 'Problème non constaté sur place après vérification.'];

type OwnerKey = 'alice' | 'bob' | 'extra';
interface Spec {
  status: IncidentStatus;
  /** Âge du ticket en jours. */
  age: [number, number];
  owner?: OwnerKey;
  category?: string;
  contested?: boolean;
  /** Ticket NOUVEAU déjà affecté par l'admin (D7 : sans changement de statut). */
  assignedOnly?: boolean;
}

function specs(): Spec[] {
  const list: Spec[] = [
    // NOUVEAU récents (< 24 h), dont l'alerte Sécurité et 2 affectés par l'admin
    { status: 'NOUVEAU', age: [0.05, 0.1], owner: 'bob', category: 'securite' },
    { status: 'NOUVEAU', age: [0.1, 0.4], owner: 'alice', category: 'reseau' },
    { status: 'NOUVEAU', age: [0.2, 0.8], assignedOnly: true },
    { status: 'NOUVEAU', age: [0.2, 0.8], assignedOnly: true },
    { status: 'NOUVEAU', age: [0.1, 0.9] },
    // NOUVEAU en retard (> 24 h)
    { status: 'NOUVEAU', age: [1.5, 2], owner: 'alice', category: 'materiel' },
    { status: 'NOUVEAU', age: [2, 3] },
    { status: 'NOUVEAU', age: [3, 4] },
    // EN_COURS, dont 1 Sécurité et 2 contestés
    { status: 'EN_COURS', age: [1, 2], category: 'securite' },
    { status: 'EN_COURS', age: [3, 6], owner: 'alice', contested: true, category: 'proprete' },
    { status: 'EN_COURS', age: [1, 4], owner: 'alice', category: 'salle' },
    { status: 'EN_COURS', age: [1, 5], owner: 'bob' },
    { status: 'EN_COURS', age: [4, 9], contested: true },
    // RESOLU, dont 1 contesté puis re-résolu
    { status: 'RESOLU', age: [2, 4], owner: 'alice', category: 'materiel' },
    { status: 'RESOLU', age: [2, 6], owner: 'bob' },
    { status: 'RESOLU', age: [5, 12], contested: true },
    // FERME, dont 2 contestés
    { status: 'FERME', age: [8, 20], owner: 'alice', category: 'reseau' },
    { status: 'FERME', age: [15, 28], owner: 'alice' },
    { status: 'FERME', age: [10, 25], owner: 'bob' },
    { status: 'FERME', age: [8, 25], contested: true },
    { status: 'FERME', age: [12, 29], contested: true },
    // REJETE
    { status: 'REJETE', age: [5, 15], owner: 'bob' },
  ];
  const fill = (status: IncidentStatus, count: number, age: [number, number]) => {
    for (let i = 0; i < count; i++) list.push({ status, age });
  };
  fill('EN_COURS', 9, [1, 12]); // → 14 EN_COURS
  fill('RESOLU', 9, [2, 20]); // → 12 RESOLU
  fill('FERME', 17, [4, 30]); // → 22 FERME
  fill('REJETE', 3, [3, 30]); // → 4 REJETE
  return list; // 8 + 14 + 12 + 22 + 4 = 60
}

interface EventDraft {
  type: EventType;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus | null;
  comment: string | null;
  authorId: string | null;
  authorRole: ActorRole;
  createdAt: Date;
}

async function main() {
  const now = Date.now();
  console.log('Réinitialisation des données…');
  await prisma.$executeRawUnsafe(
    'TRUNCATE "IncidentEvent", "Incident", "FaqEntry", "Category", "Building", "User" RESTART IDENTITY CASCADE',
  );

  const demoHash = await hashPassword(env.DEMO_PASSWORD);
  const users = Object.fromEntries(
    await Promise.all(
      DEMO_USERS.map(async (u) => [
        u.key,
        await prisma.user.create({ data: { email: u.email, name: u.name, role: u.role, passwordHash: demoHash } }),
      ]),
    ),
  ) as Record<(typeof DEMO_USERS)[number]['key'], { id: string; name: string }>;

  const extras = await Promise.all(
    EXTRA_STUDENTS.map((name) =>
      prisma.user.create({
        data: {
          name,
          role: 'STUDENT',
          email: `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(' ', '.')}@esiea.fr`,
          passwordHash: 'disabled', // compte fictif : aucune connexion possible
        },
      }),
    ),
  );

  const categories = new Map<string, { id: string; label: string; autoPriority: Priority | null }>();
  for (const [order, c] of CATEGORIES.entries()) {
    categories.set(c.slug, await prisma.category.create({ data: { ...c, order } }));
  }
  const buildings = new Map<string, { id: string; name: string; rooms: readonly string[] }>();
  for (const [order, b] of BUILDINGS.entries()) {
    const row = await prisma.building.create({ data: { code: b.code, name: b.name, order } });
    buildings.set(b.code, { ...row, rooms: b.rooms });
  }

  const faq = JSON.parse(readFileSync(new URL('./data/faq.json', import.meta.url), 'utf8')) as {
    topic: string;
    question: string;
    answer: string;
    keywords: string[];
  }[];
  await prisma.faqEntry.createMany({ data: faq.map((f, order) => ({ ...f, order })) });

  const agents = [users.karim, users.karim, users.julie]; // Karim un peu plus chargé (US-33)
  const nonSecurity = CATEGORIES.map((c) => c.slug).filter((s) => s !== 'securite');

  const drafts = specs().map((spec) => {
    const owner = spec.owner === 'alice' ? users.alice : spec.owner === 'bob' ? users.bob : pick(extras);
    const categorySlug = spec.category ?? pick(nonSecurity);
    const category = categories.get(categorySlug)!;
    const building = buildings.get(pick(BUILDING_WEIGHTS))!;
    const room = pick(building.rooms);
    const urgency: Urgency = pick(['FAIBLE', 'NORMALE', 'NORMALE', 'NORMALE', 'HAUTE', 'HAUTE']);
    const agent = pick(agents);
    const events: EventDraft[] = [];
    const ev = (e: Omit<EventDraft, 'createdAt'>, at: number) => events.push({ ...e, createdAt: new Date(at) });

    // Durées des étapes, puis date de création choisie pour que tout tienne avant « maintenant ».
    const toAssign = between(0.3, 3) * HOUR;
    const toTake = between(1, 20) * HOUR;
    const toResolve = between(2, 72) * HOUR;
    const toContest = between(3, 24) * HOUR;
    const toReResolve = between(4, 36) * HOUR;
    const toClose = between(3, 60) * HOUR;
    let span = 0;
    if (spec.status !== 'NOUVEAU') span += toTake;
    if (['RESOLU', 'FERME'].includes(spec.status) || spec.contested) span += toResolve;
    if (spec.contested) span += toContest + (spec.status === 'EN_COURS' ? 0 : toReResolve);
    if (spec.status === 'FERME') span += toClose;
    const createdAt = Math.min(now - between(...spec.age) * DAY, now - span - 0.2 * HOUR);

    let t = createdAt;
    let status: IncidentStatus = 'NOUVEAU';
    let assignedTo: { id: string } | null = null;
    let takenAt: number | null = null;
    let resolvedAt: number | null = null;
    let closedAt: number | null = null;
    let reopenCount = 0;
    let rejectionReason: string | null = null;

    ev({ type: 'CREATED', fromStatus: null, toStatus: 'NOUVEAU', comment: null, authorId: owner.id, authorRole: 'STUDENT' }, t);

    if (spec.assignedOnly) {
      assignedTo = agent;
      ev({ type: 'ASSIGN', fromStatus: 'NOUVEAU', toStatus: 'NOUVEAU', comment: `Affecté à ${agent.name}`, authorId: users.claire.id, authorRole: 'ADMIN' }, t + toAssign);
    }

    if (spec.status === 'REJETE') {
      assignedTo = agent;
      t += toTake;
      rejectionReason = pick(REJECT_REASONS);
      status = 'REJETE';
      closedAt = t;
      ev({ type: 'STATUS', fromStatus: 'NOUVEAU', toStatus: 'REJETE', comment: rejectionReason, authorId: agent.id, authorRole: 'AGENT' }, t);
    } else if (spec.status !== 'NOUVEAU') {
      // La moitié des tickets passe par une affectation admin avant la prise en charge.
      if (rand() < 0.5) {
        ev({ type: 'ASSIGN', fromStatus: 'NOUVEAU', toStatus: 'NOUVEAU', comment: `Affecté à ${agent.name}`, authorId: users.claire.id, authorRole: 'ADMIN' }, t + Math.min(toAssign, toTake / 2));
      }
      assignedTo = agent;
      t += toTake;
      takenAt = t;
      status = 'EN_COURS';
      ev({ type: 'STATUS', fromStatus: 'NOUVEAU', toStatus: 'EN_COURS', comment: pick(START_COMMENTS), authorId: agent.id, authorRole: 'AGENT' }, t);

      if (['RESOLU', 'FERME'].includes(spec.status) || spec.contested) {
        t += toResolve;
        resolvedAt = t;
        status = 'RESOLU';
        ev({ type: 'STATUS', fromStatus: 'EN_COURS', toStatus: 'RESOLU', comment: pick(RESOLVE_COMMENTS), authorId: agent.id, authorRole: 'AGENT' }, t);
      }
      if (spec.contested) {
        t += toContest;
        reopenCount = 1;
        resolvedAt = null;
        status = 'EN_COURS';
        ev({ type: 'STATUS', fromStatus: 'RESOLU', toStatus: 'EN_COURS', comment: pick(CONTEST_COMMENTS), authorId: owner.id, authorRole: 'STUDENT' }, t);
        if (spec.status !== 'EN_COURS') {
          t += toReResolve;
          resolvedAt = t;
          status = 'RESOLU';
          ev({ type: 'STATUS', fromStatus: 'EN_COURS', toStatus: 'RESOLU', comment: 'Nouvelle intervention, pièce remplacée.', authorId: agent.id, authorRole: 'AGENT' }, t);
        }
      }
      if (spec.status === 'FERME') {
        t += toClose;
        closedAt = t;
        status = 'FERME';
        ev({ type: 'STATUS', fromStatus: 'RESOLU', toStatus: 'FERME', comment: 'Résolution confirmée.', authorId: owner.id, authorRole: 'STUDENT' }, t);
      }
    }

    const priority = computePriority(urgency, category.autoPriority);
    return {
      createdAt,
      data: {
        title: buildTitle(category.label, building.name, room),
        categoryId: category.id,
        buildingId: building.id,
        room,
        description: pick(DESCRIPTIONS[categorySlug]!),
        urgency,
        priority,
        status,
        ownerId: owner.id,
        assignedToId: assignedTo?.id ?? null,
        reopenCount,
        rejectionReason,
        createdAt: new Date(createdAt),
        updatedAt: new Date(events.at(-1)!.createdAt),
        takenAt: takenAt ? new Date(takenAt) : null,
        resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
        closedAt: closedAt ? new Date(closedAt) : null,
      },
      events,
    };
  });

  // Insertion chronologique : les numéros SC-xxxx suivent l'ordre de création.
  drafts.sort((a, b) => a.createdAt - b.createdAt);
  for (const d of drafts) {
    await prisma.incident.create({ data: { ...d.data, events: { create: d.events } } });
  }

  const counts = await prisma.incident.groupBy({ by: ['status'], _count: true });
  console.log(`Seed terminé : ${drafts.length} tickets`, Object.fromEntries(counts.map((c) => [c.status, c._count])));
  console.log(`Comptes de démo (mot de passe : ${env.DEMO_PASSWORD}) :`);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
