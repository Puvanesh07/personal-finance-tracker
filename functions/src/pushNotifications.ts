/**
 * functions/src/pushNotifications.ts
 *
 * Notification helpers — types, rule evaluators, email renderer.
 * The actual scheduling is handled by GitHub Actions (scripts/send-notifications.js)
 * which calls the same logic outside of Firebase, eliminating Cloud Scheduler costs.
 */

// NOTE: This file intentionally exports NO Firebase Cloud Functions.
// It is kept as a shared utility module for type definitions and helpers
// that may be reused by other server-side code.

export {};
