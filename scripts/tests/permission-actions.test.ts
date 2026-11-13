import assert from "node:assert/strict"
import test from "node:test"

import { parsePermissionTitle } from "../../lib/auth/permissionActions"

test("treats an ordinary module title as its list permission", () => {
  assert.deepEqual(parsePermissionTitle("Data Compliance"), {
    moduleTitle: "Data Compliance",
    action: "list",
  })
})

test("preserves slashes inside a module title", () => {
  assert.deepEqual(parsePermissionTitle("Farm/Growth Cycle"), {
    moduleTitle: "Farm/Growth Cycle",
    action: "list",
  })
})

test("parses only a recognized permission action suffix", () => {
  assert.deepEqual(parsePermissionTitle("Farm/Growth Cycle/edit"), {
    moduleTitle: "Farm/Growth Cycle",
    action: "edit",
  })
})
