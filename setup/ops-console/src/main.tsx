import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./index.css";
import Today from "@/pages/Today";
import Companies from "@/pages/Companies";
import Board from "@/pages/Board";
import CompanyPage from "@/pages/Company";
import PossibleClients from "@/pages/PossibleClients";
import Ready from "@/pages/Ready";
import Import from "@/pages/Import";
import Suppression from "@/pages/Suppression";
import Leads from "@/pages/Leads";
import Review from "@/pages/Review";
import Searches from "@/pages/Searches";

const NAV: [string, string][] = [
  ["/", "Today"], ["/companies", "Table"], ["/board", "Board"], ["/possible", "Possible clients"], ["/review", "Review queue"],
  ["/searches", "Searches"], ["/leads", "Inbound leads"], ["/ready", "Ready to send"], ["/import", "Import"], ["/suppression", "Suppression"],
];

function Shell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-2">
          <span className="mr-3 text-sm font-semibold">Arkosa ops</span>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => cn("rounded-md px-2.5 py-1.5 text-sm hover:bg-muted", isActive && "bg-muted font-medium")}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/board" element={<Board />} />
          <Route path="/possible" element={<PossibleClients />} />
          <Route path="/company/:id" element={<CompanyPage />} />
          <Route path="/review" element={<Review />} />
          <Route path="/searches" element={<Searches />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/ready" element={<Ready />} />
          <Route path="/import" element={<Import />} />
          <Route path="/suppression" element={<Suppression />} />
          <Route path="*" element={<p>Not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </TooltipProvider>
  </StrictMode>,
);
