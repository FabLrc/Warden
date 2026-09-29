import { describe, expect, it } from "vitest"
import { dependencyStatus, readyTasks, validateTaskDag } from "../../src/core/dag.js"

describe("task DAG", () => {
  it("only schedules pending tasks after every dependency completes", () => {
    const tasks = [
      { id: "inspect", state: "completed" as const },
      { id: "build", state: "pending" as const, dependencies: ["inspect"] },
      { id: "review", state: "pending" as const, dependencies: ["build"] }
    ]

    expect(readyTasks(tasks).map((task) => task.id)).toEqual(["build"])
    expect(dependencyStatus(tasks[2], tasks)).toBe("waiting")
  })

  it("blocks tasks with unsuccessful or missing dependencies", () => {
    const tasks = [
      { id: "build", state: "failed" as const },
      { id: "review", state: "pending" as const, dependencies: ["build"] },
      { id: "publish", state: "pending" as const, dependencies: ["missing"] }
    ]

    expect(dependencyStatus(tasks[1], tasks)).toBe("blocked")
    expect(dependencyStatus(tasks[2], tasks)).toBe("blocked")
  })

  it("rejects task cycles and unknown dependencies", () => {
    expect(() => validateTaskDag([
      { id: "a", state: "pending", dependencies: ["b"] },
      { id: "b", state: "pending", dependencies: ["a"] }
    ])).toThrow("Task dependency cycle")
    expect(() => validateTaskDag([{ id: "a", state: "pending", dependencies: ["missing"] }])).toThrow("Unknown dependency")
  })
})
