import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles.css";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Brands from "./pages/Brands";
import BrandDetail from "./pages/BrandDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Research from "./pages/Research";
import ResearchDetail from "./pages/ResearchDetail";
import Claude from "./pages/Claude";
import Jobs from "./pages/Jobs";
import Settings from "./pages/Settings";

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 2000, retry: 1 } } });

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/brands", element: <Brands /> },
      { path: "/brands/:slug", element: <BrandDetail /> },
      { path: "/projects", element: <Projects /> },
      { path: "/projects/:brand/:id", element: <ProjectDetail /> },
      { path: "/research", element: <Research /> },
      { path: "/research/:brand/:key", element: <ResearchDetail /> },
      { path: "/claude", element: <Claude /> },
      { path: "/jobs", element: <Jobs /> },
      { path: "/settings", element: <Settings /> },
      { path: "*", element: <p className="text-ink-2">This page doesn't exist. Use the menu to find your way back.</p> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
