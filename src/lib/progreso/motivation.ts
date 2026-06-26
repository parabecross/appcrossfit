const PR_MESSAGES_ES = [
  "¡Nuevo PR! Ese esfuerzo diario está dando frutos.",
  "¡Récord personal! Sigue empujando tus límites.",
  "¡Bestia! Acabas de superarte. El box lo nota.",
  "¡Marca nueva! La constancia siempre gana.",
  "¡PR desbloqueado! Un paso más hacia tu mejor versión.",
];

const PR_MESSAGES_EN = [
  "New PR! That daily effort is paying off.",
  "Personal record! Keep pushing your limits.",
  "Beast mode! You just leveled up.",
  "New mark! Consistency always wins.",
  "PR unlocked! One step closer to your best self.",
];

export function getPrMotivationMessage(locale: string): string {
  const messages = locale === "en" ? PR_MESSAGES_EN : PR_MESSAGES_ES;
  return messages[Math.floor(Math.random() * messages.length)];
}
