// Categories are fully dynamic and Admin-created (Samsung, Apple, Oppo, Google
// Pixel, ...) — there is no Brand module and no Operating System field, so
// this is the single, centralized heuristic used anywhere the UI needs to
// tell an Apple/iPhone-family category apart from every other (Android-family)
// serialized category. It only affects which optional fields are shown on
// the phone form (Battery Health) — it never restricts which category names
// an Admin can create.
export function isAppleCategory(categoryName: string): boolean {
  return /\b(apple|iphone|ipad)\b/i.test(categoryName);
}
