-- ============================================================
-- Wellness Dashboard — seed data
-- Source of truth: SPEC.md §8 + Supplements_Registry.md
-- Run AFTER schema.sql. Idempotent-ish: safe to re-run.
-- ============================================================

-- ---------- Supplements — exactly the 7 rows from Supplements_Registry.md ----------
insert into public.supplements (name, dose_label, brand, slot, scheduled_time, counts_toward_target, sort_order)
values
  ('Creatine',   '5 g',        null,             'afternoon', '12:00', true,  1),
  ('Krill Oil',  'per label',  'Sports Research', 'afternoon', '12:00', true,  2),
  ('TMG',        '2 capsules', null,             'afternoon', '12:00', true,  3),
  ('Creatine',   '5 g',        null,             'night',     '22:00', true,  4),
  ('Collagen',   '20 mg',      null,             'night',     '22:00', true,  5),
  ('B12 Complex','per label',  null,             'flexible',  null,   false, 6),
  ('Vitamin D',  'per label',  null,             'flexible',  null,   false, 7)
on conflict do nothing;

-- ---------- Settings — single row ----------
insert into public.settings (id)
values (1)
on conflict do nothing;

-- ---------- Plans — daily ritual (SPEC §5.4 seed) ----------
insert into public.plans (title, subtitle, cadence, pillar, sort_order)
values
  ('Daily Ritual', 'The loop that closes every day', 'daily', 'mind', 1),
  ('Weekly Rhythm', 'The week at a glance', 'weekly', 'body', 2)
on conflict do nothing;

-- plan items, linked to metrics where the spec says so
insert into public.plan_items (plan_id, label, time_of_day, target_value, unit, linked_metric, sort_order)
select p.id, item.label, item.time_of_day, item.target_value, item.unit, item.linked_metric, item.sort_order
from public.plans p
cross join (values
  -- Daily Ritual — Morning
  ('Read today''s quote', 'morning', null, null, null, 1),
  ('Headspace session', 'morning', 10, 'min', 'meditation_minutes', 2),
  ('Water: first 16 oz', 'morning', 16, 'oz', 'water_oz', 3),
  ('Walk', 'morning', 30, 'min', 'walk_minutes', 4),
  -- Daily Ritual — Midday
  ('12 PM supplements (Creatine · Krill Oil · TMG)', 'midday', null, null, 'supplements_afternoon', 5),
  ('Protein check-in', 'midday', 120, 'g', 'protein_g', 6),
  ('Workout', 'midday', null, null, 'workout_done', 7),
  -- Daily Ritual — Evening
  ('Reading (20 min)', 'evening', 20, 'min', null, 8),
  ('Chess (15 min)', 'evening', 15, 'min', null, 9),
  ('10 PM supplements (Creatine · Collagen)', 'evening', null, null, 'supplements_night', 10),
  ('Wind-down by 10:30', 'evening', null, null, null, 11),
  ('Log the day', 'evening', null, null, null, 12)
) as item(label, time_of_day, target_value, unit, linked_metric, sort_order)
where p.title = 'Daily Ritual'
on conflict do nothing;

