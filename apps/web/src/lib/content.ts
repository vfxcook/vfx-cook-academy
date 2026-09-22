/**
 * The Academy's own pipeline. It mirrors the six stages a film moves through inside
 * brahmastra.studio, so what a student learns here maps one-to-one onto the tool they
 * graduate into. The landing scene, the sign-in scene and the curriculum rail all read
 * from this one list.
 */
export interface Stage {
  id: string;
  number: string;
  label: string;
  title: string;
  sub: string;
  mentor: string;
}

const stage = (
  id: string,
  number: string,
  label: string,
  title: string,
  sub: string,
  mentor: string
): Stage => ({ id, number, label, title, sub, mentor });

export const STAGES: Stage[] = [
  stage('prompt', '01', 'Prompt', 'Write the frame before you generate it',
    'Composition, lens, lighting and blocking written as language a model can actually hold.', 'Craft'),
  stage('world', '02', 'World', 'Lock the cast and the places',
    'Build reference stills your characters and locations never drift away from.', 'Continuity'),
  stage('motion', '03', 'Motion', 'Turn a still into a moving shot',
    'Camera moves, motion rhythm and the beat length that makes a shot read as cinema.', 'Camera'),
  stage('scene', '04', 'Scene', 'Direct a scene, not a clip',
    'Coverage, eyelines and cutting patterns so separate generations belong to one space.', 'Direction'),
  stage('finish', '05', 'Finish', 'Grade, sound and polish',
    'Colour, sound design and the finishing pass that removes the AI tell.', 'Post'),
  stage('deliver', '06', 'Deliver', 'Ship it like a studio',
    'Export specs, deliverables and a reel that survives a client review.', 'Delivery')
];

export const brand = {
  name: 'BrahmAstra',
  module: 'Academy',
  parent: 'brahmastra.studio',
  parentUrl: 'https://brahmastra.studio',
  tagline: 'Cinematic AI, taught like film.'
};

export const hero = {
  eyebrow: 'Malayalam batch · Cinematic AI',
  headline: ['Learn to direct', 'what the model', 'only generates.'],
  ghost: 'In Malayalam.',
  lede:
    'AI tools can produce a frame. Only a filmmaker can decide the frame is right. This is the craft in between — taught end to end, in Malayalam, by the team that builds BrahmAstra Studio.',
  proof: 'Built on the BrahmAstra production pipeline.',
  primaryCta: 'See the courses',
  secondaryCta: 'Watch a free lesson'
};

export const valueProps = [
  {
    id: 'filmmakers',
    title: 'Taught by filmmakers',
    text: 'Every lesson comes from people who ship shots, not from people who only write prompts.'
  },
  {
    id: 'production',
    title: 'Production-grade output',
    text: 'You leave with work that survives a client review, not a gallery of pretty tests.'
  },
  {
    id: 'community',
    title: 'A room full of directors',
    text: 'Post your shots on the course wall, get notes back, and watch the batch level up together.'
  }
];

export const learningOutcomes = [
  'Write cinematic image prompts that hold a composition',
  'Convert stills into high-quality AI video',
  'Keep a character consistent across an entire scene',
  'Control camera movement and motion rhythm',
  'Build premium lighting and atmosphere',
  'Avoid the plastic, obviously-AI look',
  'Block and direct a scene like a filmmaker',
  'Add sound, dialogue and cinematic polish',
  'Run the whole pipeline from idea to final cut'
];

export const faqs = [
  {
    q: 'Do I need a background in VFX or filmmaking?',
    a: 'No. The course starts from how a shot is composed and builds to a full pipeline. If you can watch a film and say what you liked, you have enough to start.'
  },
  {
    q: 'Which language is it taught in?',
    a: 'Malayalam, with the technical vocabulary kept in English so the terms match the tools you will use.'
  },
  {
    q: 'What do I need to follow along?',
    a: 'A laptop and an internet connection. The AI tooling runs in the browser — nothing needs a GPU on your machine.'
  },
  {
    q: 'How long do I keep access?',
    a: 'Your enrolment does not expire. New lessons added to a course you own show up in your classroom automatically.'
  },
  {
    q: 'How does this connect to BrahmAstra Studio?',
    a: 'The Academy is the learning module of brahmastra.studio. The six stages you learn here are the same six stages the studio runs on, so finishing a course drops you straight into the tool.'
  }
];

export const gallery = Array.from({ length: 15 }, (_, index) => ({
  src: `/bg/${index + 1}.jpeg`,
  alt: `Cinematic AI frame from the Academy reel, plate ${index + 1}`
})).filter(item => !item.src.endsWith('/7.jpeg'));
