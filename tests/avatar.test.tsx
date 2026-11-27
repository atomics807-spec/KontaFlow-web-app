// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders an uploaded workspace logo instead of initials", () => {
    const { container } = render(
      <Avatar name="Douala Fresh Market" src="https://example.test/logo.png" />,
    );
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://example.test/logo.png");
  });

  it("falls back to initials when no logo is available", () => {
    const { container } = render(<Avatar name="Douala Fresh Market" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("DF");
  });
});
