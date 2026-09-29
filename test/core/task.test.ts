import { describe, expect, it } from "vitest"
import { createTask, transitionTask } from "../../src/core/task.js"

describe("transitionTask", () => {
  it("rejects an invalid task transition", () => {
    expect(() => transitionTask(createTask("rename x"), "completed")).toThrow("pending -> completed")
  })
})
