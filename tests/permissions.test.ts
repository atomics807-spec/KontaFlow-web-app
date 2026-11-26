import { describe, expect, it } from "vitest";
import { can, canAny, isAtLeast, permissionsForRole, parseRole, PERMISSIONS } from "@/lib/permissions";

describe("role permissions", () => {
  it("gives owners every permission and removes deletion from admins", () => {
    expect(permissionsForRole("owner")).toHaveLength(PERMISSIONS.length);
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can("admin", "workspace:delete")).toBe(false);
    expect(can("admin", "billing:manage")).toBe(true);
  });

  it("keeps staff out of finance corrections and team management", () => {
    expect(can("staff", "transactions:create")).toBe(true);
    expect(can("staff", "transactions:void")).toBe(false);
    expect(can("staff", "reports:read")).toBe(false);
    expect(can("staff", "members:invite")).toBe(false);
    expect(can("staff", "contacts:manage")).toBe(false);
  });

  it("lets accountants and managers manage contacts but not billing", () => {
    expect(can("accountant", "contacts:manage")).toBe(true);
    expect(can("manager", "contacts:manage")).toBe(true);
    expect(can("accountant", "billing:manage")).toBe(false);
    expect(can("manager", "reports:export")).toBe(false);
  });

  it("treats unknown or missing roles as unauthorised", () => {
    expect(can(null, "workspace:read")).toBe(false);
    expect(can(undefined, "transactions:create")).toBe(false);
    expect(canAny("staff", ["reports:read", "transactions:create"])).toBe(true);
  });

  it("orders roles and parses role strings", () => {
    expect(isAtLeast("owner", "admin")).toBe(true);
    expect(isAtLeast("staff", "manager")).toBe(false);
    expect(parseRole("Accountant")).toBe("accountant");
    expect(parseRole("superuser")).toBeNull();
  });
});
