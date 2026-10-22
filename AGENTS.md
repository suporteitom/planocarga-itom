<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Passagem de turno
- All shift/timezone math lives in src/lib/shifts.ts (Europe/Lisbon; night shift (23–07) opens the next day's plan) — single tested source of truth.
- Current user identity comes only from useCurrentUser in src/lib/identity.ts — swap it for real auth later without touching screens.
- Login required: app lives under src/routes/_authenticated; tables allow only the authenticated role (anon revoked). Usernames without "@" map to <user>@itom.local.
- Live updates via one realtime channel (useRealtimeSync) that invalidates react-query keys.
