with groups as (
  select array_agg(id) as ids
  from public.users_group
)
update public.users
set users_group_id = groups.ids[
  1 + floor(random() * array_length(groups.ids, 1))::int
]
from groups;
