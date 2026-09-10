# Voice checkout and physical receipt implementation plan

Goal: implement the user-approved Review → Preview → saved order → animated receipt journey in the existing Expo app.
Spec: user attachment pasted-text.txt, supplied September 10, 2026; latest direction adds spiraling torn paper pieces.

Architecture: reuse CartProvider, useProfileIdentity, Firebase auth/orders and the current voice/audio upload pipeline. Checkout holds order-specific delivery edits. Services own pricing/validation/submission; receipt components only receive an immutable saved snapshot.

Design: #08ACE0 cyan, #0B2936 ink, #F2FAFD canvas, #FFFFFF surfaces, #FFFEF8 receipt stock, #247447 success. Native system typography for the flow; platform monospace for the thermal receipt. Disciplined form and read-only preview lead to the signature layered cyan-white printer. A clipped transform feeds paper from its slot, then a deterministic staggered strip animation curls the receipt away after Tear It. No WebView, physics or image-generation dependency.

- [ ] Extend order service with immutable snapshot, audio metadata, validated catalog pricing, idempotent retry and owner-scoped live tracking. Test rejection, duplicate request, price/quantity validation, metadata.
- [ ] Build coordinated editable review/read-only preview with preserved fields, catalog search and replacement, area validation, async locks and safe navigation. Test edits, back, failure, double submit.
- [ ] Build native receipt printer, content strips, jagged paper edges, reduced-motion path, guarded print actions and structured escaped HTML. Test print content and tear lifecycle.
- [ ] Preserve voice interpretation through the existing handoff and add real tracking route.
- [ ] Run TypeScript, Jest, lint and platform bundle verification; visually inspect available platform. Record limitations honestly.

Constraints: do not modify unrelated working-tree changes. No fake catalog or submissions. No permanent profile writes. Only existing COD. New expo-print module requires native rebuild. Catalog currently consists of five produce entries; no remote inventory or supported delivery area configuration exists. Request actual supported areas; until supplied keep configuration explicit without fabricating a service boundary.
