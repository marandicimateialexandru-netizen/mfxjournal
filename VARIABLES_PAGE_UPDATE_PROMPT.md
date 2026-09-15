# Update prompt — paste this into Claude Code inside your existing MFXJournal project

Copy everything below the line as your message to Claude Code. This is a **modification** task, not a rebuild: the app already exists (built from an earlier spec). This prompt only covers the **Variables page** — don't touch any other page or feature while doing this.

---

I want you to audit and update the **Variables page** in this app so it matches the exact behavior described below. I did a detailed live pass through a reference app's Variables page (scrolling, clicking every button, opening every modal) and found several things our current implementation is missing or has simplified incorrectly. Go through each item, check what we currently have, and patch whatever doesn't match — don't rebuild the whole page from scratch if large parts already match this spec.

## Page shell
- Header: "Variables – [Workspace name]" + subtext "Drag to reorder variables and their values"
- Toolbar (top, left to right): **Apply Template**, **Save as Template**, **Clear Variables** (styled as destructive/red text), **+ New Variable** (primary filled button, right-aligned)
- Two-column grid of cards below. Every card has a drag handle (⋮⋮) next to its title for card-level reordering. Inside a card, every value row also has its own drag handle for value-level reordering.

## The built-in/auto-generated cards
- **Days of Week** — auto-generated from trade data, read-only, not deletable
- **Time of Day** — badged "Auto-generated" in the corner. Controls: a **Window** dropdown (e.g. "1 hour"), a **Calculate by** segmented control with three options (**Start / End / Active**, "Start" selected by default), and a **Time Range** row with From/To dropdowns (e.g. 09:00 to 24:00) plus a small (i) info icon. Below the controls, once there's enough trade data, show two live leaderboards: a green **"Best Performing"** section listing the top 3 hour-buckets, and a red **"Needs Improvement"** section listing the bottom 3 — each row formatted exactly like `14:00-15:00    75% WR · +0.50R · 10 trades`. Before there's enough data, show "Add trades to see time-based performance insights." instead.
- **Months** — auto-generated, read-only
- **Custom Results** — starts with Win / Loss / Break Even, each tagged "Default" and not removable. A "+" in the card header opens an **Add Custom Result** modal: an optional icon picker ("Click to pick an icon"), a **Label** text input, and a **"Count as (for calculations)"** dropdown with exactly three options (Win / Loss / BE) that shows live helper text under it ("This result will be counted as a win in all calculations." — text changes with the selected option), then an **Add** button.
- **Markets** — a free list of instrument/symbol strings; "+" in the header adds one; empty state reads "No markets yet. Click + to add one."
- **Streak Analysis** — an enable/disable toggle in the top-right of the card. Body: default threshold chips **3+ / 5+ / 7+ / 9+**, an input ("e.g. 4") + **"+ Add threshold"** button to add custom thresholds, and below a divider, a **"Break-evens break streaks"** toggle with explanation text: "When off, BE trades won't reset your win/loss streak count."
- **Accounts** — just an enable/disable toggle; when off, shows explanatory copy only: "Enable to tag trades with different accounts (e.g., Funded, Personal)."

## Custom (user-created) variable cards
Each user-created Variable renders as its own card:
- Header: icon + label on the left, then three icon buttons on the right — pencil (rename the variable), trash (delete the whole variable), "+" (add a value)
- Body: a reorderable list of value rows. Each row has a drag handle, an optional icon/emoji, the label text, and its own pencil (edit this value) / trash (delete this value) icons on the right

## Modals — match these exactly

**Create New Variable** (opened by the toolbar's "+ New Variable"):
- A **Variable Type** picker: two large side-by-side toggle cards — **Text** ("T" icon, subtitle "Select from options") and **Number** ("#" icon, subtitle "Enter numeric values")
- **Name** text input (placeholder "e.g., Setup")
- **First Value** text input (placeholder "e.g., ICT Silver Bullet") — only relevant/shown for Text type
- **Create Variable** button
- Number-type variables should NOT get a value-chip list at all — they store one raw numeric value per trade. (If the Dashboard has a "Number Variables" section for correlation/histogram display, make sure newly created Number variables show up there instead of as a value-chip card here.)

**Add value to a variable** (the "+" in a custom variable's card header):
- Small modal titled "Add to [Variable Name]"
- Just a **Value** text input (placeholder "Enter value") and an **Add** button — no icon or color picker at creation time

**Edit a value** (the pencil on a value row):
- Modal titled "Edit Variable"
- Shows the current icon as a clickable swatch ("Click to change icon") that opens the shared icon picker (below)
- A prefilled **Label** input
- **Save Changes** button

**Shared icon picker** — this should be ONE reusable component used everywhere an icon/emoji can be picked (Custom Results, variable values, markets, anywhere else icons appear). It's a categorized emoji grid with these exact category tabs: **Time, Money, Charts, Status, Emotions, Objects, Arrows, Nature, Symbols, Tech, Flags, Animals, Weather**. Each tab shows a grid of pickable emoji. When editing an existing icon, include a **"Remove icon"** link at the bottom of the picker. There is no separate hex/RGB color picker anywhere in the Variables page — what looks like a "color" on a value (e.g. a green or red dot) is just a colored-circle emoji chosen from this same picker, from the Status category. If you currently have a separate color-swatch picker for variable values, replace it with this shared emoji picker instead.

**Clear Variables** (toolbar button):
- Opens a confirm dialog titled **"Clear All Variables?"**
- Body copy, with real live counts filled in: `This will permanently delete all variables (X text, Y number) from "[Workspace]". This action cannot be undone.`
- **Cancel** and a red **"Clear All"** button
- Make sure this is a genuine destructive action gated behind this confirm step — not a soft delete, and don't skip the confirm dialog.

**Apply Template** (toolbar button):
- Modal titled "Apply Template"
- Explanatory copy: "Select a template to apply. You'll be able to map your current variables to the new template to preserve trade connections."
- A "Select a template" dropdown
- **Continue** button
- Make sure at least one built-in default template ships with the app (call it something like "Trading Institutional (Default)") so this dropdown isn't empty on a fresh install.

**Save as Template** (toolbar button):
- Modal titled "Save as Template"
- Explanatory copy: "Save your current variables as a reusable template."
- A live, accurate count line: `This will save N variables from the current stat.` (N = actual count of variable values currently configured)
- **Template Name** input (placeholder "My Trading Setup")
- **Description (optional)** textarea (placeholder "Description of this template")
- **Save Template** button
- Templates should be stored as portable JSON so a saved template can be exported/imported, matching however Apply Template expects to read one back in.

## What NOT to change
Leave every other page, the data model, the AI features, and the overall theming untouched — this is scoped to the Variables page and its modals only. If the underlying `variables` / `variable_values` / `custom_results` tables already support everything above, don't restructure them; just fix the UI/UX to match. If something here genuinely requires a schema change (e.g. storing which icon-picker category was last used, or template JSON blobs), make the smallest change that supports it and tell me what you changed and why.

When you're done, give me a quick summary of what you changed vs. what already matched.
