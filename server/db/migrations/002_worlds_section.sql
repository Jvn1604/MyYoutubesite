-- "Game worlds" homepage section: add it to saved section lists, just before "games"
-- (appended at the end if "games" is missing). Sites that already have it are left alone.
update site_settings s
set value = (
  select jsonb_agg(item order by pos, sub)
  from (
    select e as item, o as pos, 1 as sub from jsonb_array_elements(s.value) with ordinality as t(e, o)
    union all
    select '{"key": "worlds", "enabled": true}'::jsonb,
           coalesce((select o from jsonb_array_elements(s.value) with ordinality as t(e, o) where e ->> 'key' = 'games'), 1e9),
           0
  ) x
)
where key = 'sections' and not value @> '[{"key": "worlds"}]';