-- ---------- Quotes — 40 seeded, weighted to security + confidence (SPEC §8) ----------
insert into public.quotes (body, author, source, theme) values
  -- security (12)
  ('No one can make you feel inferior without your consent.', 'Eleanor Roosevelt', null, 'security'),
  ('You yourself, as much as anybody in the entire universe, deserve your love and affection.', 'Buddha', null, 'security'),
  ('I am not what happened to me, I am what I choose to become.', 'Carl Jung', null, 'security'),
  ('The best way to find yourself is to lose yourself in the service of others.', 'Mahatma Gandhi', null, 'security'),
  ('What lies behind us and what lies before us are tiny matters compared to what lies within us.', 'Ralph Waldo Emerson', null, 'security'),
  ('You are allowed to take up space in rooms you earned your way into.', null, null, 'security'),
  ('You do not have to earn rest. You were never on trial for existing.', null, null, 'security'),
  ('The strongest people are not those who show strength in front of us, but those who win battles we know nothing about.', null, null, 'security'),
  ('Your presence is not a problem to be solved. You are not too much, and you are not too little.', null, null, 'security'),
  ('Being safe in your own body begins with being honest about what you need.', null, null, 'security'),
  ('You are the only person who gets to decide what your enough looks like.', null, null, 'security'),
  ('Softness is not weakness. It is a quiet form of power that knows it does not need to prove anything.', null, null, 'security'),
  -- confidence (12)
  ('I can be changed by what happens to me. But I refuse to be reduced by it.', 'Maya Angelou', 'Letter to My Daughter', 'confidence'),
  ('Courage is not the absence of fear, but the triumph over it.', 'Nelson Mandela', null, 'confidence'),
  ('You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.', 'Eleanor Roosevelt', null, 'confidence'),
  ('Do not wait for the perfect moment; take the moment and make it perfect.', null, null, 'confidence'),
  ('Whatever you are, be a good one.', 'Abraham Lincoln', null, 'confidence'),
  ('The question isnt who is going to let me; its who is going to stop me.', 'Ayn Rand', null, 'confidence'),
  ('Confidence is not they will like me; confidence is I will be fine if they dont.', 'Christina Grimmie', null, 'confidence'),
  ('You have been assigned this mountain to show others it can be moved.', null, null, 'confidence'),
  ('Your voice is not too loud. Your ideas are not too big. Say them anyway.', null, null, 'confidence'),
  ('The world has already seen the version of you that hesitates. Show them the one that doesnt.', null, null, 'confidence'),
  ('You dont need permission to begin. The seat at the table was always yours.', null, null, 'confidence'),
  ('What if you stopped negotiating with yourself and just walked in?', null, null, 'confidence'),
  -- self-trust (6)
  ('Trust yourself. You know more than you think you do.', 'Benjamin Spock', null, 'self-trust'),
  ('When you recover or discover something that nourishes your soul and brings joy, care enough about yourself to make room for it in your life.', 'Jean Shinoda Bolen', null, 'self-trust'),
  ('The moment you doubt whether you can fly, you cease forever to be able to do it.', 'J.M. Barrie', 'Peter Pan', 'self-trust'),
  ('Your intuition is a quiet knowing that never argues. Learn to listen before it stops speaking.', null, null, 'self-trust'),
  ('You have survived every single day you thought you couldnt. That is not luck. That is you.', null, null, 'self-trust'),
  ('Self-trust is built in small promises kept to yourself, one at a time.', null, null, 'self-trust'),
  -- courage (5)
  ('Courage is the most important of all the virtues because without courage, you cant practice any other virtue consistently.', 'Maya Angelou', null, 'courage'),
  ('It is not the critic who counts; the credit belongs to the man who is actually in the arena.', 'Theodore Roosevelt', 'Citizenship in a Republic', 'courage'),
  ('Life shrinks or expands in proportion to ones courage.', 'Anaïs Nin', null, 'courage'),
  ('You can, you should, and if youre brave enough to start, you will.', 'Stephen King', 'On Writing', 'courage'),
  ('Bravery is not the absence of fear. It is showing up with the fear still in the room.', null, null, 'courage'),
  -- calm (5)
  ('You do not need to be busy to be worthy. Stillness is not empty time; it is where you return to yourself.', null, null, 'calm'),
  ('Almost everything will work again if you unplug it for a few minutes, including you.', 'Anne Lamott', null, 'calm'),
  ('Nothing in nature lives its life best by rushing. Neither do you.', null, null, 'calm'),
  ('Quiet the mind, and the soul will speak.', 'Ma Jaya Sati Bhagavati', null, 'calm'),
  ('Breath is the bridge which connects life to consciousness.', 'Thich Nhat Hanh', null, 'calm')
on conflict do nothing;
