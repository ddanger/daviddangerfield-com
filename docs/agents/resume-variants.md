# Tailoring the resume for a job posting

A variant is a copy of the resume data tailored to one job posting and built into its own PDF. Variants live in `applications/<name>/`, which is git-ignored: the repo is public and a variant shows where David is applying, so variant content stays in that folder.

## Steps

1. **Create it.** Run `npm run resume:variant -- <company>-<role>` (lowercase, hyphenated), and save the posting's text as `applications/<name>/posting.md`. Done when both `resume.json` and `posting.md` are in the folder.
2. **Tailor `applications/<name>/resume.json`.** It has the same schema as the canonical `src/pages/resume/resume.json`. Every claim stays **traceable**: to the canonical resume, `career-history.md` in David's personal-history repo, or something David confirmed in writing. How far to tailor (which sections, how much rewording) is David's call for each application; when his request doesn't say, ask him. Done when every change you intend is in the file.
3. **Build it.** Run `npm run resume:variant -- <name>` again. It writes the PDF and `review.md`, or fails with the reason. Fit a variant to its pages by editing its content: `resume.css` is shared with the public resume. Done when the command prints a ✓ for both the PDF and `review.md`.
4. **Hand it to David.** Give him the PDF's path and every line under "Text not in the canonical resume" in `review.md`, since those are the claims to check. He reviews and sends it himself. Done when he has both.

Wording from a variant worth keeping in the public resume goes into `src/pages/resume/resume.json` when David asks, followed by `npm run update:resume` (see the README, **Updating the Resume**).
