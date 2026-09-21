# Backlog

Outstanding UI/UX fixes carried over from earlier work. Preserved verbatim in
intent from the original `changesToBeMade.txt`; reformatted, not rewritten.

Items here are **not** verified as still-outstanding — confirm before starting.

## Contacts

- [ ] **Pagination scroll position.** When the next page of contacts loads, the
      view should jump to the top of the list rather than leaving the user at
      the bottom.
- [ ] **Import mapping screen overflows.** The column-mapping step is overlapped
      by the menu and doesn't fit on screen. Reduce the container's vertical
      extent so the full step is visible.
- [ ] **Import field dropdown.** Cap the menu at ~5 visible options and make it
      scrollable. _The grey-out half of this item appears done:_
      `isFieldMappedElsewhere` in
      `apps/web/src/components/contacts/ImportContactsModal.tsx` drives both
      `disabled` and a muted style on already-mapped options. Only the height
      cap and scrolling remain.

## Campaigns

- [ ] **Create-campaign prompt is too narrow.** Widen the naming dialog.
- [ ] **Status dropdown.** Fix the status menu and give it a solid background —
      it currently renders transparent.
- [ ] **Contact-adding parity.** The campaigns screen needs the same three paths
      the contacts screen has: CSV import, single-contact creation, and adding
      existing contacts.
