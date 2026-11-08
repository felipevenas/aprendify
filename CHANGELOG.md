# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- **Sociocultural repertoires:** private library for creating and saving references, with AI-assisted generation, selection of saved essay topics or a manual topic, application examples, related themes, and niches.
- **Free Completo trial:** new accounts receive 72 hours of Premium access, starting after e-mail confirmation on first access, with server-controlled expiration that redirects to the plans page.
- **Server-side Premium entitlement:** trial and paid subscription use a single authorization source; flashcard limits and mock exam persistence are enforced in the database in addition to the Premium AI functions.

### Fixed

- **Trial activation through Stripe:** the first receipt of each webhook claims the event immediately; confirmation queries to Stripe have timeouts and safe per-stage logs for investigating temporary failures.
- **Free trial return flow:** keeps the same Stripe session until the server confirms access, offers visible recovery after failures, and preserves the return destination after authentication, including with Google.
- **Trial and subscription disclosure:** the 3-day free trial notice is shown before authentication options, including Google; the trial banner clarifies billing behavior; the secondary quick-modal action was removed and an accessible transition was added to the subscription tab.
- **Checkout diagnostics:** recognized `503` responses display an allowed technical code to help identify unavailable configuration without exposing arbitrary server details.
- **Question explanations:** removed the duplicate notification when the error is already visible in the panel, with adjusted spacing.
- **Groq AI function protection:** standardized atomic rate limiting across the 11 functions in this branch, with `429` responses, usage headers, and fail-closed behavior when quota control is unavailable.
- **Responsive navbar and account menu:** notification bell available on mobile; theme toggle in the mobile account menu and desktop bar; study streak next to the profile; dropdown actions without section labels.
- **Function validation:** added tests for the rate-limit helper and static verification to prevent coverage regressions in the Groq functions.

### Documentation

- Standardized `README.md` and governance documents in English, fixed UTF-8/mojibake issues, added `CODE_OF_CONDUCT.md`, `.env.example`, and `.gitattributes`, and refreshed the issue and pull request templates.

## [0.4.0] - 2026-07-15

### Changed

#### Added

