import type { Focus, TopicId } from '../types';

export interface Topic {
  id: TopicId;
  /** Nome curto no menu. */
  label: string;
  /** Uma linha dizendo o que cai nesse conteudo. */
  summary: string;
  /** Tempos verbais incluidos. Vazio em 'all': aceita o banco inteiro. */
  focuses: readonly Focus[];
}

export const TOPICS: readonly Topic[] = [
  {
    id: 'past-contrast',
    label: 'Simple Past x Past Perfect',
    summary: 'O que aconteceu antes do que ja era passado.',
    focuses: ['simple-past', 'past-perfect', 'contrast'],
  },
  {
    id: 'present',
    label: 'Presente',
    summary: 'Simple, continuous, perfect e perfect continuous.',
    focuses: [
      'present-simple',
      'present-continuous',
      'present-perfect',
      'present-perfect-continuous',
    ],
  },
  {
    id: 'past',
    label: 'Passado',
    summary: 'Simple, continuous, perfect e perfect continuous.',
    focuses: [
      'simple-past',
      'past-continuous',
      'past-perfect',
      'past-perfect-continuous',
      'contrast',
    ],
  },
  {
    id: 'future',
    label: 'Futuro',
    summary: 'Will, going to, continuous e perfect.',
    focuses: ['future-will', 'future-going-to', 'future-continuous', 'future-perfect'],
  },
  {
    id: 'all',
    label: 'Todos os tempos',
    summary: 'Passado, presente e futuro embaralhados.',
    focuses: [],
  },
];

export const DEFAULT_TOPIC: TopicId = 'past-contrast';

export function findTopic(id: TopicId): Topic {
  const topic = TOPICS.find((item) => item.id === id);
  if (!topic) throw new Error(`Conteudo desconhecido: ${id}`);
  return topic;
}

/** 'all' aceita tudo; os demais filtram pelos tempos verbais do conteudo. */
export function includesFocus(topic: Topic, focus: Focus): boolean {
  return topic.focuses.length === 0 || topic.focuses.includes(focus);
}
