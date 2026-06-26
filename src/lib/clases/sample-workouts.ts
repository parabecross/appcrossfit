/** Ejemplos de WOD por tipo de clase (seed y datos de demo). */
const WORKOUTS_BY_NAME: Record<string, string> = {
  "WOD Matutino":
    "Calentamiento: 2 rondas de 10 calorías bike + 10 air squats\n\nWOD (18 min cap):\n3 rondas\n• 400 m carrera\n• 21 kettlebell swings (16/12 kg)\n• 15 burpees\n\nObjetivo: mantener ritmo constante. Escala: 200 m + 15 swings + 10 burpees.",
  Hyrox:
    "Bloque de resistencia:\n5 series de:\n• 1 000 m remo\n• 50 wall balls (9/6 kg)\nDescanso 2 min entre series\n\nEnfócate en transiciones rápidas. Hidrátate entre series.",
  Halterofilia:
    "Fuerza:\nBack Squat 5×5 @ 75% 1RM\nDescanso 2–3 min\n\nMetcon (12 min cap):\n12-9-6\n• Peso muerto (70/50 kg)\n• Box jumps (60/50 cm)\n\nPrioriza técnica en las series de fuerza.",
  Gimnasia:
    "Skill (15 min):\nPráctica de muscle-up y transiciones en anillas\n\nWOD:\n21-15-9\n• Pull-ups\n• Dips\n• Air squats\n\nEscala: jumping pull-ups + push-ups en rodillas.",
  "WOD Nocturno":
    "Calentamiento: movilidad de hombros + 3×10 PVC passthrough\n\nWOD \"Fran\" (modificado):\n21-15-9\n• Thrusters (43/30 kg)\n• Pull-ups\n\nTime cap: 12 min. Partner opcional: reparten reps.",
};

export function getSampleWorkout(className: string): string {
  return (
    WORKOUTS_BY_NAME[className] ??
    "Calentamiento general 10 min\n\nWOD por anunciar — consulta al coach antes de la clase."
  );
}
