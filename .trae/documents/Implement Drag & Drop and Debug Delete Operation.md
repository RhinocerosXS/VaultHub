## Implement Drag and Drop & Fix Delete Issue

### 1. Backend: Fix Delete Stability & Debugging
- Modify `FilesService.remove` in `back/src/files/files.service.ts`:
  - Add explicit `try-catch` block to log errors during deletion.
  - Ensure `child._id` is correctly treated as a string during recursive calls.
  - Verify `EventsGateway` usage is safe.

### 2. Frontend: Implement Drag & Drop (File Move)
- Modify `FileItem` in `front/components/SidebarLeft.tsx`:
  - Add `draggable` attribute.
  - Implement `onDragStart`: Store the dragged file's ID.
  - Implement `onDragOver`: Allow dropping only on **folders**.
  - Implement `onDrop`:
    - Retrieve dragged ID.
    - Prevent dropping onto itself or its own children (basic cycle check).
    - Call `api.files.update` with `parent_id` (mapped from `parentId` in frontend).
    - Trigger tree refresh.

### 3. Frontend: Refine Delete Logic
- Ensure `handleDeleteFile` in `App.tsx` handles errors gracefully.
- (Already implemented, but double-check state updates).

### 4. Verification
- Verify file deletion no longer causes server crash/timeout.
- Verify files can be dragged into folders and the tree updates correctly.
