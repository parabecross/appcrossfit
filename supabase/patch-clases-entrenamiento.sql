-- Run in Supabase SQL Editor: workout field + coach can edit their classes

ALTER TABLE clases ADD COLUMN IF NOT EXISTS entrenamiento TEXT;

CREATE POLICY "clases_update_coach_assigned"
  ON clases FOR UPDATE
  USING (coach_id = get_my_profile_id())
  WITH CHECK (coach_id = get_my_profile_id());

-- Ejemplos de entrenamiento por tipo de clase
UPDATE clases SET entrenamiento = 'Calentamiento: 2 rondas de 10 calorías bike + 10 air squats

WOD (18 min cap):
3 rondas
• 400 m carrera
• 21 kettlebell swings (16/12 kg)
• 15 burpees

Objetivo: mantener ritmo constante.' WHERE nombre = 'WOD Matutino' AND entrenamiento IS NULL;

UPDATE clases SET entrenamiento = 'Bloque de resistencia:
5 series de:
• 1 000 m remo
• 50 wall balls (9/6 kg)
Descanso 2 min entre series.' WHERE nombre = 'Hyrox' AND entrenamiento IS NULL;

UPDATE clases SET entrenamiento = 'Fuerza:
Back Squat 5×5 @ 75% 1RM

Metcon (12 min cap):
12-9-6
• Peso muerto (70/50 kg)
• Box jumps (60/50 cm)' WHERE nombre = 'Halterofilia' AND entrenamiento IS NULL;

UPDATE clases SET entrenamiento = 'Skill (15 min):
Práctica de muscle-up

WOD:
21-15-9
• Pull-ups
• Dips
• Air squats' WHERE nombre = 'Gimnasia' AND entrenamiento IS NULL;

UPDATE clases SET entrenamiento = 'WOD "Fran" (modificado):
21-15-9
• Thrusters (43/30 kg)
• Pull-ups
Time cap: 12 min' WHERE nombre = 'WOD Nocturno' AND entrenamiento IS NULL;
