/** Pass to a Radix `Dialog.Content`'s `onInteractOutside` prop. Radix Dialogs auto-dismiss on any
 *  click/focus outside their own `DialogContent` — but the tour overlay (`TourOverlay.tsx`) renders
 *  its card and buttons in a SEPARATE portal, not inside whatever dialog a step happens to be
 *  spotlighting (the trade form, the week detail modal), so without this, clicking the tour's own
 *  "Next" button was treated as an outside click and started closing the dialog underneath it right
 *  as the click landed — the actual cause of "Next" appearing unclickable, and (since the closing
 *  dialog's exit animation briefly leaves a shrinking, off-position element in the DOM) of the tour
 *  card measuring that dialog's rect mid-collapse and landing in a corner. */
export function ignoreTourOutsideClicks(event: Event): void {
  const target = event.target as HTMLElement | null;
  if (target?.closest("[data-tour-overlay]")) {
    event.preventDefault();
  }
}
