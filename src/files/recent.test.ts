import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecentFile,
  clearRecentFiles,
  folderOf,
  removeRecentFile,
  useRecentFiles,
} from "./recent";

beforeEach(() => clearRecentFiles());

describe("recent files", () => {
  it("keeps the most recent first, without duplicates, at most 8", () => {
    for (let i = 0; i < 10; i++) addRecentFile({ name: `${i}.tiza`, path: `/d/${i}.tiza` });
    addRecentFile({ name: "3.tiza", path: "/d/3.tiza" });
    const list = useRecentFiles.getState();
    expect(list).toHaveLength(8);
    expect(list[0].path).toBe("/d/3.tiza");
    expect(list.filter((f) => f.path === "/d/3.tiza")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("tiza.recentFiles")!)).toHaveLength(8);
  });

  it("ignores files without a path and can forget one", () => {
    addRecentFile({ name: "web.tiza", path: null });
    addRecentFile({ name: "a.tiza", path: "/a.tiza" });
    removeRecentFile("/a.tiza");
    expect(useRecentFiles.getState()).toEqual([]);
  });

  it("shortens the home folder", () => {
    expect(folderOf("/home/ana/Clases/f1.tiza", "/home/ana")).toBe("~/Clases");
    expect(folderOf("C:\\Users\\ana\\f1.tiza")).toBe("C:\\Users\\ana");
  });
});
