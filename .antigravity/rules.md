# Antigravity Agent Guidelines

- **Architecture:** Local-first Android app using Expo Router and `expo-sqlite` (new `useSQLiteContext` API).
- **Backend:** NO Firebase, NO Cloud Firestore, NO Cloudinary, NO remote auth. Everything runs 100% offline.
- **Language:** TypeScript with strict typing. Never use `any`.
- **Styling:** React Native `StyleSheet.create`. Use the shared responsive scaling utilities in `utils/styling.ts`.
- **Database Operations:** Never execute raw unparameterized SQL queries with concatenated strings; always use parameterized queries with `?` or `$param`.
- **Verification Rule:** Run `npx tsc --noEmit` in the terminal after editing TypeScript files before marking a task as done.