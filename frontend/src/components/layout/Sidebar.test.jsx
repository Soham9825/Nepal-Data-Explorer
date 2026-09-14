import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

function renderSidebar(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar collapsed={false} onToggle={() => {}} />
    </MemoryRouter>
  );
}

describe("Sidebar", () => {
  it("highlights National when landing on /national after login", () => {
    renderSidebar("/national");
    const national = screen.getByRole("link", { name: /National/ });
    const economic = screen.getByRole("link", { name: /Economic/ });
    expect(national.className).toContain("bg-primary");
    expect(economic.className).not.toContain("bg-primary");
  });

  it("highlights National on the root path", () => {
    renderSidebar("/");
    const national = screen.getByRole("link", { name: /National/ });
    expect(national.className).toContain("bg-primary");
  });

  it("highlights only the matching section on other paths", () => {
    renderSidebar("/economic");
    const national = screen.getByRole("link", { name: /National/ });
    const economic = screen.getByRole("link", { name: /Economic/ });
    expect(economic.className).toContain("bg-primary");
    expect(national.className).not.toContain("bg-primary");
  });
});