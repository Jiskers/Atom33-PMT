/* ============================================================
   TREE

   Pure helpers over the folder/file tree shape from seed.js: an
   array of { id, kind: "folder", name, children } | { id, kind: "file" }
   nodes, nested arbitrarily. File nodes hold no data of their own —
   name/content live in the files map, keyed by the same id.
   ============================================================ */

// All file ids under a node (itself included if it's a file).
export function collectFileIds(node, out = []) {
  if (node.kind === "file") out.push(node.id);
  else node.children.forEach((ch) => collectFileIds(ch, out));
  return out;
}

function locate(list, id, parent = null) {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { list, index: i, parent };
    if (list[i].kind === "folder") {
      const found = locate(list[i].children, id, list[i]);
      if (found) return found;
    }
  }
  return null;
}

export function findNode(tree, id) {
  const loc = locate(tree, id);
  return loc ? loc.list[loc.index] : null;
}

function isDescendant(folder, id) {
  return folder.children.some((ch) => ch.id === id || (ch.kind === "folder" && isDescendant(ch, id)));
}

// Remove `id` from a cloned tree; returns the new tree + the removed node (null if not found).
export function removeNode(tree, id) {
  const clone = structuredClone(tree);
  const loc = locate(clone, id);
  if (!loc) return { tree: clone, removed: null };
  const [removed] = loc.list.splice(loc.index, 1);
  return { tree: clone, removed };
}

// Insert `node` as a child of folder `parentId` (or at root level if falsy/not a folder).
export function insertNode(tree, node, parentId) {
  const clone = structuredClone(tree);
  const target = parentId && findNode(clone, parentId);
  if (target?.kind === "folder") target.children.push(node);
  else clone.push(node);
  return clone;
}

// Reparent `id` under `newParentId`. No-ops on dropping onto itself or one
// of its own descendants (that would orphan the branch from the tree).
export function moveNode(tree, id, newParentId) {
  if (id === newParentId) return tree;
  const dragged = findNode(tree, id);
  if (!dragged) return tree;
  if (dragged.kind === "folder" && newParentId && isDescendant(dragged, newParentId)) return tree;
  const { tree: withoutNode, removed } = removeNode(tree, id);
  return insertNode(withoutNode, removed, newParentId);
}

export function renameFolder(tree, id, name) {
  const clone = structuredClone(tree);
  const node = findNode(clone, id);
  if (node?.kind === "folder" && name.trim()) node.name = name.trim();
  return clone;
}
