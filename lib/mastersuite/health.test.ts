import { describe, expect, it } from "vitest";
import { getMissingMasterSuiteEnv } from "./health";

describe("getMissingMasterSuiteEnv", () => {
  it("reports every required MasterSuite DB key when env is empty", () => {
    expect(getMissingMasterSuiteEnv({})).toEqual([
      "MASTERSUITE_DB_HOST",
      "MASTERSUITE_DB_PORT",
      "MASTERSUITE_DB_USER",
      "MASTERSUITE_DB_PASSWORD",
      "MASTERSUITE_DB_NAME",
    ]);
  });

  it("passes when all required DB keys are present", () => {
    expect(
      getMissingMasterSuiteEnv({
        MASTERSUITE_DB_HOST: "host",
        MASTERSUITE_DB_PORT: "3306",
        MASTERSUITE_DB_USER: "user",
        MASTERSUITE_DB_PASSWORD: "secret",
        MASTERSUITE_DB_NAME: "mastersuite",
      })
    ).toEqual([]);
  });
});