- **Responsiveness for ultrawide and large monitors (27"+):**
  - Created the `Navbar.tsx` component to adapt the interface automatically to screen size:
    - **Desktop (≥1024px):** renders the fixed sidebar on the left and a minimal top bar above the main content.
    - **Mobile (≤1023px):** hides the sidebar and shows only the top bar with a hamburger menu.
  - Adjusted the sidebar layout so it does not collide with the top bar on desktop.
  - Centered the main application content in the remaining usable screen area.
- **Global Pomodoro timer and expandable floating widget:**
  - Implemented global state management for the Pomodoro timer, synchronized across all application screens.
  - Developed the `FloatingPomodoro` widget that follows the user on pages outside the Dashboard.
  - Added dynamic, reactive opacity based on time progress and mouse interaction.
  - Created a fullscreen focus mode with complete Pomodoro controls and an Extreme Focus option (100% black background for fewer distractions).
  - Added a button to maximize the timer directly from the study panel card (Dashboard).
  - Persistence across F5 reloads integrated with browser `localStorage`.
- **Help menu improvements:**
  - Removed the floating help button (?) from the bottom-right corner and integrated it into the Navbar profile dropdown, appearing dynamically on pages with tutorial support.

#### Modified

- **Dashboard layout fix:**
  - Added the `app-layout-container` class to `CreatorDashboard.tsx` to ensure the panel occupies the full screen height, centering content above the bottom navigation bar.
- **Margin adjustments:**
  - Adjusted main content margins in `CreatorDashboard.tsx` to `py-6 lg:py-10` to improve spacing.
- **Error review responsiveness:**
  - Added the `app-layout-container` class to the main page container in `ReviewErrors.tsx`, fixing layout collisions with the fixed desktop sidebar and improving the mobile layout.
  - Refactored the header, filters, and card items for flexible stacking and full-width buttons on mobile.
  - Added the standard **Pagination** component (shadcn/ui) configured to display 5 errors per page with dynamic reset when the subject filter changes.

#### Fixed

- **Duplicate notification removal:**
  - Fixed the duplicate "Resposta registrada!" notification in `Questions.tsx`.
- **Dashboard statistics and performance by area:**
  - Fixed the bug caused by the nonexistent `subject_id` column in the `question_attempts` table by changing the Dashboard query and data mapping to use `discipline` and the `getSubjectByDiscipline` utility.

## [0.3.0] - 2026-06-28

### Changed

#### Added

- **Dynamic per-screen tooltip tour:** created a contextual help system that adapts to the user's active page. Tooltips are loaded on demand based on the active route using the `useLocation` hook in `HelpTooltipsContext.tsx`.
- **Highlight element identification:** added tour attributes (`data-tour`) to the `Schedule.tsx`, `Questions.tsx`, `Tasks.tsx`, `Notes.tsx`, `Statistics.tsx`, `Simulados.tsx`, `Flashcards.tsx`, and `Essays.tsx` pages to guide interactive balloons.

#### Modified

- **Responsiveness on desktops and large monitors (27"):** adjusted the positioning of the main study container (`main`) in `index.css` to center it in the remaining usable area next to the fixed sidebar, and aligned the top bar in `Navbar.tsx` for a premium presentation.
- **Smart help button hiding:** updated the `HelpButton.tsx` component to hide automatically on pages without registered tours (for example, Settings and Subscriptions), avoiding empty interactions.
- **Removal of Simulados from the sidebar:** temporarily hid the "Simulados" section link from the fixed and mobile side navigation in `Navbar.tsx` for later adjustments.
- **Creator panel responsiveness and layout:** added the `.app-layout-container` class to the root container of `CreatorDashboard.tsx` to fix layout breakage under the fixed sidebar on desktop.
- **Margin and layout improvements:** adjusted the `main` padding in `CreatorDashboard.tsx` to `py-6 lg:py-10` and added spacing (`mb-6`) between chart and table cards for a cleaner, more balanced visual.
- **Standard loading state in the Creator panel:** integrated the unified `<PageLoader>` component in place of the previous ad-hoc loading screen in `CreatorDashboard.tsx`.
- **Toast notification removal in the question bank:** removed the repetitive "Resposta registrada!" toast when submitting solved alternatives in `Questions.tsx`.
- **Subscription plan prices and price IDs:** updated plan prices in `PremiumModal.tsx` and `Landing.tsx` to reflect the Monthly plan at **R$ 9.90/month** and the Annual plan at **R$ 95.04/year** (equivalent to R$ 7.92/month with a 20% discount). New price IDs generated through the Stripe API were integrated into checkout.

#### Fixed

- **Ten-question daily limit bypass:** fixed the flaw in `Questions.tsx` that bypassed the free barrier and allowed non-Premium users to reload or switch pages to obtain new questions. The mount `useEffect` now blocks requests when the free-user limit has been exceeded.
- **Incorrect "View plans" redirect:** fixed the "Ver planos disponíveis" button in `Subscription.tsx`, which incorrectly redirected the user back to the Dashboard. It now opens the `PremiumModal` with Stripe options directly on the subscription screen.

## [0.2.0] - 2026-06-27

### Changed

#### Added

- **Gamification and weekly challenges:** added tables and a system for achievements, leaderboard, and weekly challenge progress in Supabase.
- **ENEM-focused general dashboard:** created the new central dashboard (`Dashboard.tsx`) with utility widgets for ENEM (Pomodoro integrated with Web Audio, live countdown, and analytical/motivational performance panels by knowledge area).
- **Classic sidebar layout:** added a fixed desktop sidebar on the left with links organized by category and a footer with the user profile.
- **Previous layout preservation:** copied the old dashboard to `DashboardOld.tsx` for historical backup (dead code).
- **AI agents:** created agent configuration files in the `.agents/` folder for UI/UX, Supabase, React, QA, Git, Performance, and Security adapted to Antigravity.
- **Pull request standard:** created the pull request template at `.github/pull_request_template.md`.
- **Repository governance:** added governance files for the repository, including `LICENSE` (proprietary license), `CONTRIBUTING.md` (Trunk-Based Development guidelines), and `SECURITY.md` (vulnerability reporting policy).
- **Formatting configuration:** created the `.editorconfig` file at the project root.
- **Issue templates:** created templates for bug reports (`bug_report.md`) and improvement suggestions (`feature_request.md`) under `.github/issue_template/`.

#### Modified

- **Performance and cache optimization:** configured a global `QueryClient` in `App.tsx` with a 5-minute `staleTime`, reducing Supabase queries when switching tabs. Disabled the obsolete IndexedDB preloader and the HTTP request queue to `api.enem.dev` in `useBackgroundPreloader.ts`.
- **Supabase RLS vulnerability mitigation:** created the SQL migration `20260627212400_restrict_gamification_rls.sql` to remove direct write permissions (`FOR ALL`) from the `leaderboard_stats` and `user_challenge_progress` tables, protecting the ranking against fraud.
- **Dependency audit (AppSec):** updated 18 dependencies with critical/high vulnerabilities through `npm audit fix` (including critical PDF injection flaws in `jspdf` and XSS bypass in `dompurify`).
- **ENEM positioning focus:** updated `README.md` to highlight the platform as a study ecosystem shaped specifically for ENEM, detailing its features.
- **Mobile-first responsiveness:** fixed the crushing of weekly grid columns on mobile in `WeeklyAgendaView.tsx` by adding horizontal scrolling synchronized with a responsive minimum width of `750px`.
- **Adaptive navigation:** modified the `Navbar.tsx` component to act as a minimal top bar on desktop (next to the sidebar) and keep a compact hamburger menu on mobile, rendering the same links.
- **Structural CSS:** adjusted margins and paddings in `index.css` using smart `:has` selectors to responsively adapt all authenticated screens to the new sidebar design on desktop.
- **Headers and buttons:** standardized headers with the feature badge + icon pattern, removing redundant back buttons from all main and administrative pages.

## [0.1.0] - 2026-06-26

### Changed

#### Added

- Initial React project structure with Vite, TypeScript, Tailwind CSS, and shadcn/ui.
- Basic Supabase table integration (`profiles`, `subjects`, `schedule_items`, `tasks`) with Row Level Security (RLS) policies enabled.
- Initial routing and Auth (Login/Signup), Dashboard, Schedule, Tasks, and Subjects screens.
- Created the `CHANGELOG.md` file for change tracking.
