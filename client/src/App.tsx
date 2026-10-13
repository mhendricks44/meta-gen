import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Share from "@/pages/share";
import Curate from "@/pages/curate";
import { Shell } from "@/components/shell";
import { AppProvider } from "@/lib/app-state";

function AppRouter() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/o/:id" component={Home} />
        <Route path="/share" component={Share} />
        <Route path="/post" component={Share} />
        <Route path="/curate" component={Curate} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
