/**
 * The seam where real order data will arrive, and the reason it is empty today.
 *
 * PRD section 16 forbids the assistant from stating any order, payment, refund,
 * delivery or account fact the backend did not supply. There is no orders
 * backend yet, so the honest amount of context to send is none — and this file
 * exists to make that a deliberate, single-line change later rather than a
 * refactor of the chat UI.
 *
 * When it does get filled in, it fills in on the *server*. A context object
 * assembled here and posted up would be a context object any modified client
 * could write, and "your refund was approved" is exactly the sentence someone
 * would write into it. The signature stays async so that swapping in a Firestore
 * read changes nothing above it.
 */

export type SupportContext = {
  /** Everything below is absent until a trusted backend supplies it. */
  latestOrder?: { id: string; status: string; placedAt: number };
  deliveryEta?: string;
  paymentStatus?: string;
};

export async function loadSupportContext(): Promise<SupportContext | null> {
  return null;
}
